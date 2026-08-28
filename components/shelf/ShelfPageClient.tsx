"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [justUnlockedSlugs, setJustUnlockedSlugs] = useState<Set<string>>(new Set());

  /**
   * Quyển nào VỪA chuyển từ khóa sang mở.
   *
   * Phải so trạng thái CŨ với MỚI, vì bản thân `view` chỉ nói quyển đang mở hay khóa —
   * không nói nó vừa đổi. Đây là dữ kiện cho chặng thứ ba của chuỗi nhận thưởng (đai sắt
   * bật ra); thiếu nó thì đai chỉ biến mất im lặng cùng lúc state đổi.
   *
   * Giữ trong ref chứ không trong state: nó chỉ dùng để SO, và đưa vào state sẽ tạo thêm
   * một lượt render mà không ai thấy khác biệt.
   */
  const lockedBefore = useRef<Set<string> | null>(null);

  const refresh = useCallback(() => {
    getUserShelfState()
      .then((next) => {
        const nextLocked = new Set(
          buildShelfView(shelf, next)
            .books.filter((b) => b.state === "locked")
            .map((b) => b.book.slug),
        );
        const before = lockedBefore.current;
        // Lượt đầu tiên (`before === null`) KHÔNG tính là vừa mở khóa: lúc đó ta chưa
        // biết gì về quá khứ, và chạy hoạt cảnh cho mọi quyển đang mở là vô nghĩa.
        setJustUnlockedSlugs(
          before === null
            ? new Set()
            : new Set([...before].filter((slug) => !nextLocked.has(slug))),
        );
        lockedBefore.current = nextLocked;
        setUserState(next);
      })
      .catch(() => setUserState(SIGNED_OUT));
  }, [shelf]);

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
      <BookShelf
        shelf={view}
        onOpenBook={setOpenBookSlug}
        justUnlockedSlugs={justUnlockedSlugs}
      />
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
