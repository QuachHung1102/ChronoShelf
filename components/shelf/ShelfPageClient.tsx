"use client";

import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookReaderModal } from "@/components/reader/BookReaderModal";
import { findBook } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
import { onAuthChange } from "@/lib/api/auth";
import { buildShelfView, getUserShelfState } from "@/lib/api/shelf";
import type { UserShelfState } from "@/lib/api/types";
import type { UserStatePlain } from "@/lib/content/user-state";
import { ShelfBasin } from "./ShelfBasin";

/** Chưa đăng nhập: kệ vẫn xem được, chỉ quyển đầu mở và tiến độ không lưu. */
const SIGNED_OUT: UserShelfState = {
  ownedItemSlugs: new Set(),
  progressByBook: new Map(),
  streak: 0,
};

/**
 * Dựng `UserShelfState` từ hình dạng THUẦN mà cả server component lẫn `/api/me/state`
 * cùng trả về. Một hàm dựng duy nhất cho hai đường đọc — hai đường mà dựng riêng là cách
 * chắc chắn nhất để chúng trôi xa nhau.
 */
function dungTrangThai(plain: UserStatePlain): UserShelfState {
  return {
    streak: plain.streak ?? 0,
    ownedItemSlugs: new Set(plain.ownedItemSlugs),
    progressByBook: new Map(
      plain.progress.map((p) => [p.bookSlug, { currentPage: p.currentPage, completed: p.completed }]),
    ),
  };
}

/**
 * Nội dung tới từ server component qua prop; chỉ trạng thái người dùng (vật phẩm,
 * tiến độ) mới phải hỏi máy chủ.
 *
 * Phần đó vẫn chạy phía client, nhưng nay vì lý do KHÁC trước: cookie `httpOnly` thì
 * server đọc được, nên về mặt kỹ thuật gộp được vào server component. Không gộp vì
 * trạng thái này phải làm mới lại NGAY sau khi đọc xong một quyển (nhận vật phẩm →
 * mở khóa quyển sau) và sau khi đăng nhập ở header — cả hai đều không đổi route.
 */
export function ShelfPageClient({
  shelf,
  pigmentIndex = 0,
  trangThaiBanDau,
}: {
  shelf: ContentShelf;
  /** Vị trí kệ trong danh sách — quyết định sắc tố mực của chậu. */
  pigmentIndex?: number;
  /** Trạng thái người dùng đọc sẵn ở server, để lần sơn đầu tiên không vẽ sai. */
  trangThaiBanDau?: UserStatePlain;
}) {
  const [userState, setUserState] = useState<UserShelfState>(() =>
    trangThaiBanDau ? dungTrangThai(trangThaiBanDau) : SIGNED_OUT,
  );
  const [openBookSlug, setOpenBookSlug] = useState<string | null>(null);
  const [justUnlockedSlugs, setJustUnlockedSlugs] = useState<Set<string>>(new Set());
  const [stateError, setStateError] = useState<string | null>(null);

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
        // Xóa lỗi cũ khi lấy lại được: `refresh()` chạy ít nhất ba dịp (mount, đổi phiên,
        // đóng trình đọc), nên nếu chỉ đặt mà không bao giờ xóa thì một cú nấc duy nhất
        // để lại băng lỗi vĩnh viễn trên màn hình — nói dối theo chiều ngược lại.
        setStateError(null);
        setUserState(next);
      })
      // Lỗi ở đây KHÔNG có nghĩa "chưa đăng nhập": `/api/me/state` trả 200 với danh sách
      // rỗng cho người chưa đăng nhập, kể cả khi cookie phiên hỏng. Nhánh này chỉ chạy khi
      // lỗi thật — 500, mất mạng, JSON hỏng. Đặt `SIGNED_OUT` ở đây sẽ khóa lại cả kệ ngay
      // sau khi học sinh vừa nhận vật phẩm, nên giữ nguyên trạng thái đang có và nói ra.
      // (`SIGNED_OUT` vẫn là giá trị khởi tạo nên lần tải đầu tiên hỏng vẫn hiện đúng.)
      .catch(() => setStateError("Không tải được tiến độ. Tải lại trang để xem đúng trạng thái."));
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
      {/* Vùng aria-live phải CÓ MẶT SẴN, rỗng nhưng vẫn hiện.
          `empty:hidden` là `display: none`, mà `display: none` gỡ phần tử khỏi cây trợ
          năng — nên khi lỗi xuất hiện thì nội dung VÀ việc hiện lại rơi vào cùng một lần
          cập nhật DOM, và trình đọc màn hình coi đó là một vùng live vừa được THÊM chứ
          không phải một thay đổi, rồi thường bỏ qua. Đây đúng là cái bẫy CLAUDE.md đã ghi
          và repo đã tự cấm ở hai file khác. Vùng rỗng cao 0px nên không chiếm chỗ. */}
      <p aria-live="polite">
        {stateError && (
          <span className="flex items-start gap-xs bg-son px-page-margin py-sm font-ui text-body-sm text-on-son">
            <AlertCircle aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0" />
            {stateError}
          </span>
        )}
      </p>
      <ShelfBasin
        shelf={view}
        pigmentIndex={pigmentIndex}
        onOpenBook={setOpenBookSlug}
        justUnlockedSlugs={justUnlockedSlugs}
      />
      {openBook && findBook(shelf, openBook.book.slug) && (
        <BookReaderModal
          shelf={shelf}
          bookSlug={openBook.book.slug}
          startPage={openBook.currentPage}
          // Đọc LẠI một quyển đã xong thì không phải làm lại bài kiểm tra: `complete_book`
          // cũng bỏ qua phần chấm bài trong trường hợp đó (nhánh `alreadyCompleted`), nên
          // hiện bài kiểm tra ở đây chỉ là bắt học sinh gõ lại một thứ máy chủ không hỏi.
          daHoanThanh={openBook.state === "completed"}
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
