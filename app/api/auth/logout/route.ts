import { endSession } from "@/lib/auth/session";
import { ok } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — xóa cookie phiên.
 *
 * Là POST chứ không phải GET vì nó đổi trạng thái: một `<img src="/api/auth/logout">`
 * trên trang bất kỳ sẽ đăng xuất người dùng nếu đây là GET.
 */
export async function POST(): Promise<Response> {
  await endSession();
  return ok({ signedOut: true });
}
