import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Check, ChevronRight, Lock, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import { PRIMARY_BUTTON } from "@/components/ui/controls";
import s from "@/components/bag/bag.module.scss";
import {
  readShelfList,
  readTuiHanhTrang,
  type VatPhamTuiHanhTrang,
} from "@/lib/content/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Túi hành trang — Cửa Sổ Lịch Sử",
};

/**
 * Một ô trong tủ kính.
 *
 * Bố cục DỌC và căn giữa, không phải một hàng ngang [icon nhỏ][tên][mũi tên]: ở bố cục
 * ngang, cột tên chỉ còn ~125px nên tên vật phẩm xuống hai ba dòng và ba ô cùng hàng cao
 * 96 / 104 / 130px — mép dưới răng cưa đọc ra là một danh sách bị lỗi chứ không phải một
 * tủ trưng bày. Dựng đứng lên thì cột tên rộng bằng cả ô, và vật phẩm (bệ 96px thay vì
 * 64px) thành nhân vật chính của ô thay vì một icon phụ bên trái.
 *
 * BA TÍN HIỆU phân biệt "đã có" với "chưa có", không phải một: dấu triện tròn ở góc bệ
 * (`stamp-completed` — thứ DESIGN.md gọi là dấu hiệu duy nhất của trạng thái hoàn thành,
 * mượn nguyên khuôn từ `BookCover`), hình icon dự phòng (tia sáng ↔ ổ khóa), và dòng chữ
 * trạng thái. Cần cả ba vì 8/13 vật phẩm chưa có ảnh: với chúng, icon dự phòng từng là dấu
 * hiệu đồ họa DUY NHẤT — và nó đang bị ĐẢO NGƯỢC, `tertiary-deep` trên `surface-locked`
 * chỉ đạt 1.57:1 trong khi ô chưa có đạt 4.46:1, tức phần thưởng trông yếu hơn thứ còn
 * thiếu. Cặp mới: `tertiary-light` 6.38:1 cho ô đã có, `secondary-light` 6.02:1 cho ô chưa
 * có — cả hai vượt ngưỡng 3:1 của WCAG 1.4.11 cho đồ họa mang thông tin.
 *
 * Nền giữ `bg-surface` ở CẢ HAI trạng thái. Đổi ô chưa có sang `bg-surface-locked` cho
 * giống bìa sách đang khóa nghe hợp lý nhưng sai: phần mô tả bên trong dùng `text-secondary`,
 * trên nền đó chỉ còn 1.76:1.
 */
function OVatPham({ v }: { v: VatPhamTuiHanhTrang }) {
  return (
    <li>
      {/* `h-full` là bước không được bỏ: `<li>` là ô lưới nên nó tự giãn theo hàng, còn
          `<details>` bên trong vẫn cao đúng bằng nội dung của nó — thiếu dòng này thì hàng
          vẫn rách y như cũ dù đã bỏ `items-start` khỏi `<ul>`. */}
      <details className={`${s.o} h-full rounded-md bg-surface p-md`}>
        <summary className="flex flex-col items-center gap-sm rounded-sm text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <span className="relative grid h-24 w-24 shrink-0 place-items-center rounded-sm bg-surface-locked">
            {v.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong public/
              <img
                src={v.image}
                alt=""
                className={`h-16 w-16 object-contain ${v.daCo ? "" : s.bongMo}`}
              />
            ) : v.daCo ? (
              <Sparkles aria-hidden className="h-10 w-10 text-tertiary-light" />
            ) : (
              // Ổ khóa chứ không phải tia sáng mờ đi: đúng ngôn ngữ đã dùng cho bìa sách
              // đang khóa ở màn kệ, nên hai màn nói cùng một chuyện bằng cùng một hình.
              <Lock aria-hidden className="h-10 w-10 text-secondary-light" />
            )}

            {v.daCo && (
              <span
                aria-hidden
                className="absolute -right-sm -top-sm grid h-lg w-lg place-items-center rounded-full bg-tertiary-deep"
              >
                <Check className="h-3.5 w-3.5 text-on-primary" />
              </span>
            )}
          </span>

          <span className="font-heading text-headline-sm text-primary-dark">{v.name}</span>

          <span
            className={`inline-flex items-center gap-xs font-body text-body-sm ${v.daCo ? "text-tertiary-deep" : "text-secondary"}`}
          >
            {v.daCo ? "Đã sưu tầm" : "Chưa có"}
            {/* Tam giác đóng/mở của `<details>`, xoay 90° khi mở (`bag.module.scss`). Đặt
                sát dòng trạng thái chứ không dạt ra mép phải ô: ở mép phải nó đọc ra là
                "đi tới trang khác", cạnh chữ thì nó đọc ra là "bung phần mô tả". */}
            <ChevronRight aria-hidden className={`${s.mui} h-4 w-4 shrink-0`} />
          </span>
        </summary>

        <div className="mt-md border-t border-surface-locked pt-md">
          <p className="font-body text-body-sm text-secondary">{v.description}</p>

          {v.tuQuyen && (
            <Link
              href={`/${v.tuQuyen.shelfSlug}`}
              className="mt-sm inline-flex items-center gap-xs font-body text-body-sm text-tertiary-deep underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <BookOpen aria-hidden className="h-4 w-4" />
              {v.daCo ? `Từ quyển “${v.tuQuyen.title}”` : `Đọc “${v.tuQuyen.title}” để nhận`}
            </Link>
          )}

          {/* Ghi công ảnh — cùng điều kiện BY như mọi chỗ khác có ảnh. */}
          {v.image && (
            <GhiCongAnh
              credit={v.imageCredit}
              nguon={v.imageSource}
              className="mt-sm font-body text-caption text-secondary"
            />
          )}
        </div>
      </details>
    </li>
  );
}

/**
 * Túi hành trang — tủ kính trưng bày toàn bộ vật phẩm đã sưu tầm (content.md §4.5).
 *
 * Ô của vật phẩm CHƯA có vẫn hiện, dưới dạng bóng mờ: đó là cả điểm của trang này. Một tủ
 * chỉ hiện thứ mình đã có thì không nói được còn bao nhiêu thứ đang chờ.
 *
 * Phần "bấm để xem mô tả" dùng `<details>` chứ không phải state React: đóng/mở, thao tác
 * bàn phím và ngữ nghĩa cho trình đọc màn hình đều có sẵn trong thẻ, 0 dòng JS.
 */
export default async function TuiHanhTrang() {
  // Hai lời gọi TUẦN TỰ, không `Promise.all` — cả hai đều mở transaction Sequelize.
  const shelves = await readShelfList();
  const { vatPham, daDangNhap } = await readTuiHanhTrang();

  const soDaCo = vatPham.filter((v) => v.daCo).length;

  // Gom theo KỆ, không để nguyên thứ tự slug A→Z mà `readTuiHanhTrang()` trả về.
  // content.md §4.4 quy định mỗi chuyên mục có một BỘ vật phẩm riêng và §4.5 hứa "sưu tầm
  // trọn một bộ sẽ mở khóa danh hiệu" — nhưng ở thứ tự A→Z, vật phẩm ba kệ trộn lẫn hoàn
  // toàn nên không nhìn ra bộ nào, và câu hỏi cơ bản nhất của một tủ sưu tầm ("còn thiếu
  // mấy món của kệ Việt Nam?") không trả lời được.
  //
  // Gom ở TẦNG HIỂN THỊ, không sửa hàm đọc: `readShelfList()` đã trả về kệ theo đúng
  // `position`, và mỗi vật phẩm đã mang sẵn `tuQuyen.shelfSlug`. Không cần truy vấn thêm.
  // Vòng lặp lồng nhau O(kệ × vật phẩm) chấp nhận được — cả hai đều vài chục dòng.
  const nhom = shelves
    .map((ke) => ({
      key: ke.slug,
      ten: ke.name,
      ds: vatPham.filter((v) => v.tuQuyen?.shelfSlug === ke.slug),
    }))
    .filter((n) => n.ds.length > 0);

  // Vật phẩm chưa quyển nào thưởng ra, hoặc thưởng bởi quyển thuộc kệ mà RLS đang giấu.
  // Vẫn phải hiện: nếu bỏ, tổng "x/13" ở trên không khớp số ô đếm được bên dưới.
  const daGom = new Set(nhom.flatMap((n) => n.ds.map((v) => v.slug)));
  const conLai = vatPham.filter((v) => !daGom.has(v.slug));
  if (conLai.length > 0) nhom.push({ key: "__khac", ten: "Chưa gắn kệ nào", ds: conLai });

  return (
    <>
      <Header activeHref="/tui-hanh-trang" shelves={shelves} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        {/* `max-w-5xl` (1024px) — cùng bề rộng cột nội dung với trang chủ, /cong-dong và
            /bai-giang, để lề trái của <h1> không nhảy ngang khi bấm qua lại giữa chúng. */}
        <div className="mx-auto max-w-5xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Bộ sưu tập</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">Túi hành trang</h1>
          <p className="mt-sm max-w-measure font-body text-body-md text-secondary">
            {daDangNhap
              ? `Bạn đang giữ ${soDaCo}/${vatPham.length} vật phẩm. Mỗi thứ ở đây là dấu vết của một quyển sách bạn đã đọc xong.`
              : "Đăng nhập để bắt đầu sưu tầm. Mỗi quyển sách đọc xong sẽ thả ra một vật phẩm, và chính nó mở khóa quyển tiếp theo."}
          </p>

          {daDangNhap ? (
            vatPham.length > 0 && (
              // Đây là trang duy nhất trả lời "tôi đã đi được bao xa", và câu trả lời từng
              // được giao trọn cho một con số 14px màu nâu nhạt — ở dạng chữ thuần thì
              // 4/13 và 11/13 gây ra cùng một cảm xúc. `aria-hidden` vì đúng con số đó nằm
              // trong câu ngay trên, trình đọc màn hình không mất gì.
              <div aria-hidden className={`${s.thuoc} mt-md max-w-measure`}>
                <div
                  className={s.thuocDay}
                  style={{ width: `${(soDaCo / vatPham.length) * 100}%` }}
                />
              </div>
            )
          ) : (
            // Câu trên bảo "đăng nhập để bắt đầu sưu tầm" nhưng không có gì bấm được để
            // làm việc đó. `next` đưa người dùng quay lại đúng trang này sau khi vào.
            <Link href="/dang-nhap?next=/tui-hanh-trang" className={`${PRIMARY_BUTTON} mt-md`}>
              Đăng nhập
            </Link>
          )}

          {vatPham.length === 0 ? (
            <p className="mt-lg font-body text-body-md text-secondary">
              Chưa có vật phẩm nào được tạo.
            </p>
          ) : (
            <div className={`${s.tu} mt-lg rounded-md bg-surface-shelf p-lg`}>
              {nhom.map((n, i) => (
                <section
                  key={n.key}
                  className={i > 0 ? "mt-xl" : undefined}
                  aria-labelledby={`nhom-${n.key}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-md">
                    <h2
                      id={`nhom-${n.key}`}
                      className="font-heading text-headline-sm text-on-primary"
                    >
                      {n.ten}
                    </h2>
                    <p className="font-body text-body-sm text-secondary-light">
                      {n.ds.filter((v) => v.daCo).length}/{n.ds.length} vật phẩm
                    </p>
                  </div>

                  {/* Không `items-start`: ô lưới giãn theo hàng, cộng `h-full` trên
                      `<details>` thì mọi ô cùng hàng có chung mép dưới. */}
                  <ul className="mt-md grid gap-md sm:grid-cols-3 lg:grid-cols-4">
                    {n.ds.map((v) => (
                      <OVatPham key={v.slug} v={v} />
                    ))}
                  </ul>
                </section>
              ))}

              {/* Hàng chú giải ở đáy tủ, sao khuôn từ màn kệ sách: hai trạng thái được nói
                  bằng CHỮ một lần, để người xem không phải tự suy ra ý nghĩa của dấu triện
                  và ổ khóa từ mười ba cái ô. */}
              <p className="mt-xl flex flex-wrap items-center gap-lg border-t border-primary pt-md font-body text-caption text-secondary-light">
                <span className="inline-flex items-center gap-xs">
                  <span
                    aria-hidden
                    className="grid h-lg w-lg shrink-0 place-items-center rounded-full bg-tertiary-deep"
                  >
                    <Check className="h-3.5 w-3.5 text-on-primary" />
                  </span>
                  Đã sưu tầm — dấu triện ở góc vật phẩm
                </span>
                <span className="inline-flex items-center gap-xs">
                  <Lock aria-hidden className="h-4 w-4 shrink-0 text-secondary-light" />
                  Chưa có — đọc quyển sách tương ứng để nhận
                </span>
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
