"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";

/**
 * Màn lỗi bằng tiếng Việt.
 *
 * Bắt buộc là Client Component — Next quy định vậy cho `error.tsx`, vì nó cần `reset()`.
 * Không dựng `Header` ở đây: lỗi có thể đến TỪ chính lớp đọc dữ liệu mà Header dùng
 * (`readShelfList`), nên gọi lại nó là cách chắc chắn để màn lỗi cũng lỗi theo.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Thông điệp thật không hiện cho người dùng (nó lộ chi tiết bên trong), nhưng phải
    // vào console để còn lần ra được.
    console.error("Lỗi trang:", error);
  }, [error]);

  return (
    <main
      id="noi-dung"
      className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-md px-page-margin py-xl text-center"
    >
      <TriangleAlert aria-hidden className="h-12 w-12 text-destructive" />
      <h1 className="font-heading text-headline-md text-primary-dark">Trang gặp sự cố</h1>
      <p className="max-w-measure font-body text-body-md text-secondary">
        Có gì đó hỏng ở phía máy chủ. Thử tải lại — nếu vẫn vậy thì báo cho người quản lý nội dung.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-md">
        <button type="button" onClick={reset} className={PRIMARY_BUTTON}>
          Thử lại
        </button>
        <Link href="/" className={QUIET_BUTTON}>
          Về thư viện
        </Link>
      </div>
      {/* `digest` là mã Next gán cho lỗi ở production — thứ duy nhất nối được màn hình
          người dùng thấy với dòng log trên máy chủ. */}
      {error.digest && (
        <p className="font-body text-caption text-secondary">Mã lỗi: {error.digest}</p>
      )}
    </main>
  );
}
