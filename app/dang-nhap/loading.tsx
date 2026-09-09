/**
 * Khung xương riêng cho `/dang-nhap`.
 *
 * Từ 2026-09-10 trang thật là nền `paper` với chậu mực ở nửa phải, nên khung xương cũng
 * `paper`: thứ phải khớp là MÀU NỀN, để không có cú đổi nền nào khi trang thật tới. Trước
 * đó cả hai là `primary` vì trang bọc trong `<Room>` — căn phòng gỗ đã bị gỡ.
 *
 * KHÔNG dựng chậu mực ở đây: khởi tạo một bộ giải chất lỏng trên GPU cho một khung xương
 * sống chưa tới một giây là trả giá đúng lúc máy đang bận nhất. Mặt nước trống cũng là một
 * mặt nước hợp lệ — nước trong.
 *
 * **KHÔNG vẽ rail.** Rail sống ở `app/layout.tsx`, tức nằm NGOÀI ranh giới Suspense này và
 * không bị thay khi chuyển trang. Bản trước vẽ thêm một rail xương cạnh rail thật.
 */
export default function DangTaiDangNhap() {
  return (
    <main
      id="noi-dung"
      className="flex min-w-0 flex-1 items-center justify-center bg-paper px-page-margin py-xl"
    >
      <div className="w-full max-w-md rounded-md border border-mist bg-surface p-xl">
        <p role="status" className="font-ui text-label-caps uppercase text-ink-dilute">
          Đang tải…
        </p>
        {/* Cùng một màu xương với `app/loading.tsx`, cùng một lý do: phải nhìn thấy được. */}
        <div aria-hidden className="mt-md flex flex-col gap-md">
          <div className="h-2xl w-2/3 rounded-md bg-mist" />
          <div className="h-md w-full rounded-md bg-mist" />
          <div className="h-2xl w-full rounded-md bg-mist" />
        </div>
      </div>
    </main>
  );
}
