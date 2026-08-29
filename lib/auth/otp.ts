import crypto from "node:crypto";
import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";

/**
 * Đăng nhập bằng mã 6 số gửi qua email.
 *
 * Mã sinh bằng `crypto.randomInt` (nguồn ngẫu nhiên mã hóa), và database chỉ nhận
 * BẢN BĂM — mã thô không bao giờ được lưu. Toàn bộ phần đếm lần thử, hạn dùng và
 * chống dội mã nằm trong `app.issue_login_code` / `app.consume_login_code`, tức là
 * ở tầng database, nên không route nào lách qua được.
 */

const TTL_MINUTES = 10;

const hashCode = (email: string, code: string): string =>
  crypto.createHash("sha256").update(`${email.toLowerCase().trim()}:${code}`).digest("hex");

/**
 * Gửi mã tới hộp thư.
 *
 * ponytail: bản dev in ra console server — 0 phụ thuộc, 0 cấu hình, đủ để làm việc.
 * Ở production thì NỔ thay vì im lặng in ra log: mã đăng nhập nằm trong log máy chủ
 * là một lỗ hổng thật, và "quên gắn nhà cung cấp mail" phải là lỗi ồn ào lúc deploy
 * chứ không phải điều ai đó phát hiện ra sáu tháng sau. Gắn Nodemailer/Resend vào
 * đúng chỗ này khi thật sự deploy.
 */
async function deliver(email: string, code: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Chưa cấu hình gửi email cho production. Gắn nhà cung cấp mail vào lib/auth/otp.ts.",
    );
  }
  console.log(`\n  [OTP] ${email} → mã ${code} (hết hạn sau ${TTL_MINUTES} phút)\n`);
}

/** Phát mã mới và gửi đi. Ném lỗi khi email sai định dạng hoặc xin mã quá dày. */
export async function sendLoginCode(email: string): Promise<void> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);

  await withRole(null, (t) =>
    sequelize.query("SELECT app.issue_login_code($1, $2, $3)", {
      bind: [email, hashCode(email, code), expiresAt],
      transaction: t,
      type: QueryTypes.SELECT,
    }),
  );

  // Gửi mail SAU khi database đã nhận mã. Ngược lại thì một lần ghi hỏng sẽ để lại
  // một mã đã nằm trong hộp thư người dùng nhưng không đổi được thành gì.
  await deliver(email, code);
}

/**
 * Đổi mã lấy user id. Ném lỗi "Invalid or expired code" cho mọi trường hợp hỏng.
 *
 * `app.consume_login_code` trả về NULL — chứ KHÔNG ném exception — cho mọi nhánh
 * hỏng (mã sai, mã hết hạn, thử quá 5 lần, email chưa từng xin mã). Đó là chủ ý:
 * một RAISE trong hàm sẽ hủy cả transaction của request và cuốn theo chính câu
 * `UPDATE attempts` của nó, làm giới hạn 5 lần thử thành vô nghĩa. Lý do đầy đủ
 * nằm trong `db/schema/02-users.sql`.
 *
 * Hệ quả cho chỗ này: `throw` bên dưới BẮT BUỘC nằm NGOÀI `withRole()`. Ném từ
 * bên trong callback thì Sequelize rollback transaction và xóa luôn bộ đếm vừa
 * tăng — mở lại đúng lỗ vừa vá. Đừng kéo nó vào trong.
 */
export async function verifyLoginCode(email: string, code: string): Promise<string> {
  const rows = await withRole(null, (t) =>
    sequelize.query<{ consume_login_code: string | null }>(
      "SELECT app.consume_login_code($1, $2) AS consume_login_code",
      { bind: [email, hashCode(email, code)], transaction: t, type: QueryTypes.SELECT },
    ),
  );
  // Tới đây withRole() đã COMMIT xong: bộ đếm lần thử an toàn, giờ mới được ném.
  const id = rows[0]?.consume_login_code;
  if (!id) throw new Error("Invalid or expired code");
  return id;
}
