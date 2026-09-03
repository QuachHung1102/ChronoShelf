import Link from "next/link";
import { AuthMenu } from "@/components/auth/AuthMenu";
import { HeaderStats } from "@/components/HeaderStats";
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
    { href: "/bai-giang", label: "Bài giảng" },
    { href: "/cong-dong", label: "Cộng đồng" },
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

        <HeaderStats />

        <AuthMenu />
      </nav>
    </header>
  );
}
