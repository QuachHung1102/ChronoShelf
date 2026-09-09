---
version: alpha
name: Cửa Sổ Lịch Sử
description: Chậu mực suminagashi — mặt nước trắng giấy, mực chàm chảy thật, chữ đứng yên ở lề ngoài chậu.
colors:
  primary: "#0A1A33"
  ink-current: "#1E2D4A"
  ink-dilute: "#606D80"
  feathered: "#AEB6C2"
  mist: "#DDE2E8"
  paper: "#F6F7F9"
  surface: "#FDFDFE"
  washi: "#F4F2EC"
  son: "#B3311C"
  son-deep: "#8E2412"
  son-light: "#F0C4B6"
  on-ink: "#F6F7F9"
  on-son: "#FFFFFF"
  ring: "#1E2D4A"
  ring-on-ink: "#DDE2E8"
typography:
  display-xl:
    fontFamily: Manrope
    fontSize: 60px
    fontWeight: 200
    lineHeight: 1.05
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: 200
    lineHeight: 1.12
    letterSpacing: -0.015em
  display-md:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: -0.01em
  title-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.3
  title-sm:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.35
  body-md:
    fontFamily: Manrope
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  reading:
    fontFamily: Lexend
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.75
  reading-lead:
    fontFamily: Lexend
    fontSize: 19px
    fontWeight: 300
    lineHeight: 1.7
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.25
  label-caps:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.18em
  caption:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  4xl: 96px
  measure: 560px
  page-margin: 48px
  rail-width: 232px
rounded:
  none: 0px
  sm: 2px
  md: 4px
  lg: 8px
  full: 9999px
components:
  page:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    padding: "{spacing.page-margin}"
  rail:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    width: "{spacing.rail-width}"
  rail-item-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
  rail-item-rest:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-dilute}"
    typography: "{typography.label-md}"
  eyebrow:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-dilute}"
    typography: "{typography.label-caps}"
  gauge-label:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-dilute}"
    typography: "{typography.caption}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  card-ink:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  card-ink-caption:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.feathered}"
    typography: "{typography.body-sm}"
  lesson-undyed:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-dilute}"
    typography: "{typography.title-md}"
    rounded: "{rounded.md}"
  lesson-flowing:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-ink}"
    typography: "{typography.title-md}"
    rounded: "{rounded.md}"
  lesson-settled:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.title-md}"
    rounded: "{rounded.md}"
  meter-track:
    backgroundColor: "{colors.mist}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
  card-ink-alert:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.son-light}"
    typography: "{typography.body-sm}"
  seal:
    backgroundColor: "{colors.son}"
    textColor: "{colors.on-son}"
    rounded: "{rounded.sm}"
    size: "{spacing.lg}"
  page-spread:
    backgroundColor: "{colors.washi}"
    textColor: "{colors.primary}"
    typography: "{typography.reading}"
    rounded: "{rounded.sm}"
    padding: "{spacing.2xl}"
  page-spread-caption:
    backgroundColor: "{colors.washi}"
    textColor: "{colors.ink-dilute}"
    typography: "{typography.caption}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-current}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
  input-border:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-dilute}"
    rounded: "{rounded.md}"
  divider:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-dilute}"
  focus-ring:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ring}"
    rounded: "{rounded.sm}"
  focus-ring-on-ink:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ring-on-ink}"
    rounded: "{rounded.sm}"
  error-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.son}"
    typography: "{typography.body-sm}"
  error-banner:
    backgroundColor: "{colors.son}"
    textColor: "{colors.on-son}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  quiz-wrong:
    backgroundColor: "{colors.washi}"
    textColor: "{colors.son-deep}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
---

# Cửa Sổ Lịch Sử — Design System

> **Trạng thái: hệ token của thế giới thị giác MỚI (chậu mực suminagashi), viết 2026-09-09.**
> Phần văn xuôi dưới đây là hợp đồng dựng, không phải bản mô tả cái đã dựng — nó sẽ được
> viết lại từ sản phẩm ĐÃ DỰNG ở cuối chặng. Lý do phải có token trước: `tailwind.config.ts`
> của dự án đọc `tailwind.theme.json`, mà file đó sinh ra từ chính front matter ở trên, nên
> không có token thì không viết được một dòng Tailwind nào. Thế giới cũ (thư viện gỗ, giấy
> da, Playfair + Lora) đã bị thay hoàn toàn; nó còn trong git history.

## Overview

Sản phẩm là một **chậu mực suminagashi**: mặt nước trắng giấy, mực chàm thả xuống và chảy
theo thủy động lực thật. Kiến thức lịch sử là thứ **loang ra** — chưa học tới thì mặt nước
còn trong, đang học thì mực đang chảy, học xong thì vân mực đã lắng và được đóng một triện son.

Luật nền tảng của thế giới này, và là thứ giữ cho nó không phá sản phẩm:

> **Chữ không bao giờ nổi trên mặt nước.** Mặt nước có bờ. Chữ đứng ở lề tĩnh **ngoài** chậu.

Đây là công cụ đọc cho học sinh tự học ở nhà. Mực làm việc của mực — nói cho mắt biết cái gì
mới, cái gì đã xong, cái gì chưa chạm tới — rồi dừng lại ở bờ chậu.

## Colors

Bảng màu là **một sắc tố chính trên nền nước**, cộng một sắc tố thứ hai dùng rất tiết chế.

- **Ink Depth (#0A1A33) — Chàm sâu:** giọt mực mới nhất luôn là vùng đậm nhất. Đây là màu
  chữ chính, nền nút chính, và nền của thẻ đang được nhấn. 16.0:1 trên `paper`.
- **Ink Current (#1E2D4A) — Dòng mực:** thân dòng chảy, nền vùng đậm thứ hai, viền ô đang focus.
- **Ink Dilute (#606D80) — Mực loãng:** mực đã loang thì nhạt đi. Chữ phụ, nhãn, và **ranh
  giới mang thông tin** (viền ô nhập, viền nút phụ). 4.92:1 trên `paper` — đo, không đoán.
- **Feathered (#AEB6C2) — Xám lông vũ:** vân mực đã tan hết. **Chỉ dùng cho đường kẻ trang
  trí thuần và cho chữ trên nền chàm.** Trên `paper` nó chỉ đạt 1.93:1, nên nó KHÔNG BAO GIỜ
  được làm viền của một thành phần mang thông tin — chỗ đó dùng `ink-dilute`.
- **Mist (#DDE2E8) — Sương:** rãnh thước tiến độ, nền chìm, vùng nước chưa nhuộm.
- **Paper (#F6F7F9) — Nước trắng giấy:** nền trang. Đây là hệ SÁNG, và đó là quyết định có
  lý do: sản phẩm này là chỗ đọc văn xuôi lịch sử hàng nghìn chữ.
- **Surface (#FDFDFE):** mặt thẻ, sáng hơn nền để nổi lên mà không cần bóng.
- **Washi (#EFEDE6) — Giấy dó:** mặt trang sách trong trình đọc. Ấm hơn `paper` một bậc, vì
  tờ giấy là vật liệu khác với mặt nước.
- **Son (#B3311C) — Son triện:** sắc tố thứ hai. Mực đỏ có thật trong marbling, và triện son
  là ngôn ngữ bản địa của việc "đã hoàn thành" ở Á Đông. Dùng cho **triện hoàn thành** và
  cho **lỗi**. 5.85:1 trên `paper`. Không dùng cho trang trí.
- **Son Deep (#8E2412) / Son Light (#F0C4B6):** biến thể khi son phải là chữ trên nền sáng
  ấm (`washi`) hoặc chữ trên nền chàm.

Chiến lược màu là **Restrained**: trung tính cộng một sắc tố. Người dùng tới đây để đọc và
để hoàn thành việc, nên bề mặt không được tranh chú ý với văn bản.

## Typography

Hai họ chữ, mỗi họ vào hệ vì một lý do không face nào khác thỏa được — **không phải vì liên
tưởng chủ đề**:

- **Manrope** cho toàn bộ giao diện. Sans humanist yên tĩnh, đúng chữ mà grammar của thế giới
  này quy định: chữ giữ ở lề tĩnh, không tranh với mặt nước. Ở cỡ lớn nó chạy **weight 200** —
  tiêu đề to mà nhẹ là cách một chậu mực nói, tiêu đề to mà đậm là cách một tấm poster nói.
- **Lexend** cho văn xuôi bài học trong trình đọc. Lexend được thiết kế và đo cho **tốc độ
  đọc**, và người dùng chính của sản phẩm là học sinh phổ thông đọc hàng nghìn chữ lịch sử.
  Đó là lý do sản phẩm, không phải khẩu vị.

**Cả hai đã được đo là có đủ dấu tiếng Việt** (khối `U+1EA0-1EF9` trong CSS Google Fonts trả
về). Đây là phép đo bắt buộc trước khi nhận bất kỳ face nào: Jost, Questrial, Poppins,
Urbanist, Karla, Rubik, Figtree, Bodoni Moda, Instrument Serif và Bebas Neue đều **trượt**
phép đo này — nguyên một loạt geometric sans mà thế giới thị giác này gọi tới đầu tiên.

Cỡ nhỏ nhất trong hệ là 12px. `label-caps` giãn chữ 0.18em và **chỉ dùng cho chuỗi ngắn** —
tiếng Việt viết hoa toàn bộ kèm dấu rất khó đọc ở đoạn dài.

`measure` là 560px ≈ 68 ký tự ở `reading` 17px.

## Layout

**CHỈ MÀN HÌNH PC. Ngưỡng thấp nhất phải chạy đúng là 1024×768.** Không breakpoint mobile.

Bố cục chủ đạo là **rail dọc trái 232px + vùng làm việc**. Rail thay cho thanh header ngang
72px của thế giới cũ, và lý do là hình dạng của thiết bị: màn hình PC rộng hơn cao, nên một
dải dọc lấy đi 232px của chiều dư và trả lại toàn bộ chiều cao cho nội dung — thứ khan hiếm
thật ở 1024×768. Rail mang: nhận diện, điều hướng, và các đồng hồ chỉ số (chuỗi ngày, vật
phẩm, tiến độ) đọc theo một lượt quét dọc.

Trang **không cuộn** ở những màn có khung cố định; vùng cuộn là một cột con xác định. Mọi tổ
tiên giữa khung khóa chiều cao và vùng cuộn phải có `min-height: 0`.

## Ink — quy tắc của mặt nước

Mực là **mô phỏng chất lỏng thật** (giải Navier–Stokes trên GPU), không phải ảnh gradient
giả chất lỏng. Đó là điều kiện của thế giới này: nếu vẽ giả, mọi thứ còn lại chỉ là màu xanh.

Bốn động từ, lấy nguyên từ grammar của suminagashi: **thả** (drop), **khuấy** (stir),
**quạt** (fan), **lặng** (still).

- **Chưa mở khóa = nước chưa nhuộm.** Không phải ổ khóa, không phải xiềng: chỉ là vùng nước
  chưa có mực chạm tới.
- **Đang mời gọi = giọt mực mới nhất.** Vùng đậm nhất trên mặt nước, và là thứ **duy nhất**
  còn đang chuyển động. Đây thay cho quầng sáng cam của thế giới cũ.
- **Đã đọc xong = vân đã lắng**, nhạt về phía `ink-dilute`, cộng một **triện son**.
- Mỗi kệ là **một sắc tố**: chàm, son, và mực đen carbon. Ba dòng mực trong cùng một chậu.

Ràng buộc cứng: mặt nước **không bao giờ chạy dưới chữ đang đọc**, và
`prefers-reduced-motion: reduce` thì mô phỏng **dừng hẳn** ở một trạng thái đã lắng — không
phải chậm lại. Trạng thái cuối phải giống hệt nhau ở cả hai chế độ.

## Elevation & Depth

Hệ này **phẳng**. Không đổ bóng — chiều sâu đến từ **độ đậm của mực** và từ lớp tông màu
(`paper` → `surface` → `washi`). Một tấm thẻ có `box-shadow` là một tấm thẻ sai ở đây.

Ranh giới là **đường kẻ 1px**. Viền mang thông tin dùng `ink-dilute`; đường kẻ trang trí
dùng `mist` hoặc `feathered`.

## Motion

Ngân sách: **tối đa một thứ đang chuyển động có chủ ý trên mỗi màn**, cộng mặt nước nền.

| Loại | Thời lượng | Easing |
| --- | --- | --- |
| Micro-interaction (hover, focus) | 150–200ms | `ease-out` |
| Đổi trạng thái (thẻ, panel) | 200–300ms | `ease-out` vào, `ease-in` ra |
| Lật trang | 400–500ms | `ease-in-out` |
| Mực loang khi nhận vật phẩm | tối đa 1200ms cả chuỗi | tuần tự |

Mặt nước là ngoại lệ nền, với đúng bốn điều kiện: nằm dưới mọi nội dung, `pointer-events:
none` ngoài vùng tương tác chủ ý, không bao giờ đi dưới chữ đang đọc, và dừng hẳn khi giảm
chuyển động.

## Shapes

Bo góc gần như không có — mặt nước không có góc, và tờ giấy thì cắt thẳng:

- `sm` 2px cho ô nội dung và trang giấy.
- `md` 4px cho thẻ, nút, ô nhập.
- `lg` 8px cho khối lớn.
- `full` chỉ cho thành phần dạng viên thuốc và chấm chỉ báo.

Triện son là hình **vuông bo 2px**, không phải hình tròn: triện Á Đông là con dấu vuông.

## Do's and Don'ts

- **Do** dùng token qua Tailwind theme, đừng hardcode hex trong component.
- **Don't** đặt chữ lên vùng mặt nước đang chuyển động. Chữ ở lề tĩnh, luôn luôn.
- **Do** giữ đúng một điểm chuyển động có chủ ý mỗi màn — giọt mực mới nhất.
- **Don't** dùng `feathered` (#AEB6C2) làm viền của thứ mang thông tin: 1.93:1 trên `paper`,
  trượt ngưỡng 3:1 của WCAG 1.4.11. Dùng `ink-dilute`.
- **Don't** đổ bóng. Hệ này phẳng; chiều sâu là độ đậm của mực.
- **Do** giữ tương phản tối thiểu 4.5:1 cho chữ thường. Chạy `npm run design:lint`.
- **Don't** dùng emoji làm icon. Dùng `lucide-react`.
- **Do** để lộ vòng focus trên mọi thứ bấm được: `ring` trên nền sáng, `ring-on-ink` trên nền chàm.
- **Do** kiểm dấu tiếng Việt của mọi font mới bằng khối `unicode-range` chứa `U+1EA0-1EF9`
  trong CSS mà Google Fonts trả về, trước khi nhận nó vào hệ.
- **Do** tôn trọng `prefers-reduced-motion`. Bắt buộc, không phải phần thêm nếu còn thời gian.
