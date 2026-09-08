"use client";

import { Room } from "@/components/Room";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import type { ShelfView } from "@/lib/api/types";
import { BookCover } from "./BookCover";
import s from "./BookShelf.module.scss";

export function BookShelf({
  shelf,
  onOpenBook,
  justUnlockedSlugs,
}: {
  shelf: ShelfView;
  onOpenBook: (bookSlug: string) => void;
  /** Slug những quyển vừa chuyển từ khóa sang mở trong lượt refresh vừa rồi. */
  justUnlockedSlugs?: Set<string>;
}) {
  const tong = shelf.books.length;
  const daDoc = shelf.books.filter((b) => b.state === "completed").length;
  const daMo = shelf.books.filter((b) => b.state !== "locked").length;

  /**
   * Quyển nên đọc tiếp — quyển ĐẦU TIÊN đã mở mà chưa đọc xong.
   *
   * Tính ở đây, một lần cho cả kệ, chứ không để từng bìa tự quyết: điều kiện cũ
   * (`!isLocked && !isCompleted` tính tại chỗ) làm CẢ kệ cùng phát sáng trên một kệ admin
   * vừa tạo, vì lúc đó chưa quyển nào có vật phẩm thưởng nên `resolveState` trả "unlocked"
   * cho tất cả. DESIGN.md § Quầng sáng mời gọi: "Một màn hình có hai quầng sáng là một màn
   * hình không có chỉ dẫn nào."
   */
  const nextBook = shelf.books.find((b) => b.state === "unlocked") ?? null;

  return (
    <Room className="flex flex-1 flex-col" anhNen={shelf.cover}>
      {/* justify-center: tủ sách nằm giữa khung nhìn thay vì dồn lên đỉnh trang và
          bỏ trống hai phần ba phía dưới như bản trước. */}
      <section className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col justify-center gap-lg px-page-margin py-xl">
        {/* Hai cột: khối tên kệ bên trái, chỉ dẫn "đọc gì tiếp" bên phải. Bản trước chỉ có
            cột trái, nên khoảng 68% bề ngang khối tiêu đề bỏ trống — trong khi câu hỏi
            quan trọng nhất của màn hình ("đọc quyển nào tiếp theo") lại không được VIẾT RA
            ở đâu cả, chỉ có quầng sáng cam ngụ ý. */}
        <header className="flex items-end justify-between gap-xl">
          <div className="min-w-0">
            <p className="font-body text-label-caps uppercase text-tertiary-light">Kệ sách</p>
            <h1 className="mt-sm font-heading text-headline-lg text-on-primary">{shelf.name}</h1>
            {/* Giới thiệu ngắn admin soạn ở /quan-tri. Trước đây trường này có trong
                database và có ô nhập trong khu quản trị, nhưng KHÔNG BAO GIỜ hiện ra trang
                công khai — nên màn kệ không nói một chữ nào về việc kệ này dạy gì. */}
            {shelf.blurb && (
              <p className="mt-sm max-w-measure font-body text-body-md text-secondary-light">
                {shelf.blurb}
              </p>
            )}
            {/* Ghi công ảnh nền căn phòng. Ảnh là bối cảnh chứ không phải nội dung, nhưng
                điều kiện BY của giấy phép không phân biệt hai thứ đó. */}
            {shelf.cover && (
              <GhiCongAnh
                nhan="Ảnh nền"
                credit={shelf.coverCredit}
                nguon={shelf.coverSource}
                className="mt-xs font-body text-caption text-secondary-light"
              />
            )}
          </div>

          <div className="w-[280px] shrink-0">
            <p className="font-body text-label-caps uppercase text-tertiary-light">
              {/* `tong === 0` phải xét TRƯỚC: kệ rỗng có `daDoc === tong` (0 === 0) nên
                  bản trước chúc mừng người dùng đã đọc hết một cái kệ không có quyển nào. */}
              {tong === 0 ? "Kệ này" : nextBook ? "Đọc tiếp" : "Đã xong cả kệ"}
            </p>
            <p className="mt-xs font-heading text-headline-sm text-on-primary">
              {tong === 0
                ? "Chưa có sách"
                : nextBook
                  ? nextBook.book.title
                  : "Bạn đã đọc hết"}
            </p>
            <div className="mt-sm flex items-center gap-sm">
              <div
                className={`${s.meter} flex-1`}
                role="img"
                aria-label={`Đã đọc xong ${daDoc} trên ${tong} quyển`}
              >
                <div
                  className={s.meterFill}
                  style={{ width: `${tong ? (daDoc / tong) * 100 : 0}%` }}
                />
              </div>
              <span className="font-body text-caption text-secondary-light">
                {daDoc}/{tong}
              </span>
            </div>
            <p className="mt-xs font-body text-caption text-secondary-light">
              Đã mở {daMo}/{tong} quyển. Quyển đang khóa mở ra khi bạn đọc xong quyển trước
              nó.
            </p>
          </div>
        </header>

        <div className={s.cabinet}>
          <div aria-hidden className={s.cornice} />
          <div className={s.bay}>
            {/* Tấm ván nay là NỀN LẶP của chính hàng sách, không còn là một phần tử riêng
                nằm sau nó — nhờ vậy mỗi tầng lưới tự có ván của mình khi sách xuống dòng. */}
            <ul role="list" className={s.row}>
              {shelf.books.map((view, index) => (
                <li key={view.book.slug}>
                  <BookCover
                    view={view}
                    index={index}
                    onOpen={onOpenBook}
                    justUnlocked={justUnlockedSlugs?.has(view.book.slug) ?? false}
                    isNext={nextBook?.book.slug === view.book.slug}
                  />
                </li>
              ))}
            </ul>

            {/* Tầng dưới là trang trí: không quyển nào bấm được, không quyển nào mang
                thông tin — nên cả tầng bị ẩn khỏi trình đọc màn hình. */}
            <div aria-hidden className={s.shelfLower}>
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} className={s.tome} />
              ))}
              <span className={s.stack} />
            </div>
            <div aria-hidden className={s.plankLower} />
          </div>
        </div>
      </section>
    </Room>
  );
}
