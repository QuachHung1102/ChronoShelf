import { verifyLoginCode } from "@/lib/auth/otp";
import { startSession } from "@/lib/auth/session";
import { fail, ok, readJson, str } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/auth/verify — đổi mã lấy phiên đăng nhập. */
export async function POST(req: Request): Promise<Response> {
  const body = await readJson(req);
  const email = str(body, "email");
  const code = str(body, "code", 6);
  if (!email || !code) return fail("Thiếu email hoặc mã.");

  let userId: string;
  try {
    userId = await verifyLoginCode(email, code);
  } catch (e) {
    // MỘT câu trả lời cho mọi nhánh hỏng — mã sai, mã hết hạn, thử quá số lần, email
    // chưa từng xin mã. Phân biệt chúng chỉ giúp kẻ dò biết nó đang tới gần chỗ nào.
    if (!(e instanceof Error) || e.message !== "Invalid or expired code") {
      console.error("POST /api/auth/verify:", e);
    }
    return fail("Mã không đúng hoặc đã hết hạn.", 401);
  }

  await startSession(userId);
  return ok({ userId });
}
