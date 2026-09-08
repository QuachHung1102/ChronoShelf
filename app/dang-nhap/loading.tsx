import { SKELETON_HEADER } from "@/components/ui/controls";

/**
 * Khung xương riêng cho `/dang-nhap`, vì trang đó là nền TỐI.
 *
 * `app/loading.tsx` ở gốc che mọi route nền sáng và tự nhận trong chú thích rằng
 * `/dang-nhap` là một trong số đó — điều đó SAI: `app/dang-nhap/page.tsx` bọc nội dung
 * trong `<Room>`, và `Room` sơn `surface-room`. Dùng chung khung xương sáng ở đây cho ra
 * đúng cú lóe trắng mà `app/[shelf]/loading.tsx` được dựng ra để tránh.
 *
 * Không dùng `<Room>` thật: nó kéo theo cả lớp nền, luồng sáng và hạt bụi cho một thứ
 * sống chưa tới một giây. Một khối `bg-surface-room` là đủ — thứ phải khớp là MÀU, để
 * không có cú đổi nền nào khi trang thật tới.
 */
export default function DangTaiDangNhap() {
  return (
    <>
      <div className={SKELETON_HEADER}>
        <span className="font-heading text-headline-sm text-on-primary">CỬA SỔ LỊCH SỬ</span>
      </div>

      <main id="noi-dung" className="flex flex-1 items-center justify-center bg-surface-room px-page-margin py-xl">
        <div className="w-full max-w-md rounded-lg bg-neutral p-xl">
          <p role="status" className="font-body text-label-caps uppercase text-tertiary-deep">
            Đang tải…
          </p>
          {/* Cùng một màu xương với `app/loading.tsx`, cùng một lý do: phải nhìn thấy được. */}
          <div aria-hidden className="mt-md flex flex-col gap-md">
            <div className="h-xl w-2/3 rounded-md bg-surface-locked/30" />
            <div className="h-md w-full rounded-md bg-surface-locked/30" />
            <div className="h-2xl w-full rounded-md bg-surface-locked/30" />
          </div>
        </div>
      </main>
    </>
  );
}
