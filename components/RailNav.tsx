"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Settings, Users } from "lucide-react";
import { AuthMenu } from "@/components/auth/AuthMenu";
import { RailStats } from "@/components/RailStats";
import { FOCUS_RING } from "@/components/ui/controls";
import type { ShelfSummary } from "@/lib/content/read";

/**
 * Phần bấm được của rail.
 *
 * Client component vì mục đang mở nay tự suy từ `usePathname()` thay vì nhận `activeHref`
 * qua prop. Đó không phải chuyện tiện tay — nó là điều kiện để rail sống ở ROOT LAYOUT:
 * layout không biết route con nào đang mở, và nếu phải biết thì nó lại phải nhận prop từ
 * page, tức quay về đúng chỗ cũ, nơi mỗi page tự dựng rail của mình và mỗi lần chuyển trang
 * là một lần rail bị tháo ra dựng lại.
 */
export function RailNav({ shelves, laAdmin }: { shelves: ShelfSummary[]; laAdmin: boolean }) {
  const pathname = usePathname() ?? "";

  return (
    // `sticky top-0 h-screen`: rail phải đứng yên khi trang chủ (cao vài nghìn px) và bảng
    // tin Cộng đồng cuộn. `shrink-0` vì `<body>` là flex row — thiếu nó thì rail bị bóp lại
    // khi nội dung bên phải rộng.
    <aside className="sticky top-0 flex h-screen w-rail-width shrink-0 flex-col border-r border-mist bg-paper">
      <Link href="/" className={`flex items-center gap-md rounded-md px-lg pt-xl ${FOCUS_RING}`}>
        <GiotMuc />
        <span className="font-ui text-label-caps uppercase leading-tight text-primary">
          Cửa Sổ
          <br />
          Lịch Sử
        </span>
      </Link>

      {/* Vùng nav là thứ DUY NHẤT trong rail được phép cuộn: số kệ do admin quyết, còn khối
          chỉ số và tài khoản phía dưới phải luôn nhìn thấy được. */}
      <nav
        aria-label="Điều hướng chính"
        className="mt-2xl flex min-h-0 flex-1 flex-col gap-xs overflow-y-auto px-md"
      >
        <MucRail href="/" label="Trang chủ" icon={Home} active={pathname === "/"} />

        {shelves.length > 0 && (
          <>
            <p className="mt-lg px-md font-ui text-label-caps uppercase text-ink-dilute">
              Kệ sách
            </p>
            {shelves.map((s, i) => (
              <MucRail
                key={s.slug}
                href={`/${s.slug}`}
                label={s.name}
                // Chấm sắc tố thay cho icon: ba kệ là ba sắc tố mực trong cùng một chậu
                // (DESIGN.md § Ink), nên chỗ này nói "kệ nào" bằng đúng ngôn ngữ đó.
                pigment={i % 3}
                active={pathname === `/${s.slug}`}
              />
            ))}
          </>
        )}

        <div aria-hidden className="mx-md mt-lg border-t border-mist" />

        <MucRail
          href="/bai-giang"
          label="Bài giảng"
          icon={Layers}
          active={pathname === "/bai-giang"}
        />
        <MucRail
          href="/cong-dong"
          label="Cộng đồng"
          icon={Users}
          active={pathname === "/cong-dong"}
        />
        {/* Trước đây KHÔNG có đường nào từ giao diện vào khu quản trị — admin phải nhớ và gõ
            `/quan-tri` bằng tay, trong khi đó là cách DUY NHẤT sửa nội dung đang chạy. */}
        {laAdmin && (
          <MucRail
            href="/quan-tri"
            label="Quản trị"
            icon={Settings}
            active={pathname.startsWith("/quan-tri")}
          />
        )}
      </nav>

      {/* Hai khối dưới đây trả lời câu hỏi khác với nav ("tôi đang có gì", "tôi là ai"), nên
          chúng nằm NGOÀI landmark điều hướng — ở bản header ngang cũ, nút Đăng xuất và một
          con số tĩnh nằm lọt bên trong landmark "Điều hướng chính". */}
      <RailStats />
      <div className="border-t border-mist px-md py-md">
        <AuthMenu />
      </div>
    </aside>
  );
}

/**
 * Dấu mực — nhận diện sản phẩm.
 *
 * Vẽ bằng SVG chứ không phải một file ảnh: nó là MỘT giọt mực đang loang, và hình đó phải
 * lấy màu từ token để đổi theo hệ. Ba vòng lệch tâm là cách suminagashi thật hiện ra — mực
 * không loang thành vòng tròn đồng tâm hoàn hảo.
 */
function GiotMuc() {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8 shrink-0" fill="none">
      <circle cx="16" cy="16" r="15" className="stroke-mist" strokeWidth="1" />
      <circle cx="16" cy="16" r="10.5" className="stroke-feathered" strokeWidth="1" />
      <circle cx="15" cy="17" r="6" className="stroke-ink-dilute" strokeWidth="1.25" />
      <circle cx="14.2" cy="17.8" r="3" className="fill-primary" />
    </svg>
  );
}

const PIGMENT_DOT = ["bg-primary", "bg-son", "bg-ink-current"];

function MucRail({
  href,
  label,
  icon: Icon,
  pigment,
  active,
}: {
  href: string;
  label: string;
  icon?: typeof Home;
  /** Chỉ số sắc tố 0..2 — dùng cho mục kệ sách, thay chỗ của icon. */
  pigment?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Trạng thái đang chọn KHÔNG được phân biệt chỉ bằng màu (WCAG 1.4.1) — với học sinh
      // mù màu đỏ-lục, cỡ 1/12 nam giới, hai màu chữ là cùng một màu. Tín hiệu hình dạng ở
      // đây là **một giọt mực đặc bọc quanh icon**, đúng cách bảng điều hướng của thế giới
      // này nói. Bản trước dùng vạch màu 2px ở mép trái; đó là dấu hiệu dễ nhận nhất của
      // giao diện do máy sinh, và nó cũng chẳng thuộc ngôn ngữ nào của một chậu mực.
      className={`group flex items-center gap-md rounded-md p-sm font-ui text-label-md transition-colors duration-200 ease-out ${FOCUS_RING} ${
        active ? "bg-surface text-primary" : "text-ink-dilute hover:bg-surface hover:text-primary"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out ${
          active ? "bg-primary text-on-ink" : "text-ink-dilute group-hover:bg-mist"
        }`}
      >
        {Icon ? (
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <span
            className={`h-2 w-2 rounded-full ${
              active ? "bg-on-ink" : PIGMENT_DOT[(pigment ?? 0) % PIGMENT_DOT.length]
            }`}
          />
        )}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
