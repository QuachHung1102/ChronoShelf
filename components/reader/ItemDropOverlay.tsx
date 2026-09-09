import { useEffect, useRef } from "react";
import Link from "next/link";
import { GraduationCap, LockOpen, Sparkles } from "lucide-react";
import { AnhVatPham } from "@/components/ui/AnhVatPham";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import { PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";
import { findBook, findItem } from "@/lib/content/find";
import type { ContentBook, ContentShelf } from "@/lib/content/types";
import type { CompleteBookResult } from "@/lib/api/types";
import s from "./reader.module.scss";

/**
 * Màn hình sau khi đọc xong: vật phẩm rơi ra, rồi báo quyển kế tiếp đã mở khóa.
 * Đọc lại một quyển đã hoàn thành (`alreadyCompleted`) thì bỏ toàn bộ hoạt cảnh
 * nhưng vẫn hiện đủ thông tin — không được mất thông báo nào (DESIGN.md § Motion).
 */
export function ItemDropOverlay({
  result,
  shelf,
  book,
  onClose,
}: {
  result: CompleteBookResult;
  shelf: ContentShelf;
  /** Quyển vừa đọc xong — cần để gợi ý bài giảng của đúng chương đó. */
  book: ContentBook;
  onClose: () => void;
}) {
  const item = result.grantedItemSlug ? findItem(shelf, result.grantedItemSlug) : null;
  const nextBook = result.nextBook ? findBook(shelf, result.nextBook.slug) : null;
  const replay = result.alreadyCompleted;
  const anim = (className: string) => (replay ? "" : className);

  /**
   * Đưa focus vào dòng "Bạn nhận được: …" ngay khi màn này dựng lên.
   *
   * Không có nó thì quyển sách bị tháo khỏi cây trong khi nút "Đọc xong" đang giữ focus,
   * và focus rơi về `<body>`: người dùng bàn phím bị ném về đầu hộp thoại, người dùng
   * trình đọc màn hình không nghe thấy gì cả — đúng vào khoảnh khắc cao trào của cả cơ
   * chế sưu tầm. Một lần `focus()` lo cả hai.
   *
   * `preventScroll` vì màn này đã căn giữa sẵn; để trình duyệt tự cuộn thì nó giật một
   * nhịp ngay giữa hoạt cảnh vật phẩm rơi.
   */
  const tieuDeRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    tieuDeRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="flex flex-col items-center gap-lg px-page-margin text-center">
      {item && (
        <>
          {/* Kích thước ở đây là NỘI DUNG chứ không phải trang trí: đây là phần thưởng cho
              cả một quyển sách vừa đọc xong. Bản trước vẽ vật phẩm sáng vỏn vẹn 67px và cả
              cụm chỉ chiếm 313px giữa một vùng trống 724px, nên khoảnh khắc cao trào đọc ra
              như một dòng thông báo. Vẫn đúng một nguồn sáng trên màn — luật "một quầng sáng"
              của DESIGN.md § Quầng sáng mời gọi là luật của màn KỆ SÁCH, không phải màn này. */}
          <div
            className={`${s.itemGlow} ${anim(s.dropItem)} flex h-56 w-56 items-center justify-center rounded-full`}
          >
            {item.image ? (
              // Icon vật phẩm là hình một màu không mang mã màu nào; `AnhVatPham` vẽ nó
              // bằng CSS mask nên màu do `text-*` ở đây quyết định. Dùng `<img>` thì
              // `currentColor` trong file rơi về mặc định và mọi vật phẩm ra màu đen.
              <AnhVatPham src={item.image} className="h-36 w-36 text-son" />
            ) : (
              <Sparkles aria-hidden className="h-24 w-24 text-son" />
            )}
          </div>

          <div className={anim(s.dropText)}>
            {/* `headline-xl` 48px: DESIGN.md § Typography dựng bậc này cho đúng hai chỗ, và
                đây là một trong hai — "chữ PHẢI cân được với một vật thể chiếm cả màn hình". */}
            {/* `<h2 tabIndex={-1}>` chứ không phải `<p>`, và nó nhận focus khi màn này
                dựng lên. Trước đây khoảnh khắc nhận vật phẩm hoàn toàn CÂM với trình đọc
                màn hình: không heading, không vùng live, và focus vừa rơi về `<body>` khi
                quyển sách bị tháo khỏi cây. DESIGN.md § Motion nói thẳng "người tắt chuyển
                động không được mất thông tin nào" — ở đây thông tin mất với cả hai nhóm. */}
            <h2
              ref={tieuDeRef}
              tabIndex={-1}
              // `max-w-3xl` + `text-balance`: đo ở 1024×768 sau khi nền đổi sang giấy, dòng
              // này chạy 928px trên 1024 — gần hết bề ngang màn hình, và ngắt dòng rơi vào
              // chỗ để lại một chữ lẻ ở dòng dưới. Trên nền phòng tối trước đây khối chữ
              // sáng tự có mép; trên giấy thì không còn gì giữ nó lại.
              className="mx-auto max-w-3xl text-balance font-ui text-display-xl text-primary focus-visible:outline-none"
            >
              {replay ? `Vật phẩm đã có: ${item.name}` : `Bạn nhận được: ${item.name}`}
            </h2>
            <p className="mt-sm max-w-xl font-ui text-body-md text-ink-dilute">
              {item.description}
            </p>
            {/* Ghi công ảnh vật phẩm. Năm vật phẩm seed là chỗ DUY NHẤT hôm nay thật sự
                có ảnh kèm credit, nên thiếu dòng này thì điều kiện BY của CC BY-SA không
                được thỏa ở đúng chỗ nó có hiệu lực. `GhiCongAnh` tự quyết định bọc liên
                kết hay in nguyên văn — xem lý do trong chính component đó. */}
            {item.image && (
              // Ba class, ba lý do đo được:
              //   `text-ink-dilute` — `secondary` trên nền phòng chỉ đạt 3.38:1, đúng
              //     thứ DESIGN.md § Do's and Don'ts cấm thẳng ("Don't dùng `secondary` … làm
              //     màu chữ trên nền tối của căn phòng"). Cặp đúng đo được 11.57:1 trên
              //     `surface-room` và 10.76:1 trên `surface-reader`.
              //   `max-w-xl` — dòng này từng rộng 784px, rộng hơn cả câu mô tả nó chú thích
              //     (547px) và rộng nhất màn hình. Cùng mép với câu mô tả ngay trên.
              //   `mt-md` — thang khe dọc phải là 12px (tiêu đề→mô tả) < 16px (mô tả→ghi
              //     công) < 24px (→dòng mở khóa). `mt-xs` cũ chỉ 4px nên dòng ghi công đọc
              //     ra như dòng thứ hai của mô tả.
              // Giữ nguyên việc in nguyên văn, không bọc `<a>` — lý do ở chính `GhiCongAnh`.
              <GhiCongAnh
                credit={item.imageCredit}
                nguon={item.imageSource}
                className="mt-md max-w-xl text-ink-dilute"
              />
            )}
          </div>
        </>
      )}

      <div className={`${anim(s.dropUnlock)} flex flex-col items-center gap-md`}>
        {nextBook && (
          <p className="flex items-center gap-sm font-ui text-body-md text-son">
            <LockOpen aria-hidden className="h-5 w-5" />
            {result.nextBook?.unlocked
              ? `“${nextBook.title}” đã mở khóa trên kệ.`
              : `“${nextBook.title}” vẫn cần vật phẩm khác để mở.`}
          </p>
        )}
        {!nextBook && (
          <p className="font-ui text-body-md text-son">
            Bạn đã đọc hết kệ sách này.
          </p>
        )}

        {/* Liên kết chéo (content.md §7). `book.baiGiang` do `readShelf()` gắn sẵn và
            policy `read published` đã lọc bản nháp, nên khối này chỉ hiện khi thật sự có
            bài giảng đã xuất bản để tới — không hứa suông rồi dẫn vào trang rỗng. */}
        {book.baiGiang.length > 0 && (
          <Link
            href={`/bai-giang#bai-${book.baiGiang[0].slug}`}
            className={QUIET_BUTTON}
          >
            <GraduationCap aria-hidden className="h-5 w-5" />
            {book.baiGiang.length === 1
              ? `Xem slide & sơ đồ tư duy: ${book.baiGiang[0].title}`
              : `Xem ${book.baiGiang.length} bài giảng của chương này`}
          </Link>
        )}

        <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
          Quay lại kệ sách
        </button>
      </div>
    </div>
  );
}
