import type { Transaction } from "sequelize";
import { sequelize } from "./sequelize";

/**
 * Mọi lượt chạm database phải đi qua đây.
 *
 * `DATABASE_URL` nối bằng `chronoshelf_app` — role NOINHERIT **không có quyền gì cả**.
 * Quyền chỉ xuất hiện sau `SET LOCAL ROLE`, và biến mất khi transaction kết thúc.
 * Hai hệ quả đáng nhớ:
 *
 * 1. **Quên truyền `t` xuống một truy vấn là hỏng TO và hỏng NGAY** — nó chạy ngoài
 *    transaction, tức là dưới `chronoshelf_app`, và Postgres trả `permission denied`.
 *    Đây là chủ ý: sai sót kiểu đó fail đóng, không âm thầm chạy với quyền rộng hơn.
 *    Vì vậy không cần CLS/AsyncLocalStorage để tự gắn transaction — thứ đó chỉ thêm
 *    một tầng phép thuật để tránh một lỗi vốn đã tự la làng.
 *
 * 2. `SET LOCAL` và `set_config(..., is_local => true)` đều hết hiệu lực lúc
 *    COMMIT/ROLLBACK, nên danh tính không rò rỉ sang request sau dùng chung connection.
 *    Đã kiểm bằng `npm run db:check`.
 */

/** Đúng hai giá trị. Tên role KHÔNG BAO GIỜ đến từ dữ liệu bên ngoài: `SET ROLE` nhận
 *  một định danh nên không tham số hóa được, ghép chuỗi với đầu vào là lỗ SQL injection. */
const ANON = "chronoshelf_anon";
const AUTH = "chronoshelf_auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Chạy `fn` trong một transaction mang đúng danh tính của người gọi.
 * `userId === null` nghĩa là chưa đăng nhập.
 */
export async function withRole<T>(
  userId: string | null,
  fn: (t: Transaction) => Promise<T>,
): Promise<T> {
  if (userId !== null && !UUID_RE.test(userId)) {
    // `app.current_user_id()` ép kiểu sang uuid nên giá trị rác sẽ nổ ở tận trong
    // policy, kèm thông điệp chẳng chỉ được về đây. Chặn tại biên cho lỗi dễ đọc.
    throw new Error("withRole: userId không phải uuid hợp lệ");
  }

  return sequelize.transaction(async (t) => {
    await sequelize.query(`SET LOCAL ROLE ${userId ? AUTH : ANON}`, { transaction: t });
    if (userId) {
      await sequelize.query("SELECT set_config('app.user_id', $1, true)", {
        bind: [userId],
        transaction: t,
      });
    }
    return fn(t);
  });
}
