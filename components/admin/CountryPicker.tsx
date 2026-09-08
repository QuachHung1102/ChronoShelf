"use client";

import { useEffect, useState } from "react";
import { FIELD, LABEL } from "@/components/ui/controls";

interface Nuoc {
  id: string;
  name: string;
  d: string;
}

interface BanDo {
  viewBox: string;
  countries: Nuoc[];
}

/**
 * Một promise dùng chung cho MỌI picker trên trang. `/quan-tri` có một picker cho mỗi kệ,
 * và file bản đồ hơn 1 MB — để mỗi picker tự `fetch` là tải lại đúng file đó n lần.
 */
let dangTai: Promise<BanDo> | null = null;
const taiBanDo = (): Promise<BanDo> =>
  (dangTai ??= fetch("/world-countries.json").then((r) => {
    if (!r.ok) throw new Error(`Không tải được bản đồ: ${r.status}`);
    return r.json() as Promise<BanDo>;
  }));

/**
 * Chọn quốc gia cho một kệ, bằng bản đồ bấm được hoặc bằng danh sách.
 *
 * Hai điều cố ý:
 *
 * 1. **`<select>` mới là ô điều khiển thật**, bản đồ `aria-hidden`. Một `<path>` SVG không
 *    focus được bằng bàn phím và không có tên cho trình đọc màn hình; dựng lại toàn bộ
 *    ngữ nghĩa đó bằng ARIA cho 235 vùng là nhiều mã hơn và dễ sai hơn một thẻ `<select>`
 *    gốc làm đúng y hệt việc ấy. Bản đồ là lối tắt cho chuột, không phải lối đi duy nhất.
 * 2. **Bản đồ nằm trong `<details>`**, chỉ dựng khi mở. 235 `<path>` nhân với số kệ là
 *    một cây DOM lớn cho thứ mà admin chỉ đụng tới đôi lần.
 *
 * `<input type="hidden">` luôn có mặt và mang sẵn giá trị cũ, nên bấm Lưu trong lúc bản đồ
 * còn đang tải cũng không xóa mất mã đang có.
 */
export function CountryPicker({
  id,
  name,
  defaultValue,
  className,
}: {
  id: string;
  name: string;
  defaultValue: string;
  className?: string;
}) {
  const [banDo, setBanDo] = useState<BanDo | null>(null);
  const [loi, setLoi] = useState(false);
  const [chon, setChon] = useState(defaultValue);
  const [moBanDo, setMoBanDo] = useState(false);

  useEffect(() => {
    let conSong = true;
    taiBanDo().then(
      (d) => conSong && setBanDo(d),
      () => conSong && setLoi(true),
    );
    return () => {
      conSong = false;
    };
  }, []);

  const dangChon = banDo?.countries.find((c) => c.id === chon);

  return (
    <span className={`flex flex-col gap-xs ${className ?? ""}`}>
      <input type="hidden" name={name} value={chon} />

      <label className={LABEL} htmlFor={id}>
        Quốc gia của kệ
      </label>

      {loi ? (
        // Bản đồ hỏng thì vẫn phải sửa được mã — không khóa admin ra ngoài vì một file tĩnh.
        <input
          id={id}
          value={chon}
          onChange={(e) => setChon(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric"
          placeholder="704"
          className={FIELD}
        />
      ) : (
        <select
          id={id}
          value={chon}
          onChange={(e) => setChon(e.target.value)}
          disabled={!banDo}
          className={FIELD}
        >
          <option value="">{banDo ? "— Không gắn nước nào —" : "Đang tải bản đồ…"}</option>
          {banDo?.countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.id})
            </option>
          ))}
          {/* Mã đang lưu mà không có trong bản đồ thì vẫn phải hiện, nếu không lần Lưu kế
              tiếp sẽ âm thầm đổi nó thành rỗng. */}
          {chon && banDo && !dangChon && <option value={chon}>Mã {chon} (ngoài bản đồ)</option>}
        </select>
      )}

      <details
        onToggle={(e) => setMoBanDo((e.currentTarget as HTMLDetailsElement).open)}
        className="mt-xs"
      >
        <summary className="cursor-pointer font-body text-caption text-tertiary-deep">
          Hoặc chọn trên bản đồ
        </summary>

        {moBanDo && banDo && (
          <svg
            viewBox={banDo.viewBox}
            aria-hidden
            className="mt-xs w-full rounded-md border border-surface-locked bg-neutral"
            onClick={(e) => {
              const id = (e.target as SVGElement).dataset?.id;
              if (id) setChon(id === chon ? "" : id);
            }}
          >
            {banDo.countries.map((c) => (
              <path
                key={c.id}
                d={c.d}
                data-id={c.id}
                className={
                  c.id === chon
                    ? "cursor-pointer fill-tertiary-deep stroke-surface"
                    : "cursor-pointer fill-secondary stroke-neutral hover:fill-tertiary"
                }
                strokeWidth={0.3}
              >
                <title>{c.name}</title>
              </path>
            ))}
          </svg>
        )}
      </details>

      <span className="font-body text-caption text-secondary">
        {dangChon
          ? `Đang chọn ${dangChon.name} — mã ISO ${dangChon.id}.`
          : chon
            ? `Đang giữ mã ISO ${chon}.`
            : "Chưa gắn với nước nào. Bỏ trống cũng được."}
      </span>
    </span>
  );
}
