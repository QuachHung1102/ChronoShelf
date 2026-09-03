import { dangKy, EMAIL_DA_CO } from "@/lib/auth/dang-nhap";
import { startSession } from "@/lib/auth/session";
import { DAP_AN_TOI_DA, laMaCauHoi } from "@/lib/auth/cau-hoi-bao-mat";
import { kiemMatKhau } from "@/lib/auth/mat-khau";
import { fail, ok, readJson, str } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/dang-ky — tạo tài khoản rồi đăng nhập luôn. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = str(body, "email", 320);
  // `?? ""` chứ không để `null` đi tiếp: `str()` trả null cho cả "thiếu" lẫn "quá dài",
  // và `kiemMatKhau` mới là chỗ nói đúng câu lỗi cho người dùng.
  const matKhau = str(body, "matKhau", 200) ?? "";
  const cauHoi = str(body, "cauHoi", 64);
  const dapAn = str(body, "dapAn", DAP_AN_TOI_DA) ?? "";

  if (!email) return fail("Thiếu email.");
  const loiMatKhau = kiemMatKhau(matKhau);
  if (loiMatKhau) return fail(loiMatKhau);
  // Allowlist ở đây là phép lịch sự cho người dùng; hàng rào thật là ràng buộc
  // `users_security_question_ck` ở tầng database, thứ không route nào lách được.
  if (!laMaCauHoi(cauHoi)) return fail("Hãy chọn một câu hỏi bảo mật.");
  if (!dapAn) return fail("Thiếu đáp án cho câu hỏi bảo mật.");

  let userId: string;
  try {
    userId = await dangKy(email, matKhau, cauHoi, dapAn);
  } catch (e) {
    if (e instanceof Error && e.message === EMAIL_DA_CO) {
      // Ở ĐÂY thì nói thẳng là email đã có tài khoản, khác hẳn trang đăng nhập.
      // Không giấu được: người đăng ký buộc phải biết vì sao họ không tạo được tài
      // khoản, và họ có thể tự dò bằng cách thử đăng ký. Giấu ở màn ĐĂNG NHẬP mới có
      // giá trị, và ở đó ta có giấu.
      return fail("Email này đã có tài khoản. Hãy đăng nhập hoặc dùng chức năng quên mật khẩu.", 409);
    }
    console.error("POST /api/auth/dang-ky:", e);
    return fail("Không tạo được tài khoản.", 500);
  }

  await startSession(userId);
  return ok({ userId });
}
