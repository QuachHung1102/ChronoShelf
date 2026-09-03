import { khoiPhuc, layCauHoi, SAI } from "@/lib/auth/dang-nhap";
import { startSession } from "@/lib/auth/session";
import { DAP_AN_TOI_DA } from "@/lib/auth/cau-hoi-bao-mat";
import { kiemMatKhau } from "@/lib/auth/mat-khau";
import { fail, ok, readJson, str } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/khoi-phuc — hai bước trên cùng một route.
 *
 *  - Chỉ có `email`  → trả về mã câu hỏi bảo mật.
 *  - Có thêm `dapAn` + `matKhauMoi` → đặt lại mật khẩu và đăng nhập luôn.
 *
 * Bước một LUÔN trả về một câu hỏi, kể cả email chưa có tài khoản. Không có điều đó thì
 * chỉ cần gõ email vào là biết ai đã đăng ký — và câu hỏi họ chọn là gì.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = str(body, "email", 320);
  if (!email) return fail("Thiếu email.");

  const dapAn = str(body, "dapAn", DAP_AN_TOI_DA) ?? "";
  const matKhauMoi = str(body, "matKhauMoi", 200) ?? "";

  if (!dapAn && !matKhauMoi) {
    return ok({ cauHoi: await layCauHoi(email) });
  }

  if (!dapAn) return fail("Thiếu đáp án.");
  const loiMatKhau = kiemMatKhau(matKhauMoi);
  if (loiMatKhau) return fail(loiMatKhau);

  let userId: string;
  try {
    userId = await khoiPhuc(email, dapAn, matKhauMoi);
  } catch (e) {
    if (!(e instanceof Error) || e.message !== SAI) {
      console.error("POST /api/auth/khoi-phuc:", e);
    }
    // Cùng một câu cho: đáp án sai, email không tồn tại, và đang bị khóa.
    return fail("Đáp án không đúng.", 401);
  }

  await startSession(userId);
  return ok({ userId });
}
