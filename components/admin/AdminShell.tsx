import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";
import { Header } from "@/components/Header";
import { FOCUS_RING } from "@/components/ui/controls";
import { readShelfList } from "@/lib/content/read";

export interface Crumb {
  label: string;
  href?: string;
}

/** Các khu vực của trang quản trị. Thêm màn mới thì thêm một dòng ở đây. */
const SECTIONS = [
  { href: "/quan-tri", label: "Kệ sách" },
  { href: "/quan-tri/vat-pham", label: "Vật phẩm" },
  { href: "/quan-tri/bai-giang", label: "Bài giảng" },
] as const;

export type AdminSection = (typeof SECTIONS)[number]["href"];

/**
 * Khung chung cho mọi màn quản trị: `Header` + breadcrumb + tiêu đề.
 *
 * Dùng lại đúng `Header` của phần học sinh chứ không vẽ một thanh riêng: admin luôn
 * cần nhảy qua lại giữa hai bên để xem thay đổi của mình hiện ra thế nào, và một
 * thanh điều hướng thứ hai chỉ làm việc đó khó hơn.
 *
 * `readShelfList()` chạy dưới danh tính người xem, nên với admin nó trả về **cả kệ
 * chưa xuất bản** — đúng thứ cần, vì nếu không thì kệ vừa tạo sẽ không xuất hiện ở
 * đâu cho tới khi được xuất bản.
 */
export async function AdminShell({
  title,
  description,
  section,
  crumbs = [],
  actions,
  children,
}: {
  title: string;
  description?: string;
  /** Khu vực đang mở — quyết định tab nào sáng. */
  section: AdminSection;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const shelves = await readShelfList();
  const trail: Crumb[] = [{ label: "Quản trị", href: "/quan-tri" }, ...crumbs];

  return (
    <>
      <Header activeHref="/quan-tri" shelves={shelves} />
      <main id="noi-dung" className="mx-auto w-full max-w-[64rem] flex-1 px-page-margin py-lg">
        {/* Breadcrumb chỉ dựng khi có ít nhất một chặng CON. Ở `/quan-tri` thì `trail` chỉ
            có đúng mục "Quản trị", mà mục cuối không phải liên kết — tức một hàng không dẫn
            đi đâu, đứng ngay trên một tiêu đề nói cùng chuyện. */}
        {crumbs.length > 0 && (
          <nav aria-label="Đường dẫn" className="mb-sm">
            <ol className="flex flex-wrap items-center gap-xs font-body text-body-sm text-secondary">
              {trail.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-xs">
                  {i > 0 && <ChevronRight aria-hidden className="h-4 w-4 text-secondary-light" />}
                  {c.href && i < trail.length - 1 ? (
                    <Link
                      href={c.href}
                      className={`rounded-sm underline underline-offset-2 hover:text-tertiary-deep ${FOCUS_RING}`}
                    >
                      {c.label}
                    </Link>
                  ) : (
                    // Mục cuối là trang hiện tại: không phải liên kết, và aria-current nói
                    // rõ điều đó cho trình đọc màn hình.
                    <span aria-current="page" className="text-primary-dark">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="mb-lg flex flex-wrap items-start justify-between gap-md">
          <div>
            {/* Dấu nhận biết DUY NHẤT của khu quản trị trên vỏ chung. `Header` ở đây cố ý
                là đúng thanh của phần học sinh (xem chú thích trên), nên nếu không có
                dòng này thì `/quan-tri` trông y hệt một trang học sinh — không có gì nói
                cho người soạn nội dung biết mọi thứ họ gõ ở đây là nội dung đang chạy.
                Dùng đúng khuôn eyebrow của `/bai-giang`, `/cong-dong`, `/tui-hanh-trang`:
                `label-caps` + `uppercase` + `tertiary-deep`, thành phần `eyebrow` trong
                DESIGN.md. */}
            <p className="flex items-center gap-xs font-body text-label-caps uppercase text-tertiary-deep">
              <Settings aria-hidden className="h-4 w-4" />
              Khu quản trị
            </p>
            {/* `headline-lg` chứ không `headline-md`: tiêu đề màn chỉ hơn tiêu đề thẻ
                (`headline-sm` 20px) đúng 4px thì không đọc ra cấp nào chứa cấp nào. Cùng
                bậc với h1 của mọi màn khác trong ứng dụng. */}
            <h1 className="mt-xs font-heading text-headline-lg text-primary-dark">{title}</h1>
            {description && (
              <p className="mt-xs max-w-[48rem] font-body text-body-md text-secondary">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-sm">{actions}</div>}
        </div>

        {/* Breadcrumb chỉ đi LÊN, không đi ngang — thiếu hàng này thì `/quan-tri/vat-pham`
            không có đường vào nào từ giao diện. */}
        <nav aria-label="Khu vực quản trị" className="mb-lg border-b border-surface-locked">
          <ul className="flex flex-wrap gap-lg">
            {SECTIONS.map((s) => {
              const active = s.href === section;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    aria-current={active ? "page" : undefined}
                    className={`-mb-px inline-block border-b-2 pb-sm font-body text-label-md transition-colors duration-200 ease-out ${FOCUS_RING} ${
                      active
                        ? "border-tertiary-deep text-tertiary-deep"
                        : "border-transparent text-secondary hover:text-primary-dark"
                    }`}
                  >
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {children}
      </main>
    </>
  );
}
