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
  className = "font-body text-caption text-secondary",
}: {
  credit: string | null;
  nguon: string | null;
  /** Chữ đứng đầu dòng, ví dụ "Ảnh nền" hay "Ảnh bìa". */
  nhan?: string;
  className?: string;
}) {
  if (!credit) return null;
  const bamDuoc = Boolean(nguon && nguon.startsWith("https://") && !/\s/.test(nguon));

  return (
    <p className={className}>
      {nhan}: {credit}
      {nguon && (
        <>
          {" — "}
          {bamDuoc ? (
            <a
              href={nguon}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
