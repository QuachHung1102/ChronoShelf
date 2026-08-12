"use client";

import { useCallback, useEffect, useState } from "react";
import { BookReaderModal } from "@/components/reader/BookReaderModal";
import { buildShelfView, getUserShelfState } from "@/lib/insforge/shelf";
import type { UserShelfState } from "@/lib/insforge/types";
import { BookShelf } from "./BookShelf";

/** Chưa đăng nhập: kệ vẫn xem được, chỉ quyển đầu mở và tiến độ không lưu. */
const SIGNED_OUT: UserShelfState = { ownedItemSlugs: new Set(), progressByBook: new Map() };

/**
 * Nội dung kệ nằm sẵn trong bundle nên render được ngay; chỉ trạng thái người dùng
 * (vật phẩm, tiến độ) mới phải hỏi backend — và phiên đăng nhập của InsForge nằm ở
 * trình duyệt, nên phần đó bắt buộc chạy phía client.
 */
export function ShelfPageClient({ shelfSlug }: { shelfSlug: string }) {
  const [userState, setUserState] = useState<UserShelfState>(SIGNED_OUT);
  const [openBookSlug, setOpenBookSlug] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getUserShelfState()
      .then(setUserState)
      .catch(() => setUserState(SIGNED_OUT));
  }, []);

  useEffect(refresh, [refresh]);

  const shelf = buildShelfView(shelfSlug, userState);
  const openBook = shelf.books.find((view) => view.book.slug === openBookSlug);

  return (
    <>
      <BookShelf shelf={shelf} onOpenBook={setOpenBookSlug} />
      {openBook && (
        <BookReaderModal
          shelfSlug={shelfSlug}
          bookSlug={openBook.book.slug}
          startPage={openBook.currentPage}
          onClose={() => {
            setOpenBookSlug(null);
            // Đọc xong có thể vừa nhận vật phẩm — lấy lại trạng thái để kệ mở khóa quyển sau.
            refresh();
          }}
        />
      )}
    </>
  );
}
