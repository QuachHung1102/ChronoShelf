import { QueryTypes } from "sequelize";
import { getSessionUserId } from "@/lib/auth/session";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { fail, ok, readJson, str } from "@/lib/api/respond";
import type { CompleteBookResult } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * Số câu tối đa một bài kiểm tra có thể có, chốt ngay tại biên.
 *
 * Ràng buộc thật nằm ở database (`book_questions` chỉ có ngần này dòng cho một quyển
 * nếu admin soạn ngần ấy), nhưng mảng đáp án đến từ trình duyệt nên nó có thể dài tùy
 * ý — và nó đi thẳng vào một bind của Postgres. 50 là rộng rãi gấp nhiều lần con số
 * 2–3 mà content.md §4.3 mô tả.
 */
const MAX_ANSWERS = 50;

/**
 * Trần của `smallint` trong Postgres. Đây là RÀNG BUỘC KIỂU, không phải số lựa chọn tối đa
 * của một câu hỏi — và sự khác biệt đó là có chủ ý.
 *
 * Bản đầu chốt ở `x < 4`, tức là chép lại `MAX_CHOICES` thành BẢN SAO THỨ TƯ mà ba bản kia
 * (`lib/admin/actions.ts`, `components/admin/QuestionAdmin.tsx`, `book_questions_choices_ck`)
 * không hề nhắc tới. Ngày nào nâng số lựa chọn lên 5, cả ba chỗ được sửa đúng còn chỗ này
 * âm thầm biến đáp án thứ 5 thành `-1` — học sinh chọn đúng vẫn bị chấm sai, không lỗi ở đâu
 * cả. Nay ở đây không còn hằng số nào để mà trôi: một chỉ số ngoài phạm vi thì SAI, chấm hết,
 * và việc nó sai vì lý do gì thì `correct_index` tự trả lời.
 */
const SMALLINT_MAX = 32767;

/**
 * Đọc mảng đáp án: chỉ số 0-based, song song với `book.cauHoi`.
 *
 * Mọi phần tử không phải số nguyên không âm đều thành `-1` — một chỉ số KHÔNG BAO GIỜ khớp
 * `correct_index` (ràng buộc `book_questions_correct_range_ck` bắt nó phải >= 0). Nhờ vậy rác
 * gửi lên chỉ có thể làm bài kiểm tra TRƯỢT, không thể làm nó đạt. Trần `SMALLINT_MAX` ở đây
 * để một con số khổng lồ không làm chính truy vấn nổ khi bind vào `smallint[]`.
 */
function readAnswers(body: Record<string, unknown> | null): number[] {
  const v = body?.answers;
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_ANSWERS)
    .map((x) =>
      typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= SMALLINT_MAX ? x : -1,
    );
}

/**
 * POST /api/me/complete — chốt đã đọc xong một quyển và nộp bài kiểm tra cuối sách.
 *
 * Route này CỐ Ý mỏng: nó không quyết định gì cả. Toàn bộ luật — đã đọc hết trang
 * chưa, sách đã xuất bản chưa, kệ cha đã xuất bản chưa, trả lời đúng chưa, trao vật
 * phẩm nào, quyển kế tiếp đã mở chưa — nằm trong `public.complete_book`, một hàm
 * SECURITY DEFINER.
 *
 * Lý do không chuyển luật đó lên đây: role `chronoshelf_auth` KHÔNG có quyền ghi
 * `user_items`, nên kể cả khi ai đó viết logic trao vật phẩm ở tầng Node thì nó cũng
 * không chạy được. Riêng việc CHẤM BÀI thì còn chặt hơn một bậc — đáp án không có
 * `GRANT SELECT` cho role nào của ứng dụng, nên tầng Node không đọc nổi nó để mà chấm.
 */
export async function POST(req: Request): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return fail("Cần đăng nhập để ghi nhận kết quả đọc.", 401);

  const body = await readJson(req);
  const bookSlug = str(body, "bookSlug", 200);
  if (!bookSlug) return fail("Thiếu bookSlug.");

  try {
    const rows = await withRole(userId, (t) =>
      sequelize.query<{ complete_book: CompleteBookResult }>(
        "SELECT public.complete_book($1, $2::smallint[]) AS complete_book",
        { bind: [bookSlug, readAnswers(body)], transaction: t, type: QueryTypes.SELECT },
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
