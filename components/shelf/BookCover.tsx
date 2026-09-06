"use client";

import type { CSSProperties } from "react";
import { Check, Lock } from "lucide-react";
import type { BookView } from "@/lib/api/types";
import s from "./BookCover.module.scss";

// Padding lệch trái/phải là cố ý: bên trái phải né cạnh gáy 10px, bên phải né mép giấy 5px,
// và cả hai còn phải né nét khung nhũ chìm ở 9px (xem .cover trong BookCover.module.scss).
const COVER = `${s.cover} flex w-full flex-col rounded-md pb-lg pl-[22px] pr-[18px] pt-md text-left`;

const TOOLTIP = `${s.tooltip} z-20 rounded-sm bg-primary-dark px-sm py-xs text-center font-body text-caption text-secondary-light`;

// Sách thật trên kệ không cao bằng nhau, không dày bằng nhau và không cùng một sắc da.
// Lấy theo VỊ TRÍ quyển sách chứ không random: kệ phải trông y hệt nhau giữa server render
// và client hydrate.
//
// Ba mảng này là TỈ LỆ, không phải số px — và đó là điểm khác so với bản trước. Bản trước
// dùng `HEIGHTS = [264, 252, 272, 258, 267]` px tuyệt đối rồi kẹp bằng `min(…, 30vh)`; giá
// trị nhỏ nhất trong mảng là 252px nên phải có khung nhìn cao ≥ 840px mới thấy được BẤT KỲ
// khác biệt nào. Hai độ phân giải dự án cam kết là 1280×800 và 1024×768, nên trần vh luôn
// thắng và cả năm quyển cao đúng bằng nhau — chủ ý "sách không đều nhau" chưa từng hiện lên
// màn hình lần nào. Nhân với một tỉ lệ thì biến thiên sống sót qua mọi trần.
const SCALES = [1, 0.955, 1.03, 0.977, 1.011];
const WIDTHS = [1, 0.955, 0.9, 0.985, 0.925];
const SHADES = [1, 0.9, 1.08, 0.94, 1.04];

// Số hiệu dập trên bìa. Đây là thứ phân biệt các quyển với nhau khi chúng cùng trạng thái.
// Chữ số La Mã vì cùng ngôn ngữ với bìa sách đóng cổ; quá mười quyển thì rơi về số thường
// thay vì bịa thêm ký tự.
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function BookCover({
  view,
  index,
  onOpen,
  justUnlocked = false,
  isNext = false,
}: {
  view: BookView;
  /** Vị trí trên kệ — quyết định chiều cao, bề ngang và sắc da của quyển này. */
  index: number;
  onOpen: (bookSlug: string) => void;
  /** Quyển này VỪA mở khóa trong lượt vừa rồi — chạy một lần hoạt cảnh đai sắt bật ra.
   *  Đây là chặng thứ BA của chuỗi nhận thưởng mà DESIGN.md đặc tả (vật phẩm rơi → bay
   *  vào túi → ổ khóa bật mở); hai chặng đầu đã có sẵn. */
  justUnlocked?: boolean;
  /**
   * Quyển tiếp theo cần đọc — quyển DUY NHẤT được phát sáng trên cả màn hình.
   *
   * Trước đây điều kiện phát sáng là `!isLocked && !isCompleted`, tính tại chỗ trên từng
   * bìa. Với kệ cũ (chuỗi mở khóa tuyến tính) thì đúng một quyển thỏa, nên lỗi không lộ ra.
   * Nhưng một kệ admin vừa tạo thì chưa quyển nào có vật phẩm thưởng, `prevRewardItem` bằng
   * null ở mọi vị trí, nên `resolveState` trả "unlocked" cho TẤT CẢ — và cả kệ cùng nhấp
   * nháy, tức mất sạch chỉ dẫn "đọc quyển nào tiếp theo" (DESIGN.md § Quầng sáng mời gọi:
   * "Một màn hình có hai quầng sáng là một màn hình không có chỉ dẫn nào"). Quyết định
   * thuộc về cả kệ, nên nó phải do BookShelf tính một lần rồi truyền xuống.
   */
  isNext?: boolean;
}) {
  const { book, state, requiredItem } = view;
  const isLocked = state === "locked";
  const isCompleted = state === "completed";
  const isDraft = !book.published;

  const hint = isLocked
    ? requiredItem
      ? `Cần ${requiredItem.name} để mở`
      : "Chưa mở khóa"
    : isCompleted
      ? "Đã đọc xong — bấm để đọc lại"
      : "Sẵn sàng để đọc";

  const nhan = [
    book.title,
    book.era,
    isDraft ? "bản nháp, học sinh chưa nhìn thấy" : null,
    isNext ? "quyển nên đọc tiếp" : null,
    hint,
  ]
    .filter(Boolean)
    .join(" — ");

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
        aria-label={nhan}
        style={
          {
            "--book-scale": SCALES[index % SCALES.length],
            "--book-width": WIDTHS[index % WIDTHS.length],
            "--book-shade": SHADES[index % SHADES.length],
          } as CSSProperties
        }
        className={`${COVER} relative z-10 transition-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark motion-reduce:transition-none ${
          isLocked
            ? `${s.locked} cursor-not-allowed`
            : "cursor-pointer hover:-translate-y-2 motion-reduce:hover:translate-y-0"
        } ${isNext ? s.glow : ""}`}
      >
        {/* Ảnh bìa do admin tải lên. Không có thì bìa vẫn vẽ bằng CSS như cũ — đó là
            trạng thái mặc định, không phải trạng thái hỏng. */}
        {book.cover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh trong bảng media, phục vụ qua /media/[id] */}
            <img src={book.cover} alt="" className={s.coverArt} loading="lazy" decoding="async" />
            {/* Màn chắn tối dần xuống chân bìa. Chỉ `brightness()` trên ảnh là KHÔNG đủ:
                một tấm bìa sáng vẫn kéo tên sách xuống 2.87:1 (đo 2026-09-04), dưới ngưỡng
                AA — mà comment cũ lại khẳng định ngược lại. Màn chắn này là thứ bảo đảm
                nền dưới chữ luôn tối, bất kể admin tải ảnh gì lên. */}
            <span aria-hidden className={s.coverScrim} />
          </>
        )}

        {/* Hàng huy hiệu trên cùng. Chiều cao CỐ ĐỊNH kể cả khi rỗng: không có nó thì bìa
            có dấu triện đẩy toàn bộ ruột xuống, và số hiệu La Mã của các quyển cạnh nhau
            lệch nhau 12–20px dọc theo hàng sách. */}
        <span className={s.badgeRow}>
          {isDraft && (
            // Bản nháp chỉ admin mới thấy (policy "read published" lọc sạch với người
            // thường). Không đánh dấu thì admin không phân biệt được quyển học sinh đã
            // thấy với quyển chưa — và trang Bài giảng thì đã có nhãn "(nháp)" từ trước.
            <span className={`${s.draftTag} font-body text-label-caps`}>Nháp</span>
          )}
          {isCompleted && (
            <span className={s.stamp}>
              <Check aria-hidden className="h-3 w-3 text-on-primary" />
            </span>
          )}
        </span>

        {/* Khoảng giữa co giãn: ổ khóa hoặc số hiệu nằm chính giữa mặt bìa, tên sách luôn ở
            đáy — cùng một khung cho cả ba trạng thái nên tên sách không nhảy chỗ khi mở khóa. */}
        <span className={s.center}>
          {/* Đai vẫn render thêm MỘT nhịp sau khi mở khóa, để có thứ mà bật ra. Không có
              nhánh justUnlocked thì nó biến mất tức thì cùng lúc state đổi, và chặng thứ ba
              của chuỗi nhận thưởng không có gì để diễn. */}
          {(isLocked || justUnlocked) && (
            <span aria-hidden className={`${s.ironBand} ${justUnlocked ? s.bandBreak : ""}`} />
          )}

          {/* MỘT huy chương số hiệu cho cả ba trạng thái, ổ khóa chỉ là phù hiệu gắn thêm.
              Bản trước quyển khóa KHÔNG có số hiệu — nên bốn bìa khóa giống hệt nhau tới
              từng pixel ngoài dòng tên, đúng thứ mà chính số hiệu sinh ra để giải quyết.
              Dùng chung một mỏ neo thị giác còn giữ cho số hiệu không nhảy chỗ lúc quyển
              chuyển từ khóa sang mở. */}
          <span aria-hidden className={`${s.emblem} ${isLocked ? s.emblemLocked : ""}`}>
            {ROMAN[index] ?? index + 1}
            {isLocked && (
              <span className={s.lockBadge}>
                <Lock className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        </span>

        {/* Khối tên sách có chiều cao tối thiểu bằng hai dòng: tên một dòng và tên hai dòng
            không được làm mọi thứ phía trên nhảy chỗ. Quá ba dòng thì cắt bằng dấu ba chấm —
            trước đây tên dài tràn hẳn xuống khỏi mặt bìa. */}
        <span className={s.titleBox}>
          <span
            // Bìa khóa đã dùng nền `surface-locked`; làm mờ thêm bằng opacity là giả một
            // token không khai báo được, mà `design:lint` thì mù với opacity. Đổi màu chữ
            // sang token thật để hàng rào tự động còn nhìn thấy.
            className={`${s.title} text-center font-heading text-title-book ${
              isLocked ? "text-secondary-light" : "text-on-primary"
            }`}
          >
            {book.title}
          </span>
        </span>

        {/* Niên đại dập dưới tên sách. Nó vừa là thứ phân biệt các bìa với nhau, vừa là
            thông tin học sinh cần trước cả khi mở quyển sách ra. */}
        <span aria-hidden className={s.eraRule} />
        <span className="text-center font-body text-caption text-secondary-light">{book.era}</span>
      </button>
    </div>
  );
}
