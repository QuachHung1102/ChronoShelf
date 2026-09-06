"use client";

import { useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import s from "./home.module.scss";

export interface AnhCoCredit {
  src: string;
  alt: string;
  /** Tác giả + giấy phép, ví dụ "Nguyễn Văn A · CC BY-SA 4.0". Điều kiện BY, bắt buộc. */
  credit: string;
  /** Trang mô tả trên Wikimedia Commons. */
  source: string;
}

interface Props {
  xua: AnhCoCredit;
  nay: AnhCoCredit;
  /** Đọc lên cho trình đọc màn hình, ví dụ "Ẩm thực". */
  chuDe: string;
}

function Ghi({ nhan, anh }: { nhan: string; anh: AnhCoCredit }) {
  const laLink = anh.source.startsWith("https://");
  return (
    <span className="block">
      {nhan}: {anh.credit} —{" "}
      {laLink ? (
        <a
          href={anh.source}
          target="_blank"
          rel="noreferrer noopener"
          className="underline decoration-secondary-light underline-offset-2 transition-colors duration-200 hover:text-tertiary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
        >
          Wikimedia Commons
        </a>
      ) : (
        anh.source
      )}
    </span>
  );
}

/**
 * Hai ảnh chồng lên nhau, kéo vạch giữa để so sánh (content.md §5.1).
 *
 * Bộ điều khiển là một `<input type="range">` thật phủ kín khung, KHÔNG phải trình xử lý
 * kéo tự viết. Đổi lại được cả ba thứ mà bản tự viết phải làm lại từ đầu: mũi tên trái/phải
 * và Home/End trên bàn phím, thao tác cảm ứng, và ngữ nghĩa `slider` cho trình đọc màn hình
 * — với 0 dependency.
 *
 * Giá trị chảy vào CSS qua biến `--vi`; `clip-path` của ảnh "ngày ấy" đọc biến đó. Mặc định
 * 50% nằm trong chính SCSS, nên khi JS chưa chạy khung vẫn hiện đúng một nửa mỗi bên.
 */
export function CompareSlider({ xua, nay, chuDe }: Props) {
  const khung = useRef<HTMLDivElement>(null);
  const [vi, setVi] = useState(50);

  const doi = (giaTri: number) => {
    setVi(giaTri);
    khung.current?.style.setProperty("--vi", `${giaTri}%`);
  };

  return (
    <figure className="flex flex-col gap-sm">
      <div ref={khung} className={`${s.khung} rounded-md bg-surface-locked`}>
        {/* Ảnh "ngày nay" là nền, ảnh "ngày ấy" nằm trên và bị cắt tới vạch. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh commit sẵn trong public/ */}
        <img
          src={nay.src}
          alt={nay.alt}
          className={s.anh}
          width={1280}
          height={800}
          loading="lazy"
          decoding="async"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={xua.src}
          alt={xua.alt}
          className={`${s.anh} ${s.anhXua}`}
          width={1280}
          height={800}
          loading="lazy"
          decoding="async"
        />

        {/* Hai nhãn cố định ở góc trên mỗi nửa khung. Không có chúng thì manh mối DUY NHẤT
            về việc nửa nào là quá khứ nằm ở dòng ghi công 12px bên dưới ảnh — mà chính sự
            đối lập giữa hai nửa mới là nội dung của khối. Với cặp ảnh không có bối cảnh rõ
            (người thời đồ đá / người trong cửa hàng) người xem không nhất thiết đoán ra.

            Nền `primary-dark` ĐẶC chứ không phải nền trong suốt hạ opacity: opacity không
            khai báo được trong khối `components` nên `design:lint` mù với nó, còn cặp
            `on-primary` trên `primary-dark` là 12.37:1 và kiểm được.

            `pointer-events: none` cùng lý do đã ghi cho `.vach`: thanh trượt thật phủ kín
            khung và nằm dưới hai nhãn này, chúng không được nuốt thao tác kéo. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-sm top-sm z-10 rounded-sm bg-primary-dark px-sm py-xs font-body text-label-caps uppercase text-on-primary"
        >
          Ngày ấy
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute right-sm top-sm z-10 rounded-sm bg-primary-dark px-sm py-xs font-body text-label-caps uppercase text-on-primary"
        >
          Bây giờ
        </span>

        <span aria-hidden className={s.vach} />
        <span aria-hidden className={s.num}>
          <MoveHorizontal className="h-5 w-5" />
        </span>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={vi}
          onChange={(e) => doi(Number(e.target.value))}
          className={s.truot}
          aria-label={`${chuDe}: kéo để so sánh ảnh ngày ấy và bây giờ`}
          aria-valuetext={`Hiện ${vi}% ảnh ngày ấy`}
        />
      </div>

      {/* Ghi công NGAY DƯỚI ảnh, không giấu trong tooltip: điều kiện BY của CC BY-SA đòi
          ghi công ở nơi người xem thấy được.

          Ở đây nguồn ĐƯỢC bọc thành liên kết, khác với `BookPage`. Không mâu thuẫn: chỗ kia
          giá trị `image_source` trong database là chuỗi mô tả có khoảng trắng nên bọc vào
          `<a>` ra link chết, còn tám tấm này là URL trang mô tả Commons hợp lệ — đã kiểm
          từng cái trả 200. `Ghi()` vẫn tự phòng: chỉ link khi thật sự là https. */}
      <figcaption className="font-body text-caption text-secondary">
        <Ghi nhan="Ngày ấy" anh={xua} />
        <Ghi nhan="Bây giờ" anh={nay} />
      </figcaption>
    </figure>
  );
}
