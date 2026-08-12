"use client";

import { Check, Lock } from "lucide-react";
import type { BookView } from "@/lib/insforge/types";
import s from "./BookCover.module.scss";

const COVER = "flex h-60 w-full flex-col rounded-md p-md text-left";

export function BookCover({
  view,
  onOpen,
}: {
  view: BookView;
  onOpen: (bookSlug: string) => void;
}) {
  const { book, state, requiredItem } = view;

  if (state === "locked") {
    const hint = requiredItem ? `Cần ${requiredItem.name} để mở` : "Chưa mở khóa";
    return (
      <div className={`${s.slot} flex flex-col items-center gap-sm`}>
        <div
          className={`${COVER} items-center justify-center gap-sm border border-surface-shelf bg-surface-locked`}
          aria-label={`${book.title} — ${hint}`}
        >
          <Lock aria-hidden className="h-8 w-8 text-on-primary opacity-80" />
          <p className="text-center font-heading text-title-book text-on-primary opacity-70">
            {book.title}
          </p>
        </div>
        <p className="text-center font-body text-caption italic text-secondary">{hint}</p>
      </div>
    );
  }

  const isCompleted = state === "completed";

  return (
    <div className={`${s.slot} flex flex-col items-center gap-sm`}>
      <button
        type="button"
        onClick={() => onOpen(book.slug)}
        aria-label={
          isCompleted ? `Đọc lại: ${book.title} (đã đọc xong)` : `Mở đọc: ${book.title}`
        }
        className={`${COVER} cursor-pointer justify-between bg-primary transition-transform duration-200 ease-out hover:-translate-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
          isCompleted ? "" : s.glow
        }`}
      >
        {isCompleted && (
          <span className="flex justify-end">
            <span className="flex h-lg w-lg items-center justify-center rounded-full bg-tertiary-deep">
              <Check aria-hidden className="h-3.5 w-3.5 text-on-primary" />
            </span>
          </span>
        )}
        <p className="mt-auto text-center font-heading text-title-book text-on-primary">
          {book.title}
        </p>
      </button>
      <p className="text-center font-body text-caption italic text-secondary">
        {isCompleted ? "Đã đọc xong" : "Sẵn sàng để đọc"}
      </p>
    </div>
  );
}
