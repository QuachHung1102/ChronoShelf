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
 * Cookie không phát sự kiện, nên ta tự phát: mọi chỗ đổi trạng thái đăng nhập đều đi qua
 * các hàm trong file này, và chúng gọi `notify()`. Nhờ vậy header với trang kệ vẫn đồng
 * bộ lại được mà không phải tải lại trang.
 *
 * Cố ý KHÔNG dùng `BroadcastChannel` để đồng bộ giữa nhiều tab: nó thêm một bề mặt nữa
 * để hỏng, còn hậu quả của việc không có nó chỉ là một tab khác hiện trạng thái cũ cho
 * tới lần điều hướng kế tiếp.
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

/** Tạo tài khoản rồi đăng nhập luôn. */
export async function dangKy(
  email: string,
  matKhau: string,
  cauHoi: string,
  dapAn: string,
): Promise<void> {
  await post("/api/auth/dang-ky", { email, matKhau, cauHoi, dapAn });
  notify();
}

/** Đăng nhập bằng email + mật khẩu. */
export async function dangNhap(email: string, matKhau: string): Promise<void> {
  await post("/api/auth/dang-nhap", { email, matKhau });
  notify();
}

/**
 * Bước 1 của khôi phục: lấy mã câu hỏi bảo mật.
 *
 * LUÔN trả về một câu hỏi, kể cả khi email chưa có tài khoản — nên đừng dùng kết quả của
 * hàm này để suy ra tài khoản có tồn tại hay không. Đó chính là điều nó được thiết kế
 * để không nói ra.
 */
export async function layCauHoi(email: string): Promise<string> {
  const res = await post("/api/auth/khoi-phuc", { email });
  return typeof res.cauHoi === "string" ? res.cauHoi : "";
}

/** Bước 2 của khôi phục: trả lời câu hỏi và đặt mật khẩu mới, rồi đăng nhập luôn. */
export async function khoiPhuc(
  email: string,
  dapAn: string,
  matKhauMoi: string,
): Promise<void> {
  await post("/api/auth/khoi-phuc", { email, dapAn, matKhauMoi });
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
