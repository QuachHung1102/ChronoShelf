import Link from "next/link";
import { Backpack, Flame } from "lucide-react";
import { AuthMenu } from "@/components/auth/AuthMenu";
import type { ShelfSummary } from "@/lib/content/read";

const focusOnDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

/**
 * `shelves` do server component truyền xuống — danh sách kệ nay là dữ liệu động
 * (admin tạo thêm được), không còn là hằng trong mã nguồn.
 */
export function Header({
  activeHref,
  shelves = [],
}: {
  activeHref: string;
  shelves?: ShelfSummary[];
}) {
  const navItems = [
    { href: "/", label: "Trang chủ" },
    ...shelves.map((s) => ({ href: `/${s.slug}`, label: s.name })),
  ];

  return (
    <header className="flex h-header-height items-center justify-between bg-primary px-page-margin">
      <Link href="/" className={`font-heading text-headline-sm text-on-primary ${focusOnDark}`}>
        CỬA SỔ LỊCH SỬ
      </Link>

      <nav className="flex items-center gap-lg" aria-label="Điều hướng chính">
        {navItems.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`font-body text-label-md transition-colors duration-200 ease-out ${focusOnDark} ${
                isActive ? "text-tertiary-light" : "text-on-primary hover:text-tertiary-light"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Streak và túi hành trang thuộc subsystem khác, CHƯA có số thật.
            Trước đây chỗ này hiện cứng "12" và "7". Một sản phẩm dạy học sinh mà bịa số
            là thứ mất uy tín nhanh nhất — và học sinh nhận ra ngay khi con số không bao
            giờ đổi. Hiện dấu "–" cho tới khi subsystem đó có thật. */}
        <span className="flex items-center gap-xs text-on-primary" title="Chuỗi ngày học liên tục">
          <Flame aria-hidden className="h-5 w-5 text-tertiary-light" />
          <span className="font-body text-label-md" aria-label="chưa có dữ liệu streak">
            –
          </span>
        </span>
        <span className="flex items-center gap-xs text-on-primary" title="Túi hành trang">
          <Backpack aria-hidden className="h-5 w-5" />
          <span className="font-body text-label-md" aria-label="chưa có dữ liệu túi hành trang">
            –
          </span>
        </span>

        <AuthMenu />
      </nav>
    </header>
  );
}
