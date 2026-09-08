import Link from "next/link";
import { ChevronDown, Settings } from "lucide-react";
import { AuthMenu } from "@/components/auth/AuthMenu";
import { MenuKeSach } from "@/components/MenuKeSach";
import { HeaderStats } from "@/components/HeaderStats";
import { FOCUS_RING_ON_DARK, navItemClass } from "@/components/ui/controls";
import { isAdmin } from "@/lib/admin/gate";
import type { ShelfSummary } from "@/lib/content/read";

/**
 * `shelves` do server component truyền xuống — danh sách kệ nay là dữ liệu động
 * (admin tạo thêm được), không còn là hằng trong mã nguồn.
 *
 * **Số mục điều hướng CỐ ĐỊNH ở 4 (5 với admin), bất kể có bao nhiêu kệ.** Bản trước cho
 * mỗi kệ một mục nav, mà `readShelfList()` không có LIMIT và admin tạo kệ được lúc chạy —
 * nên số mục là biến do người dùng quyết định. Ở 1024×768 (ngưỡng thấp nhất dự án cam kết)
 * với 3 kệ thì mọi nhãn ĐÃ gãy làm hai dòng bên trong dải 72px cứng, và kệ thứ tư là tràn.
 * Gom toàn bộ kệ vào một mục "Kệ sách" là thứ DUY NHẤT chặn được chuyện đó; thu nhỏ khoảng
 * cách hay `whitespace-nowrap` chỉ mua thêm vài chục pixel.
 *
 * Menu vẫn là `<details>`/`<summary>` gốc — đóng/mở, thao tác bàn phím và ngữ nghĩa cho
 * trình đọc màn hình đều có sẵn trong thẻ, cùng kỹ thuật đã dùng ở
 * `app/tui-hanh-trang/page.tsx` và `CountryPicker`. Ba hành vi mà thẻ gốc KHÔNG có (đóng
 * khi bấm Escape, khi bấm ra ngoài, khi tiêu điểm Tab đi qua) nay do `MenuKeSach` thêm
 * vào; lý do không dùng `popover="auto"` nằm trong chính file đó.
 *
 * Header là async vì nó hỏi `isAdmin()`. Cả 8 nơi dựng `Header` đều là Server Component
 * async nên không chỗ nào phải sửa. Đi đường này thay vì thêm một cờ `laAdmin` vào
 * `/api/auth/me`: một file thay vì ba, và cờ admin không lộ ra bề mặt client. Người chưa
 * đăng nhập không tốn truy vấn nào — `getAdminUserId()` trả `null` ngay khi không có phiên.
 */
export async function Header({
  activeHref,
  shelves = [],
}: {
  activeHref: string;
  shelves?: ShelfSummary[];
}) {
  // KHÔNG phải hàng rào bảo mật, chỉ là chuyện hiển thị — ba lớp thật ghi ở lib/admin/gate.ts.
  const laAdmin = await isAdmin();
  const dangODuoiKeSach = shelves.some((s) => `/${s.slug}` === activeHref);

  const mucPhang = [
    { href: "/bai-giang", label: "Bài giảng" },
    { href: "/cong-dong", label: "Cộng đồng" },
  ];

  return (
    // `sticky top-0`: trang chủ cao 3419px và bảng tin Cộng đồng còn dài hơn, nên không dính
    // trên cùng nghĩa là mỗi lần muốn đổi kệ phải cuộn ngược về đỉnh. DESIGN.md § Layout nói
    // thẳng "Header cao 72px và luôn dính trên cùng". An toàn với màn đọc sách: nó là
    // `<dialog>` gốc mở bằng `showModal()` nên nằm ở top layer, trên mọi z-index của trang.
    // `border-b` để khi dải nâu trôi trên nền `neutral` sáng nó vẫn tách khỏi nội dung.
    <header className="sticky top-0 z-40 flex h-header-height items-center justify-between gap-lg border-b border-primary-dark bg-primary px-page-margin">
      <Link
        href="/"
        className={`whitespace-nowrap font-heading text-headline-sm text-on-primary ${FOCUS_RING_ON_DARK}`}
      >
        CỬA SỔ LỊCH SỬ
      </Link>

      {/* Hai nhóm, không phải một dãy chín mục ngang hàng: "đi đâu" (nav) và "tôi là ai /
          tôi đang có gì" (streak, túi, tài khoản) là hai câu hỏi khác nhau. Ngoài chuyện
          nhịp đọc, đây còn là lỗi trợ năng có thật ở bản trước: nút Đăng xuất và một con số
          tĩnh nằm bên trong landmark "Điều hướng chính". */}
      <div className="flex items-center gap-lg">
        <nav className="flex items-center gap-md" aria-label="Điều hướng chính">
          <Link
            href="/"
            aria-current={activeHref === "/" ? "page" : undefined}
            className={navItemClass(activeHref === "/")}
          >
            Trang chủ
          </Link>

          {shelves.length > 0 && (
            // `key={activeHref}`: `<details open>` là trạng thái DOM không kiểm soát, nên
            // sau khi bấm một kệ, React tái dùng đúng phần tử đó và menu ở lại trạng thái
            // mở trên trang mới. Đổi key theo trang buộc React tháo ra dựng lại — menu tự
            // đóng sau mỗi lần điều hướng mà không cần một dòng JS nào.
            <MenuKeSach key={activeHref} className="group relative">
              <summary
                // `"true"` chứ không `"page"`: đây là nút mở menu, không phải một trang.
                // Để `"page"` thì khi đang ở một trang kệ, giá trị đó xuất hiện HAI lần trong
                // cùng một landmark nav — ở `<summary>` và ở mục kệ ngay bên dưới.
                aria-current={dangODuoiKeSach ? "true" : undefined}
                className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${navItemClass(
                  dangODuoiKeSach,
                )}`}
              >
                Kệ sách
                {/* Không có `transition` cho mũi tên: bỏ luôn được câu hỏi
                    prefers-reduced-motion, mà trạng thái cuối vốn giống nhau ở hai chế độ. */}
                <ChevronDown aria-hidden className="h-4 w-4 group-open:rotate-180" />
              </summary>

              <ul className="absolute right-0 top-full z-50 mt-sm min-w-[14rem] rounded-md bg-primary-dark p-xs">
                {shelves.map((s) => {
                  const dangMo = `/${s.slug}` === activeHref;
                  return (
                    <li key={s.slug}>
                      <Link
                        href={`/${s.slug}`}
                        aria-current={dangMo ? "page" : undefined}
                        className={`block whitespace-nowrap rounded-sm px-md py-sm font-body text-label-md transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark ${
                          dangMo
                            ? "bg-primary text-tertiary-light"
                            : "text-on-primary hover:bg-primary"
                        }`}
                      >
                        {s.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </MenuKeSach>
          )}

          {mucPhang.map((item) => {
            const dangMo = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={dangMo ? "page" : undefined}
                className={navItemClass(dangMo)}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Trước đây KHÔNG có đường nào từ giao diện vào khu quản trị — admin phải nhớ và
              gõ `/quan-tri` bằng tay, trong khi đó là cách DUY NHẤT sửa nội dung đang chạy.
              Icon bánh răng là tín hiệu hình dạng: mục nav duy nhất có icon, nên nó tách ra
              khỏi bốn mục nội dung mà không cần thêm một mảng màu cam thứ hai vào header. */}
          {laAdmin && (
            <Link
              href="/quan-tri"
              aria-current={activeHref === "/quan-tri" ? "page" : undefined}
              className={navItemClass(activeHref === "/quan-tri")}
            >
              <Settings aria-hidden className="h-4 w-4" />
              Quản trị
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-md border-l border-primary-dark pl-lg">
          <HeaderStats activeHref={activeHref} />
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
