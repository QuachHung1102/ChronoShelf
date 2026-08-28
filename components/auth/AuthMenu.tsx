"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { getSignedInUser, onAuthChange, signOut, type SignedInUser } from "@/lib/api/auth";

const FOCUS_ON_DARK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

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
    const load = () =>
      getSignedInUser()
        .catch(() => null)
        .then((signedIn) => {
          if (!alive) return;
          setUser(signedIn);
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
        className={`font-body text-label-md text-on-primary transition-colors duration-200 ease-out hover:text-tertiary-light ${FOCUS_ON_DARK}`}
      >
        Đăng nhập
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-sm">
      <span className="flex items-center gap-xs text-on-primary" title={user.email}>
        <UserRound aria-hidden className="h-5 w-5" />
        <span className="max-w-[14ch] truncate font-body text-label-md">{user.email}</span>
      </span>
      <button
        type="button"
        onClick={() => void signOut().catch(() => undefined)}
        className={`flex items-center text-on-primary transition-colors duration-200 ease-out hover:text-tertiary-light ${FOCUS_ON_DARK}`}
      >
        <LogOut aria-hidden className="h-5 w-5" />
        <span className="sr-only">Đăng xuất</span>
      </button>
    </span>
  );
}
