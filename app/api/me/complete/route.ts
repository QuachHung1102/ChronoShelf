import { QueryTypes } from "sequelize";
import { getSessionUserId } from "@/lib/auth/session";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { fail, ok, readJson, str } from "@/lib/api/respond";
import type { CompleteBookResult } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/complete — chốt đã đọc xong một quyển.
 *
 * Route này CỐ Ý mỏng: nó không quyết định gì cả. Toàn bộ luật — đã đọc hết trang
 * chưa, sách đã xuất bản chưa, kệ cha đã xuất bản chưa, trao vật phẩm nào, quyển kế
 * tiếp đã mở chưa — nằm trong `public.complete_book`, một hàm SECURITY DEFINER.
 *
 * Lý do không chuyển luật đó lên đây: role `chronoshelf_auth` KHÔNG có quyền ghi
 * `user_items`, nên kể cả khi ai đó viết logic trao vật phẩm ở tầng Node thì nó cũng
 * không chạy được. Cửa duy nhất là hàm kia, và cửa đó tự kiểm tra lại mọi điều kiện.
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return fail("Cần đăng nhập để ghi nhận kết quả đọc.", 401);

  const bookSlug = str(await readJson(req), "bookSlug", 200);
  if (!bookSlug) return fail("Thiếu bookSlug.");

  try {
    const rows = await withRole(userId, (t) =>
      sequelize.query<{ complete_book: CompleteBookResult }>(
        "SELECT public.complete_book($1) AS complete_book",
        { bind: [bookSlug], transaction: t, type: QueryTypes.SELECT },
      ),
    );
    return ok(rows[0].complete_book);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Ba lỗi hàm chủ động ném ra, dịch sang câu người đọc được. Mọi thứ khác là lỗi
    // của ta và không được lộ nguyên văn ra ngoài.
    if (message.includes("Book not found")) return fail("Không tìm thấy quyển sách này.", 404);
    if (message.includes("Book has no pages")) return fail("Quyển sách này chưa có trang nào.", 409);
    if (message.includes("Book not finished yet")) {
      return fail("Chưa đọc hết quyển sách này.", 409);
    }
    console.error("POST /api/me/complete:", e);
    return fail("Không ghi nhận được kết quả đọc.", 500);
  }
}
