import type { Metadata } from "next";
import Link from "next/link";
import { Library, Package } from "lucide-react";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { FOCUS_RING } from "@/components/ui/controls";

export const metadata: Metadata = { title: "Quản trị — Cửa Sổ Lịch Sử" };

// Đọc phiên đăng nhập từ cookie nên không prerender được.
export const dynamic = "force-dynamic";

const SECTIONS = [
  {
    href: "/quan-tri/vat-pham",
    icon: Package,
    title: "Vật phẩm",
    body: "Tên, mô tả và ảnh của các vật phẩm. Đây là thứ mở khóa quyển sách kế tiếp, nên làm trước khi tạo sách.",
    ready: false,
  },
  {
    href: "/quan-tri",
    icon: Library,
    title: "Kệ sách",
    body: "Tạo kệ, sắp thứ tự sách trong kệ, soạn từng trang, rồi xuất bản.",
    ready: false,
  },
];

export default function AdminHomePage() {
  return (
    <AdminGate>
      <AdminShell
        title="Quản trị nội dung"
        description="Tạo kệ, sách và trang mà không cần viết SQL hay build lại. Thay đổi hiện ra với học sinh ngay khi bạn xuất bản."
      >
        <ul className="grid gap-md sm:grid-cols-2">
          {SECTIONS.map(({ href, icon: Icon, title, body, ready }) => (
            <li key={title}>
              {/* Mục chưa xây dựng render thành thẻ chết chứ không phải liên kết gãy:
                  một liên kết dẫn tới 404 tệ hơn hẳn một nhãn nói thẳng "chưa có". */}
              <div
                className={`h-full rounded-md bg-surface p-md ${ready ? "" : "opacity-60"}`}
                aria-disabled={ready ? undefined : true}
              >
                <div className="mb-sm flex items-center gap-sm">
                  <Icon aria-hidden className="h-5 w-5 text-tertiary-deep" />
                  <h2 className="font-heading text-headline-sm text-primary-dark">{title}</h2>
                </div>
                <p className="font-body text-body-sm text-secondary">{body}</p>
                <p className="mt-sm">
                  {ready ? (
                    <Link
                      href={href}
                      className={`rounded-sm font-body text-label-md text-tertiary-deep underline underline-offset-2 ${FOCUS_RING}`}
                    >
                      Mở
                    </Link>
                  ) : (
                    <span className="font-body text-caption uppercase tracking-wide text-secondary">
                      Chưa xây dựng
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </AdminShell>
    </AdminGate>
  );
}
