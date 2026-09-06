import { SKELETON_HEADER } from "@/components/ui/controls";

/**
 * Khung xương riêng cho màn kệ sách — bản duy nhất tách khỏi `app/loading.tsx`.
 *
 * Lý do tách: căn phòng thư viện là nền TỐI (`surface-room`) trong khi mọi trang khác
 * nền `neutral` sáng. Dùng chung khung xương sáng ở đây là mỗi lần mở một kệ, màn hình
 * loé trắng một nhịp rồi mới tối lại — đúng thứ khó chịu mà khung xương sinh ra để tránh.
 *
 * Giữ đúng khung của `BookShelf`: cột giữa `max-w-[1180px]`, `justify-center`, dòng nhãn
 * "Kệ sách" rồi tới tên kệ. Chữ trên nền tối dùng `tertiary-light`/`secondary-light` —
 * DESIGN.md § Do's and Don'ts cấm `secondary`/`primary-dark` ở đây.
 *
 * CỐ Ý không vẽ từng gáy sách giả: hình dạng tủ thật do dữ liệu quyết định (số quyển, số
 * tầng), nên một hàng sách giả sai số lượng chỉ đổi một cú nhảy này lấy một cú nhảy khác.
 * Một khối tủ đặc nói đúng chỗ nội dung sắp hiện ra là đủ.
 */
export default function DangTaiKeSach() {
  return (
    <>
      {/* Giữ tên sản phẩm bằng chữ thật — cùng lý do như `app/loading.tsx`. */}
      <div className={SKELETON_HEADER}>
        <span className="font-heading text-headline-sm text-on-primary">CỬA SỔ LỊCH SỬ</span>
      </div>

      <main id="noi-dung" className="flex flex-1 flex-col bg-surface-room">
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col justify-center gap-lg px-page-margin py-xl">
          <div>
            <p role="status" className="font-body text-label-caps uppercase text-tertiary-light">
              Đang mở kệ sách…
            </p>
            <div aria-hidden className="mt-sm h-xl w-1/2 max-w-measure rounded-sm bg-surface-locked" />
          </div>
          {/* Khối tủ. `bg-surface-shelf` là đúng màu thân tủ thật, nên lúc nội dung thay
              vào chỗ này thì chỉ có sách hiện thêm ra chứ nền không đổi màu. */}
          <div aria-hidden className="h-[18rem] w-full rounded-md bg-surface-shelf" />
        </div>
      </main>
    </>
  );
}
