import type { ReactNode } from "react";
import s from "./Room.module.scss";

/**
 * Căn phòng thư viện cổ — bối cảnh dùng chung của màn kệ sách và màn đọc sách
 * (DESIGN.md § Layout / Căn phòng thư viện).
 *
 * Các lớp nền đều là đồ họa thuần và `aria-hidden`: chúng không mang thông tin nào,
 * nên trình đọc màn hình phải bỏ qua hết. Nội dung thật nằm ở lớp 3 và là thứ duy
 * nhất sắc nét.
 */
export function Room({
  children,
  className = "",
  anhNen = null,
}: {
  children: ReactNode;
  className?: string;
  /** Ảnh bìa kệ do admin tải lên. Không có thì phòng vẽ hoàn toàn bằng CSS như trước. */
  anhNen?: string | null;
}) {
  return (
    <div className={`${s.room} ${className}`}>
      <div aria-hidden className={s.backdrop} />
      {anhNen && (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh trong bảng media
        <img aria-hidden alt="" src={anhNen} className={s.anhNen} />
      )}
      <div aria-hidden className={s.floor} />
      <div aria-hidden className={s.lightShaft} />
      <div aria-hidden className={s.lightBeam} />
      <div aria-hidden className={s.dust} />
      <div className={s.content}>{children}</div>
    </div>
  );
}
