import s from "./anh-vat-pham.module.scss";

/**
 * Hình một vật phẩm.
 *
 * Hai đường vẽ, và lý do phải có hai:
 *
 * **1. Icon `.svg` trong `public/items/` → vẽ bằng CSS mask.** 13 icon vật phẩm sinh từ
 * bộ Game-icons.net (`scripts/build-item-icons.mjs`) là hình một màu, và chúng CỐ Ý không
 * chứa mã màu nào — thân icon dùng `fill="currentColor"` để màu do token quyết định chứ
 * không do tấm ảnh. Nhưng `currentColor` KHÔNG đi qua được `<img>`: một SVG nạp bằng
 * `<img>` là một tài liệu riêng, không thừa kế CSS của trang, nên `currentColor` rơi về
 * giá trị khởi tạo và mọi icon ra màu ĐEN. Mask thì ngược lại — nó lấy icon làm khuôn và
 * tô bằng `background-color: currentColor` của CHÍNH trang này, nên `text-*` ở nơi gọi
 * quyết định màu, và cùng một file dùng được trên cả nền sáng lẫn nền tối.
 *
 * **2. Ảnh admin tải lên (`/media/<sha256>`, PNG/JPEG/WebP/GIF) → `<img>` như thường.**
 * Mask lên một tấm ảnh nhiều màu sẽ biến nó thành một vệt đặc. Phân nhánh theo đuôi
 * `.svg` chứ không theo cờ riêng: `readImageFields()` chỉ cho qua hai dạng đường dẫn
 * (`/items/<slug>.svg` và `/media/<sha256>`), nên đuôi file là thứ đã được kiểm ở tầng
 * ghi — không phải một phép đoán.
 */
export function AnhVatPham({
  src,
  className,
  /** Chưa sưu tầm được: vẽ thành bóng mờ. Chỉ có tác dụng ở đường mask. */
  mo = false,
}: {
  src: string;
  className?: string;
  mo?: boolean;
}) {
  if (src.endsWith(".svg")) {
    return (
      <span
        aria-hidden
        className={`${s.stencil} ${mo ? s.moDi : ""} ${className ?? ""}`}
        style={{ maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }}
      />
    );
  }

  return (
    // Ảnh tĩnh trong `public/` hoặc blob trong bảng `media`; repo không cài `sharp` nên
    // `next/image` không dùng được — cùng lý do như mọi `<img>` khác trong repo.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${mo ? s.moDi : ""} ${className ?? ""}`} />
  );
}
