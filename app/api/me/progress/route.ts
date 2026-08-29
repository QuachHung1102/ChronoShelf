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

  let affected: number;
  try {
    [, affected] = await withRole(userId, (t) =>
      // Upsert bằng SQL thô chứ không dùng `Model.upsert()`: upsert của Sequelize ghi
      // LẠI MỌI CỘT, mà role chronoshelf_auth chỉ có `GRANT UPDATE (current_page)` —
      // nó sẽ đâm vào quyền cột và hỏng. Câu lệnh này chỉ chạm đúng cột được phép.
      //
      // Nguồn của `book_slug` là `SELECT ... FROM public.books` chứ không phải `VALUES`,
      // và đó là chuyện bảo mật chứ không phải chuyện thẩm mỹ: phép kiểm khóa ngoại của
      // PostgreSQL **bỏ qua row-level security** (tài liệu PG, mục Row Security Policies:
      // "Referential integrity checks ... always bypass row security"). Để khóa ngoại trả
      // lời thì INSERT với slug của một quyển CHƯA XUẤT BẢN vẫn thành công, còn slug bịa
      // thì nổ 23503 — hai câu trả lời khác nhau biến endpoint này thành máy dò slug sách
      // nháp. Cho câu lệnh tự đi qua policy "read published": sách nháp trúng 0 dòng y hệt
      // slug không tồn tại.
      sequelize.query(
        `INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
         SELECT $1, b.slug, $3 FROM public.books b WHERE b.slug = $2
         ON CONFLICT (user_id, book_slug)
         DO UPDATE SET current_page = EXCLUDED.current_page`,
        { bind: [userId, bookSlug, page], transaction: t, type: QueryTypes.INSERT },
      ),
    );
  } catch (e) {
    console.error("POST /api/me/progress:", e);
    return fail("Không lưu được tiến độ đọc.", 500);
  }

  // 0 dòng = quyển đó không tồn tại, HOẶC người này không được phép nhìn thấy nó. Một
  // câu trả lời duy nhất cho cả hai trường hợp — phân biệt chúng chính là lỗ rò rỉ.
  if (affected === 0) return fail("Không có quyển sách nào mang slug đó.", 404);

  return ok({ saved: true });
}
