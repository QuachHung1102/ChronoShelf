"use client";

import { Check, Lock } from "lucide-react";
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
  const opened = shelf.books.filter((b) => b.state !== "locked").length;

  return (
    <Room className="flex flex-1 flex-col" anhNen={shelf.cover}>
      {/* justify-center: tủ sách nằm giữa khung nhìn thay vì dồn lên đỉnh trang và
          bỏ trống hai phần ba phía dưới như bản trước. */}
      <section className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col justify-center gap-lg px-page-margin py-xl">
        <header>
          <p className="font-body text-label-caps uppercase text-tertiary-light">Kệ sách</p>
          <h1 className="mt-sm font-heading text-headline-lg text-on-primary">{shelf.name}</h1>
          <p className="mt-xs font-body text-body-md text-secondary-light">
            Bạn đã mở {opened}/{shelf.books.length} quyển
          </p>
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
        </header>

        <div className={s.cabinet}>
          <div aria-hidden className={s.cornice} />
          <div className={s.bay}>
            <ul className={s.row}>
              {shelf.books.map((view, index) => (
                <li key={view.book.slug}>
                  <BookCover
                    view={view}
                    index={index}
                    onOpen={onOpenBook}
                    justUnlocked={justUnlockedSlugs?.has(view.book.slug) ?? false}
                  />
                </li>
              ))}
            </ul>
            <div aria-hidden className={s.plank} />

            {/* Tầng dưới là trang trí: không quyển nào bấm được, không quyển nào mang
                thông tin — nên cả tầng bị ẩn khỏi trình đọc màn hình. */}
            <div aria-hidden className={s.shelfLower}>
              {Array.from({ length: 22 }, (_, i) => (
                <span key={i} className={s.tome} />
              ))}
              <span className={s.stack} />
            </div>
            <div aria-hidden className={`${s.plank} ${s.plankLower}`} />
          </div>
        </div>

        <ul className="flex list-none flex-wrap items-center gap-lg font-body text-caption text-secondary-light">
          <li className="flex items-center gap-xs">
            <Lock aria-hidden className="h-4 w-4" />
            Đang khóa — cần vật phẩm của quyển trước
          </li>
          <li className="flex items-center gap-xs">
            <span aria-hidden className="h-4 w-4 rounded-sm border-2 border-tertiary" />
            Sẵn sàng để đọc
          </li>
          <li className="flex items-center gap-xs">
            <span
              aria-hidden
              className="flex h-4 w-4 items-center justify-center rounded-full bg-tertiary-deep"
            >
              <Check className="h-2.5 w-2.5 text-on-primary" />
            </span>
            Đã đọc xong
          </li>
        </ul>
      </section>
    </Room>
  );
}
