import Link from "next/link";
import { Compass } from "lucide-react";
import { PRIMARY_BUTTON } from "@/components/ui/controls";

export const dynamic = "force-dynamic";

/**
 * Màn 404 bằng tiếng Việt.
 *
 * `notFound()` được gọi THẬT ở `app/[shelf]/page.tsx` và `app/quan-tri/[shelf]/page.tsx`,
 * nên nếu không có file này thì màn mặc định tiếng Anh của Next nằm ngay trong đường đi
 * của học sinh — chỉ cần gõ sai một chữ trong URL.
 *
 * Vẫn dựng `Header` để người dùng có đường đi tiếp thay vì một ngõ cụt.
 */
export default async function NotFound() {

  return (
    <main id="noi-dung" className="mx-auto flex min-w-0 max-w-2xl flex-1 flex-col items-center justify-center gap-md px-page-margin py-xl text-center"
    >
      <Compass aria-hidden className="h-12 w-12 text-ink-dilute" />
      <h1 className="font-ui text-display-md text-primary">
        Không tìm thấy trang này
      </h1>
      <p className="max-w-measure font-ui text-body-md text-ink-dilute">
        Có thể kệ sách đã đổi tên, hoặc đường dẫn bị gõ sai. Thử quay lại thư viện và chọn từ đầu.
      </p>
      <Link href="/" className={PRIMARY_BUTTON}>
        Về thư viện
      </Link>
    </main>
  );
}
