import { insforge } from "./client";

/** Người dùng đang đăng nhập — chỉ giữ phần giao diện thật sự cần. */
export interface SignedInUser {
  id: string;
  email: string;
}

function fail(error: unknown, fallback: string): never {
  throw new Error(error instanceof Error ? error.message : fallback);
}

/**
 * Gửi mã đăng nhập 6 số tới email.
 *
 * Đây cũng là bước đăng ký: backend trả lời y hệt nhau dù email đã có tài khoản hay chưa
 * (để không ai dò được danh sách người dùng), và email mới sẽ thành tài khoản **đã xác minh**
 * ngay khi nhập đúng mã. Nhờ vậy luồng này đi vòng qua `requireEmailVerification` của backend —
 * `auth.signUp` bằng mật khẩu thì trả về `accessToken: null` và người dùng kẹt lại.
 */
export async function sendLoginCode(email: string): Promise<void> {
  const { error } = await insforge.auth.signInWithOtp({ email });
  if (error) fail(error, "Không gửi được mã đăng nhập.");
}

/** Đổi mã lấy phiên đăng nhập. Email chưa có tài khoản thì tài khoản được tạo tại đây. */
export async function verifyLoginCode(email: string, otp: string): Promise<void> {
  const { error } = await insforge.auth.verifyOtp({ email, otp });
  if (error) fail(error, "Mã không đúng hoặc đã hết hạn.");
}

export async function signOut(): Promise<void> {
  const { error } = await insforge.auth.signOut();
  if (error) fail(error, "Không đăng xuất được.");
}

/** Trả về null khi chưa đăng nhập. Chỉ chạy được phía client — phiên nằm ở trình duyệt. */
export async function getSignedInUser(): Promise<SignedInUser | null> {
  const { data } = await insforge.auth.getCurrentUser();
  const user = data?.user;
  return user ? { id: user.id, email: user.email } : null;
}

/** Đăng ký nhận thay đổi phiên (đăng nhập, đăng xuất, làm mới token); trả về hàm hủy. */
export function onAuthChange(callback: () => void): () => void {
  return insforge.auth.onAuthStateChange(callback);
}
