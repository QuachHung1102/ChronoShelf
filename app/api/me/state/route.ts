import { getSessionUserId } from "@/lib/auth/session";
import { withRole } from "@/lib/db/tx";
import { UserBookProgress, UserItem } from "@/lib/db/models";
import { ok } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/state — vật phẩm đang sở hữu và tiến độ đọc.
 *
 * Chưa đăng nhập trả về rỗng với mã 200, không phải 401: kệ sách vẫn xem được khi
 * chưa đăng nhập, chỉ là quyển đầu mở và không có tiến độ nào. Đó là trạng thái hợp
 * lệ của sản phẩm, không phải lỗi.
 *
 * Không có mệnh đề `where user_id = …` nào ở đây, và đó KHÔNG phải thiếu sót: policy
 * "own items select" / "own progress select" lọc theo `app.current_user_id()`. Thêm
 * `where` vào chỉ là chép lại điều kiện đã có ở tầng dưới, và tạo ảo giác rằng chính
 * nó mới là hàng rào.
 */
export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return ok({ ownedItemSlugs: [], progress: [] });

  const { items, progress } = await withRole(userId, async (t) => ({
    items: await UserItem.findAll({ attributes: ["itemSlug"], transaction: t }),
    progress: await UserBookProgress.findAll({
      attributes: ["bookSlug", "currentPage", "completed"],
      transaction: t,
    }),
  }));

  return ok({
    ownedItemSlugs: items.map((i) => i.itemSlug),
    progress: progress.map((p) => ({
      bookSlug: p.bookSlug,
      currentPage: p.currentPage,
      completed: p.completed,
    })),
  });
}
