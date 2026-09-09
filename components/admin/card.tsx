import { ChevronDown } from "lucide-react";
import { CHIP } from "@/components/ui/controls";

/**
 * Từ vựng dùng chung của **thẻ quản trị**. Cùng lý do tồn tại với
 * `components/ui/controls.ts`: chuỗi class chép qua năm file là cách chắc chắn nhất để
 * chúng lệch nhau dần — `ICON_BUTTON` đã bị chép nguyên văn ba lần (`ShelfAdmin`,
 * `BookAdmin`, `PageAdmin`) trước khi được gom về đây thành `ORDER_BUTTON`.
 *
 * Chỉ hằng chuỗi + hai component không trạng thái. Không có mảnh client nào ở đây.
 */

/**
 * Khung của mọi thẻ nội dung trong khu quản trị.
 *
 * Viền là **bắt buộc**, không phải trang trí: trước đó thẻ chỉ có `bg-surface` (#FBF4E4)
 * đặt trên nền trang `neutral` (#EFE3CB) — đo được 1.16:1, tức không có ranh giới nào cả.
 * Trên màn 13 vật phẩm hay 6 quyển sách, mắt không cắt được thẻ này sang thẻ kia và cả
 * trang nhòe thành một cột form vô tận. Đây cũng đúng ngôn ngữ thẻ mà `/bai-giang` và
 * `/cong-dong` đã dùng.
 *
 * Chọn `secondary` (#7A6248 — 5.22:1 trên `surface`) chứ KHÔNG phải `surface-locked`
 * (9.20:1) là có chủ ý: `FIELD` trong `components/ui/controls.ts` đã lấy `surface-locked`
 * cho viền ô nhập, nên khung thẻ phải nhạt hơn một bậc. Đường mạnh nhất trên màn hình
 * phải là chỗ gõ chữ, không phải cái hộp bao quanh nó.
 */
// Alias của `CARD` với padding chật hơn một bậc: màn quản trị xếp hàng chục thẻ
// trên một trang, `p-lg` ở đó đẩy nội dung xuống quá xa.
export const ADMIN_CARD = "rounded-md border border-mist bg-surface p-md";

/**
 * Đường kẻ chia phần BÊN TRONG thẻ — cùng màu với khung để mỗi thẻ chỉ có một ngôn ngữ
 * đường kẻ, và để nó không đậm hơn chính cái khung chứa nó.
 */
export const CARD_DIVIDER = "border-mist";

/**
 * Nút đổi thứ tự.
 *
 * `aria-disabled` chứ KHÔNG `disabled`: khi admin bấm liên tiếp để đẩy một mục lên đầu,
 * chính cái nút vừa bấm trở thành vô hiệu — trình duyệt lấy luôn tiêu điểm khỏi một phần
 * tử `disabled`, nên người dùng bàn phím rơi về `<body>` và phải Tab lại từ đầu trang.
 * `aria-disabled` giữ nút trong luồng Tab; thứ chặn submit là `type="button"` — thuần
 * HTML, không cần JavaScript. Cùng kỹ thuật với gợi ý trạng thái trên gáy sách ở `components/shelf/BookStack.tsx`.
 *
 * Đánh đổi: mất phần tự khóa lúc đang gửi của `SubmitButton`, nên bấm nhanh hai lần có
 * thể đổi chỗ hai lần. Không mất mát gì và hoàn tác được bằng nút ngược lại.
 */
export const ORDER_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-dilute transition-colors " +
  "duration-200 ease-out hover:text-son aria-disabled:cursor-not-allowed " +
  "aria-disabled:opacity-50 aria-disabled:hover:text-ink-dilute " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface";

/**
 * Chip trạng thái xuất bản.
 *
 * Hai vai đã bị **đảo lại**. Bản trước cho "ĐÃ XUẤT BẢN" một viên thuốc cam chói còn
 * "NHÁP" thì `bg-paper` trên thẻ `bg-surface` — 1.16:1, tức viên thuốc không tồn tại
 * về mặt thị giác. Nhấn mạnh đó ngược với việc admin đang làm: thứ CẦN bắt được bằng mắt
 * khi lướt là "học sinh chưa thấy nội dung này", còn "đã xuất bản" mới là trạng thái bình
 * thường. Một mục nháp lọt giữa danh sách mà trượt mắt thì admin tưởng đã xuất bản trong
 * khi chưa.
 *
 * Bỏ cam khỏi chip còn trả lại cho `PRIMARY_BUTTON` ("Lưu") vai trò điểm cam DUY NHẤT
 * trong thẻ — đúng luật "một điểm phát sáng mỗi màn hình" của DESIGN.md.
 *
 * Cả hai nhánh đều đủ tương phản: nháp là `on-primary` trên `primary-dark` (12.37:1),
 * đã xuất bản là `primary-dark` trên `neutral` (11.40:1) kèm viền `secondary` để cái
 * chip vẫn đọc ra là chip.
 */
export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`${CHIP} ${
        published
          ? "border border-mist bg-paper text-primary"
          : "bg-primary text-on-ink"
      }`}
    >
      {published ? "Đã xuất bản" : "Nháp"}
    </span>
  );
}

/**
 * Thân thẻ **gập được** — nơi chứa biểu mẫu soạn thảo của một thẻ quản trị.
 *
 * Dùng `<details>` của HTML chứ không phải state React, vì ba lý do đều là lý do thật:
 *  1. Không tốn thêm một mảnh client nào — cả năm màn quản trị vẫn là Server Component.
 *  2. Trạng thái mở/gập là thuộc tính DOM, nên nó **sống qua** lần gửi Server Action:
 *     `key` của thẻ không đổi ⇒ React giữ nguyên nút DOM ⇒ `open` còn nguyên. Với
 *     `useState` thì phải biến cả danh sách thành client component mới giữ được.
 *  3. Đóng/mở bằng bàn phím và ngữ nghĩa cho trình đọc màn hình có sẵn trong thẻ.
 * Cùng lối đã dùng ở `app/tui-hanh-trang/page.tsx`.
 *
 * Mặc định GẬP. `/quan-tri/vat-pham` từng dài 6175px — tám màn hình 768px — chỉ với 13
 * vật phẩm, và nó dài thêm theo mỗi lần admin tạo nội dung. Gập lại thì trang thành một
 * mục lục lướt được, còn phần soạn thảo chỉ mở ở đúng mục đang sửa.
 *
 * Chevron ở đây là glyph GẬP/MỞ. Đó chính là lý do nút đổi thứ tự phải chuyển sang mũi
 * tên (`ArrowUp`/`ArrowDown`): để hai cặp glyph trên cùng một header không nói hai chuyện
 * khác nhau.
 */
export function CardDisclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className={`group mt-sm border-t ${CARD_DIVIDER} pt-sm`}>
      <summary
        className={
          "flex w-fit cursor-pointer list-none items-center gap-xs rounded-sm font-ui " +
          "text-label-md text-son [&::-webkit-details-marker]:hidden " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
          "focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        }
      >
        {/* Micro-interaction 200ms ease-out, đúng bảng Motion của DESIGN.md. Tắt chuyển
            động thì chevron nhảy thẳng sang trạng thái cuối — giống hệt nhau ở hai chế
            độ, không mất thông tin nào. */}
        <ChevronDown
          aria-hidden
          className="h-4 w-4 transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
        />
        {label}
      </summary>
      <div className="mt-sm">{children}</div>
    </details>
  );
}
