"use client";

import type { CSSProperties } from "react";
import { Check, Lock } from "lucide-react";
import type { BookView } from "@/lib/api/types";
import s from "./BookCover.module.scss";

// Padding lệch trái/phải là cố ý: bên trái phải né cạnh gáy 10px, bên phải né mép giấy 5px,
// và cả hai còn phải né nét khung nhũ chìm ở 9px (xem .cover trong BookCover.module.scss).
const COVER = `${s.cover} flex w-full flex-col rounded-md pb-lg pl-[22px] pr-[18px] pt-lg text-left`;

const TOOLTIP = `${s.tooltip} z-20 rounded-sm bg-primary-dark px-sm py-xs text-center font-body text-caption text-secondary-light`;

// Sách thật trên kệ không cao bằng nhau và không cùng một sắc da. Lấy theo vị trí quyển
// sách chứ không random: kệ phải trông y hệt nhau giữa server render và client hydrate.
const HEIGHTS = [264, 252, 272, 258, 267];
const SHADES = [1, 0.94, 1.05, 0.97, 1.02];

// Số hiệu dập trên bìa. Đây là thứ phân biệt năm quyển với nhau khi cả năm đều đang khóa —
// trước đó bốn quyển khóa giống hệt nhau tới từng pixel. Chữ số La Mã vì cùng ngôn ngữ với
// bìa sách đóng cổ; quá mười quyển thì rơi về số thường thay vì bịa thêm ký tự.
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function BookCover({
  view,
  index,
  onOpen,
  justUnlocked = false,
}: {
  view: BookView;
  /** Vị trí trên kệ — quyết định chiều cao và sắc da của quyển này. */
  index: number;
  onOpen: (bookSlug: string) => void;
  /** Quyển này VỪA mở khóa trong lượt vừa rồi — chạy một lần hoạt cảnh đai sắt bật ra.
   *  Đây là chặng thứ BA của chuỗi nhận thưởng mà DESIGN.md đặc tả (vật phẩm rơi → bay
   *  vào túi → ổ khóa bật mở); hai chặng đầu đã có sẵn. */
  justUnlocked?: boolean;
}) {
  const { book, state, requiredItem } = view;
  const isLocked = state === "locked";
  const isCompleted = state === "completed";

  const hint = isLocked
    ? requiredItem
      ? `Cần ${requiredItem.name} để mở`
      : "Chưa mở khóa"
    : isCompleted
      ? "Đã đọc xong — bấm để đọc lại"
      : "Sẵn sàng để đọc";

  return (
    <div className={`${s.slot} relative`}>
      <span aria-hidden className={TOOLTIP}>
        {hint}
      </span>

      {/* Bóng nằm ngoài nút: hover làm sách nhô lên, bóng phải ở lại trên tấm ván. */}
      <span aria-hidden className={s.groundShadow} />

      <button
        type="button"
        // Quyển đang khóa vẫn là nút và vẫn nhận được focus bàn phím — gợi ý "Cần X để mở"
        // chỉ hiện khi hover/focus, nên nếu nó không focus được thì người dùng bàn phím
        // mất hẳn thông tin đó. `disabled` sẽ lấy mất focus, nên dùng `aria-disabled`.
        aria-disabled={isLocked || undefined}
        onClick={isLocked ? undefined : () => onOpen(book.slug)}
        aria-label={`${book.title}, ${book.era} — ${hint}`}
        style={
          {
            "--book-height": `${HEIGHTS[index % HEIGHTS.length]}px`,
            "--book-shade": SHADES[index % SHADES.length],
          } as CSSProperties
        }
        className={`${COVER} relative z-10 transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark motion-reduce:transition-none ${
          isLocked
            ? `${s.locked} cursor-not-allowed`
            : "cursor-pointer hover:-translate-y-2 motion-reduce:hover:translate-y-0"
        } ${!isLocked && !isCompleted ? s.glow : ""}`}
      >
        {isCompleted && (
          <span className="flex justify-end">
            <span className="flex h-lg w-lg items-center justify-center rounded-full bg-tertiary-deep">
              <Check aria-hidden className="h-3.5 w-3.5 text-on-primary" />
            </span>
          </span>
        )}

        {/* Đai vẫn render thêm MỘT nhịp sau khi mở khóa, để có thứ mà bật ra. Không có
            nhánh justUnlocked thì nó biến mất tức thì cùng lúc state đổi, và chặng thứ ba
            của chuỗi nhận thưởng không có gì để diễn. */}
        {(isLocked || justUnlocked) && (
          <span aria-hidden className={`${s.ironBand} ${justUnlocked ? s.bandBreak : ""}`} />
        )}

        {/* Khoảng giữa co giãn: ổ khóa hoặc số hiệu nằm chính giữa mặt bìa, tên sách luôn ở
            đáy — cùng một khung cho cả ba trạng thái nên tên sách không nhảy chỗ khi mở khóa. */}
        <span className="flex flex-1 items-center justify-center">
          {isLocked ? (
            <Lock aria-hidden className="h-9 w-9 text-secondary-light" />
          ) : (
            <span aria-hidden className={s.emblem}>
              {ROMAN[index] ?? index + 1}
            </span>
          )}
        </span>

        <span
          // Bìa khóa đã dùng nền `surface-locked`; làm mờ thêm bằng opacity là giả một
          // token không khai báo được, mà `design:lint` thì mù với opacity. Đổi màu chữ
          // sang token thật để hàng rào tự động còn nhìn thấy.
          className={`text-center font-heading text-title-book ${
            isLocked ? "text-secondary-light" : "text-on-primary"
          }`}
        >
          {book.title}
        </span>

        {/* Niên đại dập dưới tên sách. Nó vừa là thứ phân biệt các bìa với nhau, vừa là
            thông tin học sinh cần trước cả khi mở quyển sách ra. */}
        <span aria-hidden className={s.eraRule} />
        <span className="text-center font-body text-caption text-secondary-light">
          {book.era}
        </span>
      </button>
    </div>
  );
}
