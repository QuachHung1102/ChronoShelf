"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { getUserShelfState } from "@/lib/api/shelf";
import { resolveState } from "@/lib/api/unlock";
import { FOCUS_RING } from "@/components/ui/controls";
import type { ShelfChain } from "@/lib/content/read";
import s from "./home.module.scss";

/**
 * Ba lối vào kệ ở cuối trang chủ, kèm chỉ báo "Bạn đã mở x/n quyển" (content.md §5.1).
 *
 * Phần TĨNH (chuỗi sách) do server component truyền xuống; phần ĐỘNG (túi vật phẩm) lấy
 * qua `/api/me/state`. Tách như vậy vì trang chủ là `force-dynamic` nhưng vẫn nên trả HTML
 * đầy đủ ngay cả khi request tới `/api/me/state` hỏng — lối vào kệ là thứ KHÔNG được biến
 * mất chỉ vì mạng nấc.
 *
 * MỖI THẺ LÀ MẶT TRƯỚC CỦA MỘT KỆ GỖ, không phải một hộp viền mảnh trên nền giấy. Ba thẻ
 * trước đây là `bg-surface` + `border` 1px, tức cùng hạng với mọi ô nội dung khác trên
 * trang, trong khi chúng là hành động chính của cả trang chủ. DESIGN.md § Elevation nói
 * thẳng cách nâng một cái thẻ: "câu trả lời là đổi tông màu chứ không phải thêm bóng" — và
 * tông đúng ở đây là `shelf` (`primary-dark`, `rounded-lg`), vì thứ nằm sau cánh cửa này
 * đúng là một cái kệ.
 */
export function ShelfProgress({ shelves }: { shelves: ShelfChain[] }) {
  const [owned, setOwned] = useState<Set<string> | null>(null);
  const [doneBooks, setDoneBooks] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    getUserShelfState()
      // Tham số tên `trangThai` chứ không phải `s`: `s` đã là module SCSS ở phạm vi ngoài.
      .then((trangThai) => {
        if (!alive) return;
        setOwned(trangThai.ownedItemSlugs);
        setDoneBooks(
          new Set(
            [...trangThai.progressByBook].filter(([, p]) => p.completed).map(([slug]) => slug),
          ),
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
              // Hover sáng lên một bậc (`primary-dark` → `primary`) chứ không đổi viền: cả
              // thẻ là mặt gỗ, nên tín hiệu đúng là gỗ bắt sáng thêm. Vòng focus vẫn dùng
              // `ring` trên nền `neutral` vì nó vẽ NGOÀI thẻ, trên nền trang.
              className={`group flex h-full flex-col justify-between gap-xl rounded-lg bg-primary-dark p-lg transition-colors duration-200 ease-out hover:bg-primary active:bg-surface-shelf ${FOCUS_RING}`}
            >
              <span className="flex flex-col gap-md">
                <BookOpen aria-hidden className="h-lg w-lg text-secondary-light" />
                <span className="text-balance font-heading text-headline-sm text-on-primary">{shelf.name}</span>
              </span>

              <span className="flex flex-col gap-sm">
                {/* Thước đo chỉ vẽ khi đã biết trạng thái. `aria-hidden` vì đúng con số
                    đó nằm trong câu chữ ngay bên dưới — trình đọc màn hình không mất gì. */}
                {daMo !== null && shelf.books.length > 0 && (
                  <span aria-hidden className={s.thuoc}>
                    <span
                      className={s.thuocDay}
                      style={{ width: `${(daMo / shelf.books.length) * 100}%` }}
                    />
                  </span>
                )}

                <span className="flex items-center justify-between gap-sm font-body text-body-sm text-secondary-light">
                  {/* Chưa biết trạng thái thì nói số quyển, đừng đoán "0/n" — với người
                      chưa đăng nhập thì quyển đầu vẫn mở, nên "0" là sai. */}
                  {daMo === null
                    ? `${shelf.books.length} quyển`
                    : `Bạn đã mở ${daMo}/${shelf.books.length} quyển`}
                  {/* `motion-reduce:` là bắt buộc, không phải phần thêm (DESIGN.md § Motion).
                      Thẻ vẫn đổi nền khi hover nên tín hiệu không mất ở chế độ giảm động. */}
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-tertiary-light transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  />
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
