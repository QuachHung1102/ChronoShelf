import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { isAdmin } from "@/lib/admin/gate";
import { getSessionUserId } from "@/lib/auth/session";
import { PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";

/**
 * Server component: quyết định hiện màn quản trị hay màn từ chối.
 *
 * Không có trạng thái "đang tải" nào ở đây — trang render sau khi đã biết câu trả
 * lời. Bản kế hoạch cũ có ba nhánh (đang tải / không có quyền / cho vào) vì nó chạy
 * phía client và phải hỏi backend sau khi đã vẽ xong; chạy phía máy chủ thì nhánh
 * giữa biến mất, và cũng không còn nhấp nháy "không có quyền" trước khi biết.
 *
 * ĐÂY KHÔNG PHẢI HÀNG RÀO BẢO MẬT — xem `lib/admin/gate.ts`.
 */
export async function AdminGate({ children }: { children: React.ReactNode }) {
  if (await isAdmin()) return <>{children}</>;

  const signedIn = (await getSessionUserId()) !== null;

  return (
    <main className="mx-auto flex max-w-[42rem] flex-1 flex-col items-center justify-center gap-md px-page-margin py-xl text-center">
      <ShieldOff aria-hidden className="h-12 w-12 text-secondary" />
      <h1 className="font-heading text-headline-md text-primary-dark">
        {signedIn ? "Tài khoản này không phải quản trị viên" : "Cần đăng nhập"}
      </h1>
      <p className="max-w-[36rem] font-body text-body-md text-secondary">
        {signedIn
          ? "Khu vực quản trị chỉ dành cho tài khoản được cấp quyền. Nếu bạn cho rằng đây là nhầm lẫn, liên hệ người quản lý nội dung."
          : "Đăng nhập bằng tài khoản quản trị để vào khu vực này."}
      </p>
      {signedIn ? (
        <Link href="/" className={QUIET_BUTTON}>
          Về trang chủ
        </Link>
      ) : (
        <Link href="/dang-nhap?next=%2Fquan-tri" className={PRIMARY_BUTTON}>
          Đăng nhập
        </Link>
      )}
    </main>
  );
}
