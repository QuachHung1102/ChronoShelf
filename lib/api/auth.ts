"use client";

/**
 * Xác thực nhìn từ phía trình duyệt. Chỉ gọi `/api/auth/*` — phiên nằm trong cookie
 * `httpOnly` nên JavaScript ở đây KHÔNG đọc được token, và đó là chủ ý.
 */

export interface SignedInUser {
  id: string;
  email: string;
}

/**
 * Cookie không phát sự kiện, nên ta tự phát: đăng nhập và đăng xuất đều đi qua đúng
 * hai hàm trong file này, và chúng gọi `notify()`. Nhờ vậy header với trang kệ vẫn
 * đồng bộ lại được mà không phải tải lại trang — đúng hành vi cũ.
 *
 * Cố ý KHÔNG dùng `BroadcastChannel` để đồng bộ giữa nhiều tab: nó thêm một bề mặt
 * nữa để hỏng, còn hậu quả của việc không có nó chỉ là một tab khác hiện trạng thái
 * cũ cho tới lần điều hướng kế tiếp.
 */
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((fn) => fn());

export function onAuthChange(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

async function post(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await res.json().catch(() => ({}));
  const obj = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof obj.error === "string" ? obj.error : "Không kết nối được máy chủ.");
  }
  return obj;
}

/**
 * Gửi mã đăng nhập 6 số tới email.
 *
 * Đây cũng là bước đăng ký: máy chủ trả lời y hệt nhau dù email đã có tài khoản hay
 * chưa (để không ai dò được danh sách người dùng), và email mới sẽ thành tài khoản
 * **đã xác minh** ngay khi nhập đúng mã.
 */
export async function sendLoginCode(email: string): Promise<void> {
  await post("/api/auth/code", { email });
}

/** Đổi mã lấy phiên đăng nhập. Email chưa có tài khoản thì tài khoản được tạo tại đây. */
export async function verifyLoginCode(email: string, otp: string): Promise<void> {
  await post("/api/auth/verify", { email, code: otp });
  notify();
}

export async function signOut(): Promise<void> {
  await post("/api/auth/logout");
  notify();
}

/** Trả về null khi chưa đăng nhập. */
export async function getSignedInUser(): Promise<SignedInUser | null> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  const data = (await res.json()) as { user: SignedInUser | null };
  return data.user;
}
