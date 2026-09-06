"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { navItemClass } from "@/components/ui/controls";
import { getSignedInUser, onAuthChange, signOut, type SignedInUser } from "@/lib/api/auth";

/**
 * Component này vẫn chạy phía client dù phiên nay đã nằm trong cookie `httpOnly` (nên
 * server đọc được): nó ngồi trong `Header`, mà `Header` xuất hiện ở layout của cả
 * những trang tĩnh. Biến nó thành server component sẽ kéo mọi trang đó thành động chỉ
 * để hiện một cái tên.
 *
 * Đăng xuất không cần `router.refresh()`: `signOut()` phát sự kiện qua `onAuthChange`
 * và mọi chỗ đang nghe tự lấy lại trạng thái.
 */
export function AuthMenu() {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

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
  // khó chịu hơn là chờ một nhịp.
  if (!ready) return null;

  if (!user) {
    return (
      <Link
        href={`/dang-nhap?next=${encodeURIComponent(pathname)}`}
        className={navItemClass(pathname === "/dang-nhap")}
      >
        Đăng nhập
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-sm">
      {/* Hiện phần TRƯỚC dấu @, không phải cả email. `max-w-[14ch]` cắt "ui-audit@example.com"
          thành "ui-audit@exampl…" — vừa không đọc được vì cắt đúng chỗ vô nghĩa, vừa vẫn phơi
          phần đầu địa chỉ lên máy chiếu lớp học, mà phần người ta tự nhận ra mình lại nằm
          trước dấu @. Email đủ vẫn còn trong `title` để tra khi cần. `public.users` chưa có
          cột tên hiển thị; ngày nào có thì đây là chỗ DUY NHẤT phải sửa. */}
      <span className="flex items-center gap-xs text-on-primary" title={user.email}>
        <UserRound aria-hidden className="h-5 w-5" />
        <span className="max-w-[12ch] truncate font-body text-label-md">
          {user.email.split("@")[0]}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void signOut().catch(() => undefined)}
        className={navItemClass(false)}
      >
        <LogOut aria-hidden className="h-5 w-5" />
        <span className="sr-only">Đăng xuất</span>
      </button>
    </span>
  );
}
