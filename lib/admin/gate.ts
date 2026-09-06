import { cache } from "react";
import { QueryTypes } from "sequelize";
import { getSessionUserId } from "@/lib/auth/session";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";

/**
 * Cổng quản trị — phía máy chủ.
 *
 * `isAdmin()` hỏi thẳng `public.is_admin()`, cùng một hàm mà policy "admin write" gọi.
 * Nhờ vậy giao diện và hàng rào không bao giờ bất đồng ý kiến: nếu ai đó sửa định
 * nghĩa admin, cả hai đổi cùng lúc.
 *
 * **`AdminGate` KHÔNG phải hàng rào bảo mật.** Nó chỉ quyết định hiện màn nào. Có hai
 * lớp thật ở dưới, và cả hai đều bắt buộc:
 *
 *   1. `requireAdmin()` gọi ở ĐẦU MỖI Server Action. Server Action là một endpoint
 *      POST công khai — tài liệu Next nói thẳng: "the route is reachable to anyone who
 *      can send the same POST. Treat every action as an untrusted entry point." Người
 *      không bao giờ nhìn thấy giao diện quản trị vẫn gọi được action, nếu họ đọc được
 *      action id trong bundle.
 *   2. Policy `admin write` ở tầng database, áp cho mọi INSERT/UPDATE/DELETE lên bảng
 *      nội dung. Đây là lớp duy nhất không thể quên gọi.
 */

/**
 * Trả về id nếu người đang đăng nhập là admin, null nếu không (kể cả khi chưa đăng nhập).
 *
 * Bọc `cache()` của React vì hàm này nay bị hỏi HAI lần trong cùng một lượt render trang
 * quản trị: `Header` gọi `isAdmin()` để quyết định có hiện mục "Quản trị" hay không, rồi
 * `AdminGate` gọi lại để quyết định hiện màn nào. Không có lớp này thì mỗi lượt xem
 * `/quan-tri/*` tốn hai transaction và hai câu `SELECT public.is_admin()`.
 *
 * `cache()` chỉ nhớ trong phạm vi MỘT request, nên nó không thể giữ lại quyền admin cũ
 * sang request sau — điều đó quan trọng, vì đây là hàm quyết định quyền.
 */
export const getAdminUserId = cache(async function getAdminUserId(): Promise<string | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const rows = await withRole(userId, (t) =>
    sequelize.query<{ is_admin: boolean }>("SELECT public.is_admin() AS is_admin", {
      transaction: t,
      type: QueryTypes.SELECT,
    }),
  );
  return rows[0]?.is_admin ? userId : null;
});

export async function isAdmin(): Promise<boolean> {
  return (await getAdminUserId()) !== null;
}

/**
 * Dùng ở đầu mỗi Server Action. Trả về id của admin, hoặc ném lỗi.
 *
 * Ném chứ không trả `null`: giá trị trả về dễ bị bỏ qua, một exception thì không. Nếu
 * dòng này lỡ bị quên, policy `admin write` vẫn chặn — nhưng thông báo lỗi lúc đó nói
 * về row-level security chứ không nói "bạn không có quyền", nên vẫn nên gọi ở đây.
 */
export async function requireAdmin(): Promise<string> {
  const userId = await getAdminUserId();
  if (!userId) throw new Error("Chỉ quản trị viên mới làm được việc này.");
  return userId;
}
