import { sendLoginCode } from "@/lib/auth/otp";
import { fail, ok, readJson, str } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/code — gửi mã đăng nhập tới email.
 *
 * Đây cũng là bước đăng ký: email chưa có tài khoản sẽ thành tài khoản khi nhập đúng
 * mã. Vì vậy phản hồi phải GIỐNG HỆT NHAU dù email đã tồn tại hay chưa — khác nhau
 * một chữ là biến endpoint này thành công cụ dò danh sách người dùng.
 */
export async function POST(req: Request): Promise<Response> {
  const email = str(await readJson(req), "email");
  if (!email) return fail("Thiếu địa chỉ email.");

  try {
    await sendLoginCode(email);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Hai lỗi từ tầng database được dịch sang tiếng Việt; mọi lỗi khác bị nuốt thành
    // một câu chung, vì thông điệp gốc của Postgres lộ tên hàm và tên bảng.
    if (message === "Invalid email") return fail("Địa chỉ email không hợp lệ.");
    if (message === "Too many codes requested") {
      return fail("Đã xin mã quá nhiều lần. Chờ vài phút rồi thử lại.", 429);
    }
    console.error("POST /api/auth/code:", e);
    return fail("Không gửi được mã đăng nhập.", 500);
  }

  return ok({ sent: true });
}
