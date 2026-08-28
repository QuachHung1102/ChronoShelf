import { getSessionUserId } from "@/lib/auth/session";
import { withRole } from "@/lib/db/tx";
import { User } from "@/lib/db/models";
import { ok } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — ai đang đăng nhập.
 *
 * Chưa đăng nhập trả `{ user: null }` với mã 200, không phải 401: "chưa đăng nhập" là
 * một câu trả lời bình thường ở đây, không phải lỗi. Client dùng nó để quyết định hiện
 * nút "Đăng nhập" hay tên người dùng.
 */
export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) return ok({ user: null });

  // Đọc dưới role của chính người đó: policy "own user select" đảm bảo dù truy vấn có
  // sai thì cũng chỉ ra được đúng dòng của họ.
  const user = await withRole(userId, (t) =>
    User.findByPk(userId, { attributes: ["id", "email"], transaction: t }),
  );

  // Cookie hợp lệ nhưng không còn tài khoản (đã bị xóa): coi như chưa đăng nhập.
  return ok({ user: user ? { id: user.id, email: user.email } : null });
}
