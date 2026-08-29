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

export const LABEL = "font-body text-label-md text-primary-dark";

/**
 * `border-surface-locked` là bắt buộc, không phải trang trí. Preflight của Tailwind zero hóa
 * `border-width` trên mọi phần tử, nên ô nhập mất viền mặc định của trình duyệt; mà mọi form
 * quản trị lại nằm trong thẻ `bg-surface`, tức ô nhập chìm hẳn vào nền — 1.00:1, trong khi
 * WCAG 1.4.11 đòi 3:1 cho ranh giới thành phần giao diện. `surface-locked` trên `surface` là
 * 9.20:1, và nó đã là màu đường kẻ của khu quản trị (`border-t` ở cuối mỗi thẻ). Cặp màu này
 * được khai báo thành component `input-border` trong DESIGN.md để `design:lint` giữ được nó.
 */
export const FIELD =
  "w-full rounded-md border border-surface-locked bg-surface px-md py-sm font-body text-body-md " +
  `text-primary-dark placeholder:text-secondary ${FOCUS_RING}`;

export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm " +
  "font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 " +
  `disabled:opacity-60 ${FOCUS_RING}`;

export const QUIET_BUTTON =
  "inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep " +
  `underline underline-offset-2 disabled:opacity-60 ${FOCUS_RING}`;

export const DANGER_BUTTON =
  "inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-destructive " +
  `underline underline-offset-2 disabled:opacity-60 ${FOCUS_RING}`;
