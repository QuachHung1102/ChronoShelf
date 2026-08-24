"use client";

import { useCallback, useEffect, useState } from "react";
import { BookReaderModal } from "@/components/reader/BookReaderModal";
import { findBook } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
import { onAuthChange } from "@/lib/insforge/auth";
import { buildShelfView, getUserShelfState } from "@/lib/insforge/shelf";
import type { UserShelfState } from "@/lib/insforge/types";
import { BookShelf } from "./BookShelf";

/** Chưa đăng nhập: kệ vẫn xem được, chỉ quyển đầu mở và tiến độ không lưu. */
const SIGNED_OUT: UserShelfState = { ownedItemSlugs: new Set(), progressByBook: new Map() };

/**
 * Nội dung tới từ server component qua prop; chỉ trạng thái người dùng (vật phẩm,
 * tiến độ) mới phải hỏi backend — và phiên đăng nhập của InsForge nằm ở trình duyệt,
 * nên phần đó bắt buộc chạy phía client.
 */
export function ShelfPageClient({ shelf }: { shelf: ContentShelf }) {
  const [userState, setUserState] = useState<UserShelfState>(SIGNED_OUT);
  const [openBookSlug, setOpenBookSlug] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getUserShelfState()
      .then(setUserState)
      .catch(() => setUserState(SIGNED_OUT));
  }, []);

  // Đăng nhập/đăng xuất ở header không đổi route, nên kệ phải tự nghe sự kiện phiên
  // thì mới mở/khóa lại đúng mà người dùng không cần tải lại trang.
  useEffect(() => {
    refresh();
    return onAuthChange(refresh);
  }, [refresh]);

  const view = buildShelfView(shelf, userState);
  const openBook = view.books.find((b) => b.book.slug === openBookSlug);

  return (
    <>
      <BookShelf shelf={view} onOpenBook={setOpenBookSlug} />
      {openBook && findBook(shelf, openBook.book.slug) && (
        <BookReaderModal
          shelf={shelf}
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
