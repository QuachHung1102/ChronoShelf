import { cookies } from "next/headers";
import { mintToken, readToken } from "./token";

/**
 * Phiên đăng nhập nằm trong một cookie `httpOnly`.
 *
 * Đổi so với thời InsForge: hồi đó phiên nằm ở `localStorage` của trình duyệt, nên
 * server component KHÔNG đọc được và mọi thứ cần danh tính đều phải chạy phía client.
 * Cookie `httpOnly` đi kèm mọi request, nên server đọc được — và JavaScript trên
 * trang thì không, kể cả khi có XSS.
 */

const COOKIE = "chronoshelf_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    // Nổ to thay vì tự sinh một khóa tạm: khóa tạm nghĩa là mỗi lần khởi động lại
    // server, mọi người đang đăng nhập bị đá ra — và tệ hơn, ở bản chạy thật nhiều
    // tiến trình thì mỗi tiến trình một khóa, người dùng bị đăng xuất ngẫu nhiên.
    throw new Error(
      "Thiếu SESSION_SECRET (cần ít nhất 32 ký tự). Sinh một cái: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
  return s;
}

/** Trả về user id nếu có phiên hợp lệ, null nếu không. Đọc được ở mọi nơi phía server. */
export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? (readToken(token, secret())?.sub ?? null) : null;
}

/** Chỉ gọi được trong Route Handler hoặc Server Action — Server Component không ghi cookie. */
export async function startSession(userId: string): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  (await cookies()).set(COOKIE, mintToken({ sub: userId, exp }, secret()), {
    httpOnly: true,
    // `lax` chứ không `strict`: `strict` sẽ không gửi cookie khi người dùng bấm link
    // từ trang khác vào, nên họ thấy mình bị đăng xuất ở đúng lượt đó. `lax` vẫn chặn
    // CSRF cho mọi request POST đến từ site khác.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
