import { UserActivity, UserBookProgress, UserItem } from "@/lib/db/models";
import { getSessionUserId } from "@/lib/auth/session";
import { withRole } from "@/lib/db/tx";
import { homNayVietNam, tinhStreak } from "@/lib/streak";

/**
 * Trạng thái người dùng ở dạng THUẦN (mảng, không Set/Map) để server component truyền
 * xuống client component được — Set và Map không đi qua ranh giới RSC.
 *
 * VÌ SAO CÓ FILE NÀY. Màn kệ sách vẽ trạng thái người dùng ở phía client: `ShelfPageClient`
 * khởi tạo bằng `SIGNED_OUT` rồi mới gọi `/api/me/state`. Nghĩa là lần sơn ĐẦU TIÊN của mọi
 * lượt vào kệ luôn SAI — hiện "đã mở 1/5 quyển", bốn bìa đeo ổ khóa, quầng sáng cam nằm ở
 * quyển đầu — rồi một nhịp sau mới nhảy sang trạng thái thật, và quầng sáng dẫn đường nhảy
 * chỗ ngay trước mắt người học. Phiên nằm trong cookie `httpOnly` nên máy chủ THỪA SỨC biết
 * câu trả lời đúng ngay từ lần sơn đầu.
 *
 * Client VẪN gọi lại `/api/me/state` sau đó, và đó không phải việc thừa: trạng thái phải
 * làm mới ngay sau khi đọc xong một quyển (nhận vật phẩm → mở khóa quyển sau) và sau khi
 * đăng nhập ở header — cả hai đều không đổi route nên không có lượt render server nào.
 * Giá trị ban đầu này chỉ để lần sơn đầu tiên nói đúng sự thật.
 *
 * Trả về cùng một hình dạng với `GET /api/me/state` để `ShelfPageClient` dùng chung đúng
 * một hàm dựng — hai đường đọc mà lệch hình dạng là cách chắc chắn nhất để chúng trôi xa nhau.
 */
export interface UserStatePlain {
  ownedItemSlugs: string[];
  progress: { bookSlug: string; currentPage: number; completed: boolean }[];
  streak: number;
}

const RONG: UserStatePlain = { ownedItemSlugs: [], progress: [], streak: 0 };

export async function readUserState(): Promise<UserStatePlain> {
  const userId = await getSessionUserId();
  // Chưa đăng nhập là trạng thái HỢP LỆ của sản phẩm — kệ vẫn xem được, chỉ quyển đầu mở.
  if (!userId) return RONG;

  // Cùng một transaction nên phải tuần tự: `Promise.all` trên một transaction của Sequelize
  // gửi hai câu lệnh chồng nhau trên một connection và hỏng (bẫy đã ghi trong CLAUDE.md).
  const { items, progress, ngayHoatDong } = await withRole(userId, async (t) => ({
    items: await UserItem.findAll({ attributes: ["itemSlug"], transaction: t }),
    progress: await UserBookProgress.findAll({
      attributes: ["bookSlug", "currentPage", "completed"],
      transaction: t,
    }),
    ngayHoatDong: await UserActivity.findAll({ attributes: ["activeOn"], transaction: t }),
  }));

  return {
    streak: tinhStreak(
      ngayHoatDong.map((r) => String(r.activeOn)),
      homNayVietNam(),
    ),
    ownedItemSlugs: items.map((i) => i.itemSlug),
    progress: progress.map((p) => ({
      bookSlug: p.bookSlug,
      currentPage: p.currentPage,
      completed: p.completed,
    })),
  };
}
