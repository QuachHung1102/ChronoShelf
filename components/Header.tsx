import Link from "next/link";
import { Backpack, Flame } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/lich-su-viet-nam", label: "Lịch sử Việt Nam" },
  { href: "/lich-su-the-gioi", label: "Lịch sử Thế giới" },
  { href: "/lich-su-quanh-cuoc-song", label: "Lịch sử quanh cuộc sống" },
  { href: "/bai-giang-slide", label: "Bài giảng & Slide" },
];

const focusOnDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

export function Header({ activeHref }: { activeHref: string }) {
  return (
    <header className="flex h-header-height items-center justify-between bg-primary px-8">
      <Link
        href="/"
        className={`font-heading text-headline-sm text-on-primary ${focusOnDark}`}
      >
        CỬA SỔ LỊCH SỬ
      </Link>

      <nav className="flex items-center gap-lg" aria-label="Điều hướng chính">
        {NAV_ITEMS.map((item) => {
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

        {/* Streak và túi hành trang thuộc subsystem khác — số liệu ở đây là placeholder. */}
        <span className="flex items-center gap-xs text-on-primary" title="Chuỗi ngày học liên tục">
          <Flame aria-hidden className="h-5 w-5 text-tertiary-light" />
          <span className="font-body text-label-md">12</span>
          <span className="sr-only">ngày streak</span>
        </span>
        <span className="flex items-center gap-xs text-on-primary" title="Túi hành trang">
          <Backpack aria-hidden className="h-5 w-5" />
          <span className="font-body text-label-md">7</span>
          <span className="sr-only">vật phẩm đã sưu tầm</span>
        </span>
      </nav>
    </header>
  );
}
