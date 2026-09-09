/**
 * Dòng ghi công cho một tấm ảnh — điều kiện BY của CC BY-SA (spec §6).
 *
 * Gom về một chỗ vì trước đó cùng một khối markup nằm rải ở năm nơi (trang sách, vật phẩm
 * rơi ra, mặt bìa trong trình đọc, kệ sách, túi hành trang), và chúng đã bắt đầu trôi khác
 * nhau: chỗ thì in nguyên URL, chỗ thì bọc liên kết.
 *
 * QUY TẮC LINK — cả hai nhánh đều cần thiết, không phải phòng xa thừa:
 *   - Nguồn là URL `https://` thì bọc thành liên kết bấm được.
 *   - Còn lại in nguyên văn. Giá trị `image_source` của năm vật phẩm seed là một chuỗi mô
 *     tả có khoảng trắng và gạch ngang dài ("https://github.com/…/ChronoShelf — public/
 *     items/x.svg"); bọc nó vào `<a href>` chỉ ra một link chết 404. Điều kiện BY đòi ghi
 *     công và NÊU nguồn, không đòi nguồn phải bấm được.
 */
export function GhiCongAnh({
  credit,
  nguon,
  nhan = "Ảnh",
  className = "text-ink-dilute",
  nenToi = false,
}: {
  credit: string | null;
  nguon: string | null;
  /** Chữ đứng đầu dòng, ví dụ "Ảnh nền" hay "Ảnh bìa". */
  nhan?: string;
  /**
   * Class NỐI THÊM, không thay thế. Bản trước để cả kiểu chữ vào giá trị mặc định, nên
   * một call site truyền class bố cục là im lặng đánh rơi luôn `font-ui` và
   * `text-caption` — nó chỉ đúng nhờ may, vì thẻ cha tình cờ đã đặt hai thứ đó.
   */
  className?: string;
  /**
   * Dòng này đứng trên nền tối (phòng đọc, khoang tủ). Đổi token vòng focus: `ring`
   * (#A83A10) trên `surface-reader` chỉ 2.81:1, dưới ngưỡng 3:1 của WCAG 1.4.11.
   */
  nenToi?: boolean;
}) {
  if (!credit) return null;
  const bamDuoc = Boolean(nguon && nguon.startsWith("https://") && !/\s/.test(nguon));

  return (
    <p className={`font-ui text-caption ${className}`}>
      {nhan}: {credit}
      {nguon && (
        <>
          {" — "}
          {bamDuoc ? (
            <a
              href={nguon}
              target="_blank"
              rel="noreferrer noopener"
              // Thiếu token màu offset thì Tailwind rơi về mặc định `#fff` — một màu
              // không có trong bảng, và trên nền sáng thì khe trắng đó vô hình (1.27:1).
              className={
                nenToi
                  ? "underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-ink focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                  : "underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              }
            >
              Nguồn
            </a>
          ) : (
            <>Nguồn: {nguon}</>
          )}
        </>
      )}
    </p>
  );
}
