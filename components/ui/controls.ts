/**
 * Class Tailwind dùng chung cho form. Rút ra khỏi `LoginForm` khi chặng C thêm bốn
 * màn hình toàn form — chép chuỗi qua từng file là cách chắc chắn nhất để chúng lệch
 * nhau dần.
 *
 * Chỉ hằng chuỗi, không component: một `<Input>` bọc sẵn sẽ phải mọc prop cho từng
 * thứ HTML đã làm được (`type`, `pattern`, `inputMode`, `maxLength`…). Chuỗi class
 * không có bề mặt đó.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-neutral";

/**
 * Vòng focus khi thứ bấm được nằm trên nền nâu (header, kệ sách). `ring-on-dark` là cặp
 * DESIGN.md quy định cho trường hợp này — `ring` (#A83A10) trên nền `primary` không đủ tách.
 *
 * Ba file từng chép tay đúng chuỗi này (Header, HeaderStats, AuthMenu) nên nó về đây, cùng
 * chỗ với `FOCUS_RING`, để lần sửa sau không phải sửa ba nơi.
 */
export const FOCUS_RING_ON_DARK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

export const LABEL = "font-body text-label-md text-primary-dark";

/**
 * Một mục trên thanh điều hướng của header (dùng ở `Header`, `HeaderStats`, `AuthMenu`).
 *
 * **Mục đang chọn không được phân biệt CHỈ bằng màu** (WCAG 1.4.1 mức A). `tertiary-light`
 * và `on-primary` chỉ cách nhau 1.35:1, nên với học sinh mù màu đỏ-lục — cỡ 1/12 nam giới,
 * gần như chắc chắn có trong mỗi lớp — hai màu đó là cùng một màu kem. Vì vậy mục đang chọn
 * mang thêm một gạch chân dày.
 *
 * Và hover phải là tín hiệu KHÁC HẠNG với trạng thái chọn: trước đây cả hai cùng đổi chữ
 * sang `tertiary-light`, nên chỉ cần rê chuột qua một mục bất kỳ là header có hai mục trông
 * y hệt nhau và mất luôn dấu "tôi đang ở đâu". Nay hover chỉ hiện gạch chân kem, chữ giữ
 * nguyên: gạch cam = trang hiện tại, gạch kem = đang trỏ tới.
 *
 * `border-y-2` + `border-t-transparent` chứ không phải `border-b-2` + `pb`: viền trên trong
 * suốt giữ hộp chữ đối xứng, nên mục có gạch và mục không gạch cao bằng nhau và không lệch
 * baseline so với khối streak/túi/tài khoản đứng cạnh trong cùng một hàng `items-center`.
 */
export function navItemClass(active: boolean): string {
  return (
    "inline-flex items-center gap-xs whitespace-nowrap border-y-2 border-t-transparent py-xs " +
    "font-body text-label-md transition-colors duration-200 ease-out " +
    FOCUS_RING_ON_DARK +
    (active
      ? " border-b-tertiary-light text-tertiary-light"
      : " border-b-transparent text-on-primary hover:border-b-on-primary")
  );
}

/**
 * `border-surface-locked` là bắt buộc, không phải trang trí. Preflight của Tailwind zero hóa
 * `border-width` trên mọi phần tử, nên ô nhập mất viền mặc định của trình duyệt; mà mọi form
 * quản trị lại nằm trong thẻ `bg-surface`, tức ô nhập chìm hẳn vào nền — 1.00:1, trong khi
 * WCAG 1.4.11 đòi 3:1 cho ranh giới thành phần giao diện. `surface-locked` trên `surface` là
 * 9.20:1, và nó đã là màu đường kẻ của khu quản trị (`border-t` ở cuối mỗi thẻ). Cặp màu này
 * được khai báo thành component `input-border` trong DESIGN.md để `design:lint` giữ được nó.
 */
/**
 * Ô nhập, kèm phần vá autofill.
 *
 * Chrome sơn ô đã tự điền thành xanh #E8F0FE và ghi đè luôn màu chữ — hai vệt xanh không
 * thuộc bảng màu nào của DESIGN.md, và vì chính trình duyệt vẽ nên `design:lint` không
 * nhìn thấy để mà kêu. Không thuộc tính CSS nào đặt lại được `background` của ô autofill,
 * nên dùng mẹo duy nhất còn lại: một `box-shadow` inset đủ dày phủ kín ô. Màu vẫn lấy từ
 * token qua `theme()`, không hardcode hex.
 *
 * Vòng focus KHÔNG mất: Tailwind ghép `--tw-ring-shadow` và `--tw-shadow` vào cùng một
 * `box-shadow`, nên bóng inset nằm dưới vòng ring chứ không thay chỗ nó.
 *
 * Đổi `bg-surface` ở đây thì phải đổi `theme(colors.surface)` trong ba class autofill
 * theo — hai màu lệch nhau sẽ không có gì báo, ô chỉ đơn giản đổi màu lúc người dùng để
 * trình duyệt tự điền.
 */
export const FIELD =
  "w-full rounded-md border border-surface-locked bg-surface px-md py-sm font-body text-body-md " +
  `text-primary-dark placeholder:text-secondary ${FOCUS_RING} ` +
  "autofill:shadow-[inset_0_0_0_1000px_theme(colors.surface)] " +
  "autofill:[-webkit-text-fill-color:theme(colors.primary-dark)] " +
  "autofill:[caret-color:theme(colors.primary-dark)]";

/**
 * Ba hằng nút dưới đây đều có `active:` — cú bấm phải để lại dấu vết trong khoảng trống
 * giữa lúc thả chuột và lúc máy chủ trả lời, đó là ô "đổi trạng thái nút 150–200ms
 * ease-out" trong bảng Motion của DESIGN.md. Trước đây cả ứng dụng không có MỘT trạng
 * thái `:active` nào.
 *
 * Thứ tự biến thể mặc định của Tailwind 3.4 xếp `active` SAU `hover` và TRƯỚC `disabled`,
 * nên `active:brightness-90` thắng `hover:brightness-110` đúng lúc bấm, còn
 * `disabled:opacity-60` vẫn thắng cả hai.
 */
export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm " +
  "font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 " +
  `active:brightness-90 disabled:opacity-60 ${FOCUS_RING}`;

/**
 * Hover của hai nút chữ dưới đây CỐ Ý không dùng nền (`hover:bg-neutral` chẳng hạn): chúng
 * đứng trên cả `bg-surface` (thẻ quản trị, Cộng đồng) lẫn `bg-neutral` (màn lỗi `app/error.tsx`
 * đặt thẳng lên nền trang). Một vệt nền sẽ vô hình đúng ở màn lỗi — nơi cần nó nhất — nên tín
 * hiệu phải là HÌNH DẠNG: gạch chân dày lên. `active:brightness-90` làm chữ đậm hơn, tức tương
 * phản chỉ tăng, không bao giờ trượt xuống dưới AA.
 */
export const QUIET_BUTTON =
  "inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep " +
  "underline underline-offset-2 transition duration-200 ease-out hover:decoration-2 " +
  `active:brightness-90 disabled:opacity-60 ${FOCUS_RING}`;

export const DANGER_BUTTON =
  "inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-destructive " +
  "underline underline-offset-2 transition duration-200 ease-out hover:decoration-2 " +
  `active:brightness-90 disabled:opacity-60 ${FOCUS_RING}`;

/**
 * Khung xương cho `loading.tsx`. Repo chỉ có MỘT layout (`app/layout.tsx`) và nó không dựng
 * `Header` — mỗi trang tự dựng — nên mọi `loading.tsx` thay luôn cả dải header. Vì vậy khung
 * xương phải tự vẽ lại một dải nâu ĐÚNG chiều cao và đúng màu, nếu không mỗi lần bấm liên kết
 * là cả trang nhảy 72px.
 *
 * CỐ Ý không có hoạt cảnh nhấp nháy: trạng thái cuối ở hai chế độ `prefers-reduced-motion`
 * phải giống hệt nhau (DESIGN.md § Motion), và một khối tĩnh kèm chữ "Đang tải…" đã nói đủ.
 */
export const SKELETON_HEADER =
  "sticky top-0 z-40 flex h-header-height items-center border-b border-primary-dark " +
  "bg-primary px-page-margin";

export const SKELETON_BLOCK = "rounded-md bg-surface";
