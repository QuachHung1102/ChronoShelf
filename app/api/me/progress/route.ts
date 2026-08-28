import { QueryTypes } from "sequelize";
import { getSessionUserId } from "@/lib/auth/session";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { fail, ok, readJson, str } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/progress — lưu trang đang đọc.
 *
 * KHÔNG đi qua hàm SECURITY DEFINER, và đó là chủ ý: đây không phải điểm chống gian
 * lận. Người dùng tự đặt `current_page` thành 99 cũng chỉ tự tua sách của mình; việc
 * trao vật phẩm vẫn do `complete_book` quyết định, và nó tự đếm số trang thật.
 *
 * Chưa đăng nhập trả `{ saved: false }` với mã 200: đọc sách khi chưa đăng nhập là
 * hợp lệ, chỉ là tiến độ không lưu được.
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return ok({ saved: false });

  const body = await readJson(req);
  const bookSlug = str(body, "bookSlug", 200);
  const page = body?.page;
  if (!bookSlug) return fail("Thiếu bookSlug.");
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1) {
    return fail("Số trang phải là số nguyên từ 1 trở lên.");
  }

  try {
    await withRole(userId, (t) =>
      // Upsert bằng SQL thô chứ không dùng `Model.upsert()`: upsert của Sequelize ghi
      // LẠI MỌI CỘT, mà role chronoshelf_auth chỉ có `GRANT UPDATE (current_page)` —
      // nó sẽ đâm vào quyền cột và hỏng. Câu lệnh này chỉ chạm đúng cột được phép.
      sequelize.query(
        `INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
              VALUES ($1, $2, $3)
         ON CONFLICT (user_id, book_slug)
         DO UPDATE SET current_page = EXCLUDED.current_page`,
        { bind: [userId, bookSlug, page], transaction: t, type: QueryTypes.INSERT },
      ),
    );
  } catch (e) {
    // Khóa ngoại hỏng = slug sách không tồn tại. Mọi thứ khác là lỗi thật của ta.
    if (e && typeof e === "object" && "name" in e && e.name === "SequelizeForeignKeyConstraintError") {
      return fail("Không có quyển sách nào mang slug đó.", 404);
    }
    console.error("POST /api/me/progress:", e);
    return fail("Không lưu được tiến độ đọc.", 500);
  }

  return ok({ saved: true });
}
