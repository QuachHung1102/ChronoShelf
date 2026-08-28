"use client";

import { useCallback, useEffect, useState } from "react";
import { BookReaderModal } from "@/components/reader/BookReaderModal";
import { findBook } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
import { onAuthChange } from "@/lib/api/auth";
import { buildShelfView, getUserShelfState } from "@/lib/api/shelf";
import type { UserShelfState } from "@/lib/api/types";
import { BookShelf } from "./BookShelf";

/** Chưa đăng nhập: kệ vẫn xem được, chỉ quyển đầu mở và tiến độ không lưu. */
const SIGNED_OUT: UserShelfState = { ownedItemSlugs: new Set(), progressByBook: new Map() };

/**
 * Nội dung tới từ server component qua prop; chỉ trạng thái người dùng (vật phẩm,
 * tiến độ) mới phải hỏi máy chủ.
 *
 * Phần đó vẫn chạy phía client, nhưng nay vì lý do KHÁC trước: cookie `httpOnly` thì
 * server đọc được, nên về mặt kỹ thuật gộp được vào server component. Không gộp vì
 * trạng thái này phải làm mới lại NGAY sau khi đọc xong một quyển (nhận vật phẩm →
 * mở khóa quyển sau) và sau khi đăng nhập ở header — cả hai đều không đổi route.
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
