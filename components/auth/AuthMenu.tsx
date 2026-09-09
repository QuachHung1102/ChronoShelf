"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { FOCUS_RING } from "@/components/ui/controls";
import { getSignedInUser, onAuthChange, signOut, type SignedInUser } from "@/lib/api/auth";

/**
 * Khối tài khoản ở chân rail.
 *
 * Component này chạy phía client dù phiên nay đã nằm trong cookie `httpOnly`: nó phải
 * đổi ngay khi `signOut()` phát sự kiện qua `onAuthChange`, không đợi một vòng
 * `router.refresh()`.
 *
 * MÀU LẤY TỪ NỀN SÁNG, và đó là một lỗi đã đo được chứ không phải khẩu vị. Bản trước
 * dùng `navItemClass` — bộ class viết cho dải header ngang nền chàm — nên tên tài khoản
 * và nút Đăng xuất mang `text-on-ink` (#F6F7F9) đứng trên rail `bg-paper` (#F6F7F9):
 * **1.00:1, vô hình hoàn toàn**. Đo trong trình duyệt ngày 2026-09-10 ở 1024×768. Với
 * người CHƯA đăng nhập thì nặng hơn — chính lối vào đăng nhập biến mất khỏi màn hình.
 */
export function AuthMenu() {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const query = useSearchParams().toString();

  useEffect(() => {
    let alive = true;
    // Lỗi TRUYỀN TẢI không phải là "đã đăng xuất". `.catch(() => null)` trước đây gộp hai
    // thứ đó làm một, nên một cú nấc wifi là header đổi sang nút "Đăng nhập" trong khi
    // phiên vẫn còn nguyên — người dùng tưởng mình bị đá ra. Giữ nguyên trạng thái đang
    // có và để lần `load()` sau (mount, onAuthChange) sửa lại.
    const load = () =>
      getSignedInUser()
        .then((signedIn) => {
          if (!alive) return;
          setUser(signedIn);
          setReady(true);
        })
        .catch(() => {
          if (!alive) return;
          // Vẫn cho hiện: đứng im mãi ở `null` thì header trống trơn cũng là nói dối.
          setReady(true);
        });

    void load();
    const unsubscribe = onAuthChange(() => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Chưa biết trạng thái thì chưa hiện gì: nhấp nháy "Đăng nhập" rồi đổi thành email
  // khó chịu hơn là chờ một nhịp. Chỗ giữ đúng CHIỀU CAO một dòng — rail là một cột dọc
  // nên thứ nhảy khi khối này xuất hiện là chiều cao, không phải bề ngang như ở header
  // ngang cũ (chỗ giữ ngày đó rộng 158px, và bề ngang ở đây do rail quyết định).
  if (!ready) return <span aria-hidden className="block h-9" />;

  if (!user) {
    return (
      <Link
        // Ghép cả query string: `usePathname()` theo định nghĩa không chứa `?…`, nên người bị
        // đẩy ra đăng nhập từ một trang có tham số sẽ quay về một trang trống. `safeNext`
        // ở `lib/safe-next.ts` đã lọc phía nhận nên không mở thêm bề mặt nào.
        href={`/dang-nhap?next=${encodeURIComponent(pathname + (query ? `?${query}` : ""))}`}
        aria-current={pathname === "/dang-nhap" ? "page" : undefined}
        className={`flex items-center gap-md rounded-md p-sm font-ui text-label-md transition-colors duration-200 ease-out ${FOCUS_RING} ${
          pathname === "/dang-nhap"
            ? "bg-surface text-primary"
            : "text-ink-dilute hover:bg-surface hover:text-primary"
        }`}
      >
        <LogIn aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        Đăng nhập
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-between gap-sm">
      {/* Hiện phần TRƯỚC dấu @, không phải cả email: cắt cả địa chỉ thì được
          "ui-audit@exampl…" — vừa không đọc được vì cắt đúng chỗ vô nghĩa, vừa vẫn phơi
          phần đầu địa chỉ lên máy chiếu lớp học, mà phần người ta tự nhận ra mình lại nằm
          trước dấu @. Email đủ vẫn còn trong `title` để tra khi cần. `public.users` chưa có
          cột tên hiển thị; ngày nào có thì đây là chỗ DUY NHẤT phải sửa. */}
      <span className="flex min-w-0 items-center gap-sm p-sm text-primary" title={user.email}>
        <UserRound aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        <span className="truncate font-ui text-label-md">{user.email.split("@")[0]}</span>
      </span>
      <button
        type="button"
        onClick={() => void signOut().catch(() => undefined)}
        title="Đăng xuất"
        className={`shrink-0 rounded-md p-sm text-ink-dilute transition-colors duration-200 ease-out hover:bg-surface hover:text-son ${FOCUS_RING}`}
      >
        <LogOut aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        <span className="sr-only">Đăng xuất</span>
      </button>
    </div>
  );
}
