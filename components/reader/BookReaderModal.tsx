"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getBook } from "@/lib/content/shelves";
import { completeBook, setCurrentPage } from "@/lib/insforge/shelf";
import type { CompleteBookResult } from "@/lib/insforge/types";
import { ItemDropOverlay } from "./ItemDropOverlay";
import { PageSpread } from "./PageSpread";

const ROUND_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary transition duration-200 ease-out hover:brightness-110 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-reader";

export function BookReaderModal({
  shelfSlug,
  bookSlug,
  startPage,
  onClose,
}: {
  shelfSlug: string;
  bookSlug: string;
  /** Trang đang đọc dở lấy từ tiến độ đã lưu (đánh số từ 1). */
  startPage: number;
  onClose: () => void;
}) {
  const book = getBook(shelfSlug, bookSlug);
  const lastIndex = book.pages.length - 1;

  const [index, setIndex] = useState(() => Math.min(Math.max(startPage - 1, 0), lastIndex));
  const [result, setResult] = useState<CompleteBookResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => dialogRef.current?.focus(), []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next > lastIndex) return;
      setIndex(next);
      // Tiến độ chỉ quyết định lần sau mở lại vào trang nào — lưu hỏng thì vẫn đọc tiếp được.
      void setCurrentPage(bookSlug, next + 1).catch(() => {});
    },
    [bookSlug, lastIndex],
  );

  const finish = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      // RPC chỉ chốt hoàn thành khi current_page đã tới trang cuối — lưu trước rồi mới gọi,
      // nhờ vậy nút "Thử lại" sửa được cả trường hợp lần lưu trước rớt mạng.
      if (!(await setCurrentPage(bookSlug, book.pages.length))) {
        setError("Bạn cần đăng nhập để lưu tiến độ và nhận vật phẩm.");
        return;
      }
      setResult(await completeBook(bookSlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không ghi nhận được kết quả đọc.");
    } finally {
      setBusy(false);
    }
  }, [book.pages.length, bookSlug]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") return onClose();
      if (result) return;
      if (event.key === "ArrowRight") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, index, onClose, result]);

  const isLastPage = index === lastIndex;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Đang đọc: ${book.title}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-surface-reader focus:outline-none"
    >
      <div className="flex items-center justify-between px-page-margin py-md">
        <p className="font-heading text-headline-sm text-on-primary">{book.title}</p>
        <button type="button" onClick={onClose} aria-label="Đóng sách" className={ROUND_BUTTON}>
          <X aria-hidden className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center gap-lg px-page-margin">
        {result ? (
          <ItemDropOverlay result={result} shelfSlug={shelfSlug} onClose={onClose} />
        ) : (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Trang trước"
              className={ROUND_BUTTON}
            >
              <ChevronLeft aria-hidden className="h-6 w-6" />
            </button>

            {/* key={index} để hoạt cảnh lật trang chạy lại mỗi lần đổi trang. */}
            <PageSpread key={index} page={book.pages[index]} />

            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={isLastPage}
              aria-label="Trang sau"
              className={ROUND_BUTTON}
            >
              <ChevronRight aria-hidden className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {!result && (
        <div className="flex flex-col items-center gap-md py-lg">
          <div className="flex items-center gap-md">
            <p
              aria-live="polite"
              className="rounded-full bg-tertiary-deep px-md py-sm font-body text-label-md text-on-primary"
            >
              Trang {index + 1}/{book.pages.length}
            </p>

            {isLastPage && (
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-reader"
              >
                {busy ? "Đang ghi nhận…" : "Đọc xong — nhận vật phẩm"}
              </button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-md rounded-md bg-destructive p-md font-body text-body-sm text-on-destructive"
            >
              {error}
              <button
                type="button"
                onClick={finish}
                disabled={busy}
                className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-destructive"
              >
                Thử lại
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
