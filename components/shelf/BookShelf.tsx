"use client";

import { Check, Lock } from "lucide-react";
import type { ShelfView } from "@/lib/insforge/types";
import { BookCover } from "./BookCover";

export function BookShelf({
  shelf,
  onOpenBook,
}: {
  shelf: ShelfView;
  onOpenBook: (bookSlug: string) => void;
}) {
  const opened = shelf.books.filter((b) => b.state !== "locked").length;

  return (
    <section className="px-page-margin py-xl">
      <p className="font-body text-label-caps uppercase text-tertiary-deep">Kệ sách</p>
      <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">{shelf.name}</h1>
      <p className="mt-xs font-body text-body-md text-secondary">
        Bạn đã mở {opened}/{shelf.books.length} quyển
      </p>

      <div className="mt-lg rounded-lg bg-primary-dark pt-xl">
        {/* items-start chứ không phải items-end: mọi bìa cao bằng nhau nên chúng vẫn
            đứng thẳng hàng trên ván, còn dòng gợi ý dài ngắn khác nhau không đội bìa lên. */}
        <ul className="flex list-none items-start justify-center gap-shelf-gap px-xl">
          {shelf.books.map((view) => (
            <li key={view.book.slug}>
              <BookCover view={view} onOpen={onOpenBook} />
            </li>
          ))}
        </ul>
        {/* Tấm ván kệ để góc vuông — nó là thanh gỗ, không phải cái thẻ (DESIGN.md § Shapes). */}
        <div className="mt-md h-md w-full bg-surface-shelf" />
      </div>

      <ul className="mt-md flex list-none flex-wrap items-center gap-lg font-body text-caption text-secondary">
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
  );
}
