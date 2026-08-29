"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getUserShelfState } from "@/lib/api/shelf";
import { resolveState } from "@/lib/api/unlock";
import type { ShelfChain } from "@/lib/content/read";

/**
 * Ba lối vào kệ ở cuối trang chủ, kèm chỉ báo "Bạn đã mở x/n quyển" (content.md §5.1).
 *
 * Phần TĨNH (chuỗi sách) do server component truyền xuống; phần ĐỘNG (túi vật phẩm) lấy
 * qua `/api/me/state`. Tách như vậy vì trang chủ là `force-dynamic` nhưng vẫn nên trả HTML
 * đầy đủ ngay cả khi request tới `/api/me/state` hỏng — lối vào kệ là thứ KHÔNG được biến
 * mất chỉ vì mạng nấc.
 */
export function ShelfProgress({ shelves }: { shelves: ShelfChain[] }) {
  const [owned, setOwned] = useState<Set<string> | null>(null);
  const [doneBooks, setDoneBooks] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    getUserShelfState()
      .then((s) => {
        if (!alive) return;
        setOwned(s.ownedItemSlugs);
        setDoneBooks(
          new Set([...s.progressByBook].filter(([, p]) => p.completed).map(([slug]) => slug)),
        );
      })
      // Lỗi truyền tải KHÔNG phải "chưa mở quyển nào" — cùng bài học với C07/AuthMenu.
      // Giữ `owned` ở null nghĩa là "chưa biết", và phần chỉ báo im lặng thay vì nói dối.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ul className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
      {shelves.map((shelf) => {
        const daMo =
          owned === null
            ? null
            : shelf.books.filter((book, i) =>
                resolveState(
                  i === 0 ? null : shelf.books[i - 1].rewardItemSlug,
                  i === 0,
                  doneBooks.has(book.slug),
                  owned,
                ) !== "locked",
              ).length;

        return (
          <li key={shelf.slug}>
            <Link
              href={`/${shelf.slug}`}
              className="group flex h-full flex-col justify-between gap-md rounded-md border border-surface-locked bg-surface p-lg transition duration-200 ease-out hover:border-tertiary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
            >
              <span className="font-heading text-headline-sm text-primary-dark">{shelf.name}</span>
              <span className="flex items-center justify-between gap-sm font-body text-body-sm text-secondary">
                {/* Chưa biết trạng thái thì nói số quyển, đừng đoán "0/n" — với người
                    chưa đăng nhập thì quyển đầu vẫn mở, nên "0" là sai. */}
                {daMo === null
                  ? `${shelf.books.length} quyển`
                  : `Bạn đã mở ${daMo}/${shelf.books.length} quyển`}
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-tertiary-deep transition-transform duration-200 ease-out group-hover:translate-x-1"
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
