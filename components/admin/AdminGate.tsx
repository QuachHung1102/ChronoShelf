import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { isAdmin } from "@/lib/admin/gate";
import { getSessionUserId } from "@/lib/auth/session";
import { PRIMARY_BUTTON } from "@/components/ui/controls";

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

  // Màn từ chối vẫn dựng `Header`, đúng quy tắc đã ghi ở `app/not-found.tsx`: "để người
  // dùng có đường đi tiếp thay vì một ngõ cụt". Kịch bản thật là một giáo viên gửi link
  // /quan-tri cho đồng nghiệp chưa được cấp quyền — người đó rơi vào một trang kem trắng
  // không logo, không điều hướng, không biết mình đang ở sản phẩm nào.
  //
  // Không có vòng lặp nào: `readShelfList()` chạy dưới danh tính người xem, chạy được cả
  // khi chưa đăng nhập, và người không phải admin chỉ thấy kệ đã xuất bản.
  //
  // CỐ Ý không áp cách này cho `app/error.tsx` — comment tại chỗ đã nêu đúng lý do: lỗi
  // có thể đến từ chính lớp đọc dữ liệu mà `Header` dùng.

  return (
    <>
      <main
        id="noi-dung"
        className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-md px-page-margin py-xl text-center"
      >
        <ShieldOff aria-hidden className="h-12 w-12 text-ink-dilute" />
        <h1 className="font-ui text-display-md text-primary">
          {signedIn ? "Tài khoản này không phải quản trị viên" : "Cần đăng nhập"}
        </h1>
        <p className="max-w-measure font-ui text-body-md text-ink-dilute">
          {signedIn
            ? "Khu vực quản trị chỉ dành cho tài khoản được cấp quyền. Nếu bạn cho rằng đây là nhầm lẫn, liên hệ người quản lý nội dung."
            : "Đăng nhập bằng tài khoản quản trị để vào khu vực này."}
        </p>
        {/* Cả hai nhánh dùng `PRIMARY_BUTTON`: đây là hành động chính DUY NHẤT của màn
            này, và DESIGN.md đòi mỗi màn có đúng một hành động chính rõ ràng. Nhánh "đã
            đăng nhập nhưng không có quyền" trước đây là `QUIET_BUTTON` — chữ 13px gạch
            chân, tức lối ra duy nhất lại nhỏ hơn cả câu giải thích bên trên nó. */}
        <Link
          href={signedIn ? "/" : "/dang-nhap?next=%2Fquan-tri"}
          className={PRIMARY_BUTTON}
        >
          {signedIn ? "Về trang chủ" : "Đăng nhập"}
        </Link>
      </main>
    </>
  );
}
