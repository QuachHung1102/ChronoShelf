---
version: alpha
name: Cửa Sổ Lịch Sử
description: Thư viện cổ bằng gỗ và giấy da — hệ thiết kế cho nền tảng học lịch sử ChronoShelf.
colors:
  primary: "#6E4A2E"
  primary-dark: "#3B2415"
  secondary: "#7A6248"
  tertiary: "#E8622C"
  tertiary-deep: "#A83A10"
  tertiary-light: "#FFC0A0"
  neutral: "#EFE3CB"
  surface: "#FBF4E4"
  surface-shelf: "#2A160C"
  surface-reader: "#241209"
  surface-locked: "#5A3B22"
  on-primary: "#F6ECDA"
typography:
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.15
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
  title-book:
    fontFamily: Playfair Display
    fontSize: 15px
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: Lora
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Lora
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: Lora
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.2
  label-caps:
    fontFamily: Lora
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.12em
  caption:
    fontFamily: Lora
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  page-margin: 48px
  shelf-gap: 28px
  header-height: 72px
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 12px
  full: 9999px
components:
  page:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary-dark}"
    typography: "{typography.body-md}"
    padding: "{spacing.page-margin}"
  header:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    height: "{spacing.header-height}"
  nav-item-active:
    textColor: "{colors.tertiary-light}"
    typography: "{typography.label-md}"
  shelf:
    backgroundColor: "{colors.primary-dark}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  shelf-plank:
    backgroundColor: "{colors.surface-shelf}"
    height: "{spacing.md}"
  book-cover-unlocked:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-book}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  book-cover-completed:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-book}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  book-cover-locked:
    backgroundColor: "{colors.surface-locked}"
    textColor: "{colors.on-primary}"
    typography: "{typography.title-book}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  page-spread:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: "{spacing.xl}"
  reader-backdrop:
    backgroundColor: "{colors.surface-reader}"
    textColor: "{colors.on-primary}"
  progress-ribbon:
    backgroundColor: "{colors.tertiary-deep}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  button-primary:
    backgroundColor: "{colors.tertiary-deep}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
  caption-text:
    textColor: "{colors.secondary}"
    typography: "{typography.caption}"
  eyebrow:
    textColor: "{colors.tertiary-deep}"
    typography: "{typography.label-caps}"
---

# Cửa Sổ Lịch Sử — Design System

## Overview

Sản phẩm phải cho cảm giác bước vào một **thư viện cổ**: gỗ sẫm, giấy da ngả vàng, ánh nến
ấm. Cổ kính và hoài niệm, nhưng chuyển động phải mượt và hiện đại — đây là công cụ học tập
cho học sinh, không phải một món đồ bảo tàng tĩnh.

Người dùng là học sinh phổ thông Việt Nam. Giao diện phải dễ đọc, ít chữ nhỏ, và mỗi màn hình
chỉ có **một** hành động chính rõ ràng: mở quyển sách tiếp theo, lật sang trang sau, nhận vật
phẩm. Cảm xúc cần đánh trúng là *tò mò và muốn sưu tầm tiếp*, không phải *bị nhồi kiến thức*.

Mật độ thông tin ở mức thoáng. Khoảng trắng ấm (`neutral`) là nền mặc định, và mọi thứ nằm
trong khung gỗ tối chỉ khi nó thật sự là "đồ nội thất" của thư viện: kệ sách, bìa sách, màn
hình đọc.

## Colors

Bảng màu xoay quanh ba vai trò trong content.md: **nâu đất/nâu gỗ** cho cấu trúc,
**cam lửa/cam đất** cho tương tác, **trắng kem/giấy da** cho nội dung.

- **Primary (#6E4A2E) — Nâu gỗ:** màu của đồ nội thất. Header, bìa sách, khung viền. Là màu
  nền chiếm diện tích lớn nhất sau `neutral`.
- **Primary Dark (#3B2415) — Nâu sẫm:** lưng kệ sách, và là màu chữ chính trên nền giấy da.
  Một màu đóng hai vai để bảng màu không phình ra.
- **Secondary (#7A6248) — Nâu nhạt:** chữ phụ, caption, metadata. Đã được làm đậm hơn màu
  nâu nhạt ban đầu (`#8A7259`) để đạt 4.5:1 trên nền `neutral` — chữ caption cỡ nhỏ nên
  không được phép mờ hơn mức này.
- **Tertiary (#E8622C) — Cam lửa:** *chỉ dùng cho đồ họa*, không dùng làm nền có chữ. Viền
  phát sáng của quyển đã mở khóa, ngọn lửa Streak, luồng sáng khi vật phẩm rơi ra, icon.
- **Tertiary Deep (#A83A10) — Cam đất:** biến thể đậm dùng khi accent phải làm **nền cho
  chữ** — ruy băng tiến độ, nút chính. Cam lửa nguyên bản chỉ đạt 2.9:1 với chữ kem nên
  không dùng được ở vai trò này.
- **Tertiary Light (#FFC0A0) — Cam nhạt:** dùng khi accent phải là **chữ trên nền nâu** —
  ví dụ mục điều hướng đang chọn. Cam lửa trên nâu chỉ đạt 2.3:1, không đọc được.
- **Neutral (#EFE3CB):** nền trang mặc định, giấy cũ ngả vàng.
- **Surface (#FBF4E4):** mặt trang sách khi đang đọc, sáng hơn nền trang để tờ giấy nổi lên.
- **Surface Shelf (#2A160C) / Surface Reader (#241209):** hai tông gỗ tối nhất, dùng cho tấm
  ván kệ và nền tối phía sau quyển sách đang mở.
- **Surface Locked (#5A3B22):** bìa sách đang khóa — nâu xỉn, thấp hơn `primary` một bậc để
  đọc ra ngay là "chưa mở được" mà vẫn cùng họ màu.
- **On Primary (#F6ECDA) — Kem:** chữ trên mọi nền nâu.

## Typography

Hai họ chữ, phân vai rõ ràng:

- **Playfair Display** (serif, có chân) cho mọi tiêu đề và tên sách. Chân chữ và độ tương
  phản nét gợi đúng chất sách in cổ.
- **Lora** (serif đọc dài) cho toàn bộ nội dung bài học và giao diện. Được thiết kế cho việc
  đọc dài trên màn hình, và **hỗ trợ đầy đủ dấu tiếng Việt** — đây là điều kiện bắt buộc, đừng
  thay bằng font không có bộ dấu.

Cỡ chữ nhỏ nhất trong hệ là 12px (`caption`, `label-caps`). Không đặt chữ nhỏ hơn mức này —
người dùng chính là học sinh và phần lớn nội dung là văn xuôi lịch sử.

`label-caps` là nhãn viết hoa có giãn chữ, dùng cho tiêu đề phụ kiểu "KỆ SÁCH". Chỉ dùng cho
chuỗi ngắn — tiếng Việt viết hoa toàn bộ kèm dấu rất khó đọc ở đoạn dài.

## Layout

Bố cục desktop dùng lưới cố định, nội dung căn giữa, lề trang 48px (`page-margin`). Header cao
72px và luôn dính trên cùng.

Thang khoảng cách theo bội số 8px (`xs` 4 / `sm` 8 / `md` 16 / `lg` 24 / `xl` 32), cộng thêm
hai giá trị theo ngữ cảnh: `shelf-gap` 28px là khoảng cách giữa các quyển sách trên kệ, và
`page-margin` 48px là lề ngoài của trang.

Kệ sách là một hàng ngang duy nhất, các bìa căn theo **đáy** (`alignItems: end`) để chúng
đứng trên tấm ván như sách thật. Màn hình đọc sách là một trang đôi 920×560 căn giữa, chiếm
trọn tiêu điểm, mọi thứ khác lùi về nền tối.

## Elevation & Depth

Chiều sâu đến từ **lớp tông màu**, không phải đổ bóng dày. Nền trang là `neutral`, đồ nội thất
là `primary`/`primary-dark`, và trang sách là `surface` — sáng dần theo mức độ quan trọng.

Chỉ có hai chỗ được dùng đổ bóng thật:

- **Quyển sách đang mở**: bóng ngoài lớn, tối, để tờ giấy tách hẳn khỏi nền `surface-reader`.
- **Quyển đã mở khóa chưa đọc**: quầng sáng cam (`tertiary`) tỏa ra từ bìa — đây là hiệu ứng
  *mời gọi*, không phải bóng đổ, và là thứ duy nhất phát sáng trên màn hình kệ sách.

Không đổ bóng lên chữ, icon, hay nút.

## Shapes

Bo góc nhẹ và nhất quán, gợi cạnh giấy và gáy sách đã mòn chứ không phải thẻ giao diện hiện đại:

- `sm` 4px cho ảnh minh họa và ô nội dung trong trang sách.
- `md` 6px cho bìa sách.
- `lg` 12px cho khối kệ gỗ.
- `full` chỉ dành cho các thành phần dạng viên thuốc: ruy băng tiến độ, nút tròn, huy hiệu.

Tấm ván kệ (`shelf-plank`) cố tình để góc vuông — nó là một thanh gỗ, không phải một cái thẻ.

## Components

Ba trạng thái của bìa sách là thành phần quan trọng nhất trong hệ, vì chúng mang toàn bộ cơ
chế mở khóa:

- **`book-cover-locked`**: nền `surface-locked`, có ổ khóa và dây xích chắn ngang, không bấm
  được. Hover chỉ hiện gợi ý "Cần [tên vật phẩm] để mở" — không bao giờ hiện nội dung bên trong.
- **`book-cover-unlocked`**: nền `primary`, viền `tertiary` kèm quầng sáng nhấp nháy nhẹ.
  Hover thì sách nhô lên khỏi kệ. Đây là hành động chính của màn hình kệ sách.
- **`book-cover-completed`**: nền `primary`, dấu triện tròn màu `tertiary` ở góc trên. Vẫn bấm
  được để đọc lại, nhưng không còn phát sáng — nó đã hết vai trò mời gọi.

`progress-ribbon` và `button-primary` cùng dùng nền `tertiary-deep` với chữ kem. Đây là hai
thành phần accent duy nhất mang chữ; mọi chỗ accent khác đều là đồ họa thuần.

`eyebrow` dùng `tertiary-deep` chứ không phải `tertiary`, vì nó là chữ nhỏ đặt trên nền
`neutral` sáng.

## Do's and Don'ts

- **Do** dùng token qua Tailwind theme (`tailwind.config.ts` sinh từ file này), đừng hardcode
  mã hex trong component.
- **Don't** dùng `tertiary` (#E8622C) làm nền cho chữ, hoặc làm màu chữ trên nền nâu. Dùng
  `tertiary-deep` cho trường hợp đầu và `tertiary-light` cho trường hợp sau.
- **Do** giữ đúng một điểm phát sáng cam trên mỗi màn hình — quyển sách tiếp theo cần đọc.
  Sáng nhiều chỗ thì không còn chỗ nào là hướng dẫn nữa.
- **Don't** đặt chữ nhỏ hơn 12px, và đừng viết hoa toàn bộ một đoạn tiếng Việt có dấu.
- **Do** giữ tương phản tối thiểu 4.5:1 cho chữ thường. Chạy `npm run design:lint` trước khi
  commit thay đổi về màu.
- **Don't** thêm đổ bóng ngoài hai chỗ đã nêu ở mục Elevation — hệ này dựa vào lớp tông màu.
- **Do** chọn font thay thế có đủ dấu tiếng Việt nếu phải đổi; Playfair Display và Lora đều
  đạt yêu cầu này.
