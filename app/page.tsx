import { ArrowDown, ArrowRight } from "lucide-react";
import { CARD, FOCUS_RING_ON_SURFACE, PRIMARY_BUTTON } from "@/components/ui/controls";
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
 *
 * Lời dẫn và ảnh nằm cạnh nhau để mỗi chủ đề đọc được trong một khung nhìn PC.
 */
export default async function Home() {
  // MỘT truy vấn, không phải hai: `ShelfChain` đã bao gồm nguyên `ShelfSummary` mà Header
  // cần. Và tuyệt đối không `Promise.all` hai lời gọi đọc Sequelize — bẫy đã ghi trong
  // CLAUDE.md, chúng chồng lên nhau trên cùng một connection.
  const chains = await readShelfChains();

  return (
    <main id="noi-dung" className="min-w-0 flex-1 px-page-margin py-xl">
      {/* `max-w-5xl` (1024px) là bề rộng cột nội dung dùng chung với /cong-dong và
          /bai-giang. Trước đây trang này dùng `max-w-4xl` nên lề trái của <h1> nhảy
          ~56px mỗi lần bấm qua lại giữa hai màn nằm cạnh nhau trên cùng thanh nav. */}
      <section className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_18rem] items-end gap-2xl border-b border-primary/20 pb-2xl pt-md">
        <div>
          <p className="font-ui text-label-caps uppercase text-son">Cửa sổ lịch sử</p>
          <h1 className="mt-md max-w-measure text-balance font-ui text-display-lg text-primary">
            Mọi thứ quanh bạn đều từng khác hẳn
          </h1>
          <p className="mt-md max-w-measure font-ui text-body-md text-ink-dilute">
            Bữa ăn, bộ quần áo, mái nhà, cái điện thoại trong túi — mỗi thứ là kết quả của
            hàng nghìn năm. Kéo vạch giữa hai tấm ảnh để thấy khoảng cách đó bằng mắt, rồi
            mở một quyển sách để biết chuyện gì đã xảy ra ở giữa.
          </p>
          <a href="#vao-ke" className={`mt-lg ${PRIMARY_BUTTON}`}>
            Khám phá kệ sách <ArrowRight aria-hidden className="h-4 w-4" />
          </a>
        </div>
        <nav aria-label="Chủ đề ngày ấy và bây giờ" className={CARD}>
          <p className="font-ui text-label-caps uppercase text-son">Ngày ấy — Bây giờ</p>
          <p className="mb-md mt-sm font-ui text-body-sm text-ink-dilute">
            Chọn một điều quen thuộc, nhìn lại từ đầu.
          </p>
          <ul className="divide-y divide-primary/15">
            {KHOI_SO_SANH.map((khoi) => (
              <li key={khoi.key}>
                <a
                  href={`#khoi-${khoi.key}`}
                  className={`flex items-center justify-between gap-md rounded-sm py-sm font-ui text-label-md text-primary transition-colors duration-200 hover:text-son ${FOCUS_RING_ON_SURFACE}`}
                >
                  {khoi.chuDe}
                  <ArrowDown aria-hidden className="h-4 w-4 shrink-0 text-son" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </section>

      <div className={`${s.day} mx-auto mt-3xl max-w-5xl pl-lg`}>
        {KHOI_SO_SANH.map((khoi) => (
          <section
            key={khoi.key}
            className={`${s.moc} ${s.hienDan} relative mb-3xl grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-xl pl-lg last:mb-0`}
            aria-labelledby={`khoi-${khoi.key}`}
          >
            {/* CHỦ ĐỀ dẫn, khoảng thời gian lùi xuống làm nhãn phụ.

                Trước đây thứ tự ngược lại, và nó nói sai một điều: sợi dây dọc kèm chấm
                tròn là từ vựng hình ảnh của một TRỤC THỜI GIAN, nhưng bốn khối này không
                nối tiếp nhau về thời gian — cả bốn ("Thời tiền sử → hôm nay", "Thời đồ đá
                → thế kỷ 21", "Hang đá → đô thị", "Thẻ tre → tức thì") đều trải ĐÚNG cùng
                một khoảng, mỗi khối tự nó đã là một cặp xưa→nay hoàn chỉnh. Đặt khoảng
                thời gian lên đầu mỗi mốc là mời người đọc hiểu bốn mốc như bốn chặng kế
                tiếp. Cho chủ đề dẫn thì sợi dây đọc ra đúng thứ nó là: mạch nối bốn
                chương của cùng một trang, không phải dòng chảy thời gian. */}
            <div>
              <h2
                id={`khoi-${khoi.key}`}
                className="scroll-mt-lg text-balance font-ui text-display-md text-primary"
              >
                {khoi.chuDe}
              </h2>
              <p className="mt-md font-ui text-body-sm text-son">
                {khoi.moc}
              </p>
              <p className="mt-md max-w-measure text-pretty font-ui text-body-md text-ink-dilute">
                {khoi.dan}
              </p>
              <p className="mt-lg flex items-center gap-sm font-ui text-caption text-ink-dilute">
                <ArrowRight aria-hidden className="h-4 w-4 shrink-0" />
                Kéo vạch trên ảnh để so sánh
              </p>
            </div>
            <CompareSlider xua={khoi.xua} nay={khoi.nay} chuDe={khoi.chuDe} />
          </section>
        ))}
      </div>

      <section className="mx-auto mt-3xl max-w-5xl border-t border-primary/20 pb-xl pt-2xl" aria-labelledby="vao-ke">
        {/* Nhãn phụ để chương thứ ba mở đầu cùng một khuôn với hero và từng mốc thời
            gian — nếu không, nó là tiêu đề duy nhất trên trang không có nhãn dẫn. */}
        <p className="font-ui text-label-caps uppercase text-son">Kệ sách</p>
        <h2 id="vao-ke" className="mt-sm scroll-mt-lg font-ui text-display-md text-primary">
          Bắt đầu đọc
        </h2>
        <p className="mb-lg mt-sm max-w-measure font-ui text-body-md text-ink-dilute">
          Mỗi kệ là một mạch thời gian. Đọc xong một quyển, bạn nhận được vật phẩm mở khóa
          quyển tiếp theo.
        </p>
        {chains.length > 0 ? (
          <ShelfProgress shelves={chains} />
        ) : (
          <p className="font-ui text-body-md text-ink-dilute">
            Chưa có kệ sách nào được xuất bản.
          </p>
        )}
      </section>
    </main>
  );
}
