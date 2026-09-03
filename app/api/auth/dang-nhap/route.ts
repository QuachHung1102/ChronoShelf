import { dangNhap, SAI } from "@/lib/auth/dang-nhap";
import { startSession } from "@/lib/auth/session";
import { fail, ok, readJson, str } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/dang-nhap — đổi email + mật khẩu lấy phiên. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = str(body, "email", 320);
  const matKhau = str(body, "matKhau", 200) ?? "";
  if (!email || !matKhau) return fail("Thiếu email hoặc mật khẩu.");

  let userId: string;
  try {
    userId = await dangNhap(email, matKhau);
  } catch (e) {
    // MỘT câu trả lời cho mọi nhánh hỏng: sai mật khẩu, email chưa có tài khoản, đang
    // bị khóa vì thử sai quá nhiều. Phân biệt chúng là chỉ cho kẻ dò biết nó đang tới
    // gần chỗ nào — và biến trang đăng nhập thành máy dò danh sách người dùng.
    if (!(e instanceof Error) || e.message !== SAI) {
      console.error("POST /api/auth/dang-nhap:", e);
    }
    return fail("Email hoặc mật khẩu không đúng.", 401);
  }

  await startSession(userId);
  return ok({ userId });
}
