import { Header } from "@/components/Header";
import { CompareSlider } from "@/components/home/CompareSlider";
import { KHOI_SO_SANH } from "@/components/home/noi-dung";
import { ShelfProgress } from "@/components/home/ShelfProgress";
import s from "@/components/home/home.module.scss";
import { readShelfChains } from "@/lib/content/read";

// Nội dung là dữ liệu runtime (admin xuất bản kệ mới không cần build lại — spec
// 2026-08-24 §2.1). Prerender tĩnh sẽ chụp danh sách kệ tại thời điểm build rồi giấu
// biệt mọi kệ xuất bản sau đó cho tới lần build kế tiếp — đúng thứ spec muốn xóa bỏ.
export const dynamic = "force-dynamic";

/**
 * Trang chủ — hành trình tiến hóa của loài người (content.md §5.1).
 *
 * Dòng thời gian cuộn dọc, mỗi chủ đề là một khối so sánh "Ngày ấy – Bây giờ" kéo được
 * vạch giữa hai ảnh. Cuối trang là ba lối vào kệ kèm chỉ báo tiến độ.
 */
export default async function Home() {
  // MỘT truy vấn, không phải hai: `ShelfChain` đã bao gồm nguyên `ShelfSummary` mà Header
  // cần. Và tuyệt đối không `Promise.all` hai lời gọi đọc Sequelize — bẫy đã ghi trong
  // CLAUDE.md, chúng chồng lên nhau trên cùng một connection.
  const chains = await readShelfChains();

  return (
    <>
      <Header activeHref="/" shelves={chains} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <section className="mx-auto max-w-4xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Cửa sổ lịch sử</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">
            Mọi thứ quanh bạn đều từng khác hẳn
          </h1>
          <p className="mt-md max-w-2xl font-body text-body-md text-secondary">
            Bữa ăn, bộ quần áo, mái nhà, cái điện thoại trong túi — mỗi thứ là kết quả của
            hàng nghìn năm. Kéo vạch giữa hai tấm ảnh để thấy khoảng cách đó bằng mắt, rồi
            mở một quyển sách để biết chuyện gì đã xảy ra ở giữa.
          </p>
        </section>

        <div className={`${s.day} mx-auto mt-xl max-w-4xl pl-lg`}>
          {KHOI_SO_SANH.map((khoi) => (
            <section
              key={khoi.key}
              className={`${s.moc} ${s.hienDan} relative mb-xl pl-lg last:mb-0`}
              aria-labelledby={`khoi-${khoi.key}`}
            >
              <p className="font-body text-label-caps uppercase text-tertiary-deep">{khoi.moc}</p>
              <h2
                id={`khoi-${khoi.key}`}
                className="mt-xs font-heading text-headline-md text-primary-dark"
              >
                {khoi.chuDe}
              </h2>
              <p className="mb-md mt-sm max-w-2xl font-body text-body-md text-secondary">
                {khoi.dan}
              </p>
              <CompareSlider xua={khoi.xua} nay={khoi.nay} chuDe={khoi.chuDe} />
            </section>
          ))}
        </div>

        <section className="mx-auto mt-xl max-w-4xl" aria-labelledby="vao-ke">
          <h2 id="vao-ke" className="font-heading text-headline-md text-primary-dark">
            Bắt đầu đọc
          </h2>
          <p className="mb-md mt-sm font-body text-body-md text-secondary">
            Mỗi kệ là một mạch thời gian. Đọc xong một quyển, bạn nhận được vật phẩm mở khóa
            quyển tiếp theo.
          </p>
          {chains.length > 0 ? (
            <ShelfProgress shelves={chains} />
          ) : (
            <p className="font-body text-body-md text-secondary">
              Chưa có kệ sách nào được xuất bản.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
