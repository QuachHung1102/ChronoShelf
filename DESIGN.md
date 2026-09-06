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
  surface-room: "#160B05"
  surface-locked: "#5A3B22"
  secondary-light: "#E3C39B"
  on-primary: "#F6ECDA"
  ring: "#A83A10"
  ring-on-dark: "#F6ECDA"
  destructive: "#B3261E"
  on-destructive: "#FFFFFF"
typography:
  headline-xl:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
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
    lineHeight: 1.4
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
    lineHeight: 1.3
    letterSpacing: 0.12em
  caption:
    fontFamily: Lora
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  body-book:
    fontFamily: Lora
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.75
  drop-cap:
    fontFamily: Playfair Display
    fontSize: 44px
    fontWeight: 700
    lineHeight: 0.82
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  measure: 456px
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
  room:
    backgroundColor: "{colors.surface-room}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-md}"
  room-caption:
    backgroundColor: "{colors.surface-room}"
    textColor: "{colors.secondary-light}"
    typography: "{typography.caption}"
  room-eyebrow:
    backgroundColor: "{colors.surface-room}"
    textColor: "{colors.tertiary-light}"
    typography: "{typography.label-caps}"
  shelf:
    backgroundColor: "{colors.primary-dark}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  shelf-plank:
    backgroundColor: "{colors.surface-shelf}"
    height: "{spacing.md}"
  book-tooltip:
    backgroundColor: "{colors.primary-dark}"
    textColor: "{colors.secondary-light}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm}"
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
  stamp-completed:
    backgroundColor: "{colors.tertiary-deep}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    size: "{spacing.lg}"
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
  input-border:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.surface-locked}"
    rounded: "{rounded.md}"
  focus-ring:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.ring}"
    rounded: "{rounded.sm}"
  focus-ring-on-dark:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ring-on-dark}"
    rounded: "{rounded.sm}"
  error-toast:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-destructive}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  quiz-wrong:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.destructive}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
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
- **Secondary (#7A6248) — Nâu nhạt:** chữ phụ, caption, metadata **trên nền sáng**. Đã được
  làm đậm hơn màu nâu nhạt ban đầu (`#8A7259`) để đạt 4.5:1 trên nền `neutral` — chữ caption
  cỡ nhỏ nên không được phép mờ hơn mức này.
- **Secondary Light (#E3C39B) — Nâu kem:** cùng vai trò `secondary` nhưng **trên nền tối**.
  `secondary` trên `surface-room` chỉ đạt 2.9:1, không đọc được. Đây là cặp bắt buộc: chữ phụ
  đặt trên gỗ tối phải dùng token này, đừng hạ opacity của `on-primary` để giả nó — opacity
  không khai báo được trong `components` nên `design:lint` không kiểm tra được.
  **Đã làm sáng từ #C4A886 lên #E3C39B ngày 2026-09-04.** Giá trị cũ chỉ đạt 3.46:1 trên
  `primary` (thẻ chuỗi giữ lửa ở Cộng đồng) và 4.46:1 trên `surface-locked` (niên đại trên
  bìa sách đang khóa) — cả hai trượt ngưỡng 4.5:1, mà `design:lint` không bắt được vì không
  cặp nào trong hai cặp đó được khai báo ở `components`. Giá trị mới đạt tối thiểu 4.68:1
  trên MỌI nền tối hệ đang dùng: `primary` 4.68, `surface-locked` 6.02, `primary-dark` 8.66,
  `surface-shelf` 10.30, `surface-reader` 10.76, `surface-room` 11.57.
- **Tertiary (#E8622C) — Cam lửa:** *chỉ dùng cho đồ họa*, không dùng làm nền có chữ. Viền
  phát sáng của quyển đã mở khóa, ngọn lửa Streak, luồng sáng khi vật phẩm rơi ra, icon.
- **Tertiary Deep (#A83A10) — Cam đất:** biến thể đậm dùng khi accent phải làm **nền cho
  chữ** — ruy băng tiến độ, nút chính. Cam lửa nguyên bản chỉ đạt 2.9:1 với chữ kem nên
  không dùng được ở vai trò này.
- **Tertiary Light (#FFC0A0) — Cam nhạt:** dùng khi accent phải là **chữ trên nền nâu** —
  ví dụ mục điều hướng đang chọn. Cam lửa trên nâu chỉ đạt 2.3:1, không đọc được.
- **Neutral (#EFE3CB):** nền trang mặc định, giấy cũ ngả vàng.
- **Surface (#FBF4E4):** mặt trang sách khi đang đọc, sáng hơn nền trang để tờ giấy nổi lên.
- **Surface Shelf (#2A160C) / Surface Reader (#241209):** hai tông gỗ tối, dùng cho tấm ván
  kệ và nền tối phía sau quyển sách đang mở.
- **Surface Room (#160B05) — Đáy phòng:** tông tối nhất trong hệ, dùng cho **nền căn phòng
  thư viện** phía sau tủ sách: hậu cảnh, bốn góc vignette, chân trời của luồng sáng. Nó tối
  hơn `surface-shelf` để tủ gỗ vẫn tách được khỏi phòng — nếu hai màu bằng nhau thì cả màn
  hình dẹp lại thành một mảng đen.
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

`headline-xl` 48px là bậc **đỉnh** của thang, và nó tồn tại vì một chỗ duy nhất: bìa sách ở
màn hình đọc. Bìa chiếm gần trọn khung nhìn nhưng tên sách trước đây chỉ 24px (`headline-md`)
— bằng đúng một tiêu đề mục trong thanh bên, nên vật thể lớn nhất trên màn hình lại mang chữ
cỡ trung. Chỉ dùng cho tên sách trên bìa và cho tên vật phẩm ở khoảnh khắc nhận thưởng; đây là
hai chỗ mà chữ PHẢI cân được với một vật thể chiếm cả màn hình.

Hai giãn dòng đã được nới ngày 2026-09-04, cả hai vì cùng một lý do — **dấu chồng tiếng Việt**:

- `label-caps` từ 1.0 lên 1.3. Giãn dòng 1.0 nghĩa là hộp dòng cao đúng bằng cỡ chữ 12px,
  trong khi mực chữ viết hoa có dấu (`Ộ`, `Ế`, `Ữ`) cao tới ~14px — chữ tràn khỏi hộp dòng
  và ăn vào khoảng cách với tiêu đề ngay dưới, có chỗ chỉ còn hở 3px.
- `title-book` từ 1.3 lên 1.4. Tên sách hai dòng trên bìa chỉ còn hở 3px giữa hai dòng, nên
  dấu của dòng dưới gần chạm chân chữ dòng trên.

Cỡ chữ nhỏ nhất trong hệ là 12px (`caption`, `label-caps`). Không đặt chữ nhỏ hơn mức này —
người dùng chính là học sinh và phần lớn nội dung là văn xuôi lịch sử.

`label-caps` là nhãn viết hoa có giãn chữ, dùng cho tiêu đề phụ kiểu "KỆ SÁCH". Chỉ dùng cho
chuỗi ngắn — tiếng Việt viết hoa toàn bộ kèm dấu rất khó đọc ở đoạn dài.

`drop-cap` 44px là chữ cái đầu đoạn được thả xuống hai dòng ở trang sách. Nó không thuộc thang
chữ đọc — nó là **đồ họa chữ**, và tồn tại vì trang sách phải đọc ra là sách in chứ không phải
một thẻ giao diện. Chỉ dùng cho ký tự đầu tiên của đoạn mở đầu, qua `::first-letter`, và không
bao giờ dùng cho một cụm từ.

## Layout

**CHỈ MÀN HÌNH PC. Ngưỡng thấp nhất phải chạy đúng là 1024×768.** Không có breakpoint mobile,
không có bản vuốt trang trên điện thoại — đã cân nhắc và loại. Đây là ràng buộc THIẾT KẾ, nên
nó ở đây chứ không nằm trong một file bàn giao rồi bị xóa theo: DESIGN.md là file duy nhất
được `design:verify` canh trong `npm run check`. Báo cáo lỗi bố cục dưới ~1000px thì bỏ qua.

Bố cục desktop dùng lưới cố định, nội dung căn giữa, lề trang 48px (`page-margin`). Header cao
72px và luôn dính trên cùng.

Thang khoảng cách theo bội số 8px (`xs` 4 / `sm` 8 / `md` 16 / `lg` 24 / `xl` 32 / `2xl` 48 /
`3xl` 64), cộng thêm ba giá trị theo ngữ cảnh: `shelf-gap` 28px là khoảng cách giữa các quyển
sách trên kệ, `page-margin` 48px là lề ngoài của trang, và `measure` 456px là bề rộng tối đa
của một cột văn xuôi.

`2xl` và `3xl` thêm ngày 2026-09-04 vì thang cũ **dừng ở 32px**, nên mọi cấp phân cấp dọc trên
trang chủ — giữa hero và chương, giữa chương và chương, giữa tiêu đề và khối con — đều phải
dùng chung đúng một giá trị `xl`. Ba cấp khác nhau mà cùng một khoảng cách thì mắt không đọc
ra cấp nào chứa cấp nào. Dùng `3xl` giữa các chương lớn, `2xl` giữa các khối trong một chương,
`xl` trở xuống bên trong một khối.

`measure` 456px ≈ 65 ký tự ở `body-md` 14px. Trước đó văn xuôi dùng `max-w-2xl` (672px) — con
số ấy hợp với chữ 16px, nhưng `body-md` là 14px nên dòng chạy 95–102 ký tự, vượt xa khoảng
60–75 mà mắt bắt được khi xuống dòng. Dùng `max-w-measure` cho mọi đoạn văn xuôi dài.

Kệ sách là một hàng ngang duy nhất, các bìa căn theo **đáy** để chúng đứng trên tấm ván như
sách thật; dưới hàng đó là một tầng sách trang trí để tủ đọc ra là đồ nội thất chứ không phải
một hàng nút bấm. Màn hình đọc sách là một trang đôi 980×580 căn giữa, chiếm trọn tiêu điểm, mọi thứ
khác lùi về nền tối.

### Căn phòng thư viện

Màn hình kệ sách và màn hình đọc sách đều diễn ra **trong cùng một căn phòng**, dựng bằng bốn
lớp xếp từ xa tới gần:

| Lớp | Nội dung |
|---|---|
| 0 — Phòng | Nền `surface-room`, vignette bốn góc, một luồng sáng ấm chếch từ trên-trái. |
| 1 — Hậu cảnh | Vài kệ sách mờ đã làm nhòe, tối, độ tương phản thấp. Không bao giờ sắc nét. |
| 2 — Bụi | Hạt bụi trong luồng sáng (xem ngoại lệ ở mục Motion). |
| 3 — Tiền cảnh | Tủ sách và quyển sách — thứ duy nhất sắc nét và bắt sáng đầy đủ. |

Chỉ lớp 3 được sắc nét. Đây là thứ giữ cho căn phòng là *bối cảnh* chứ không thành *nội dung*:
mắt không có chỗ nào khác để bám ngoài tủ sách.

Chữ tiêu đề màn hình đặt thẳng lên lớp 0, nên nó dùng `on-primary` và `secondary-light`, **không**
dùng `primary-dark`/`secondary` như trên nền `neutral`.

## Elevation & Depth

Hệ này có **hai tầng, luật khác nhau**. Nhầm luật của tầng này sang tầng kia là lỗi thiết kế
hay gặp nhất ở đây.

### Tầng nội dung — phẳng

Chữ, nút, thẻ, ô nội dung trong trang sách, biểu mẫu. Chiều sâu ở đây đến từ **lớp tông màu**,
không phải đổ bóng: nền trang `neutral`, trang sách `surface`. **Không đổ bóng lên chữ, icon,
hay nút.** Một cái nút có `box-shadow` là một cái nút sai.

### Tầng đồ nội thất — có khối thật

Căn phòng, tủ sách, tấm ván, bìa sách, quyển sách đang mở. Đây là **vật thể trong không gian**,
và vật thể thì có bóng, có bề dày, có mặt bắt sáng. Cố vẽ chúng phẳng thì được đúng cái kết quả
đã phải bỏ đi một lần: năm hình chữ nhật nâu lơ lửng trong một hộp nâu.

Bốn công cụ, dùng đúng chỗ:

- **Bóng tiếp đất.** Mỗi vật đứng trên ván phải có bóng đổ xuống ngay dưới chân nó. Đây là thứ
  duy nhất nói cho mắt biết quyển sách *đứng trên* tấm ván chứ không *lơ lửng trước* nó.
- **Bề dày.** Bìa sách có cạnh gáy và mép giấy; tấm ván có mặt trên nhìn thấy được. Vật thể
  không có bề dày thì vẫn là cái thẻ, dù có bóng.
- **Ánh sáng một hướng.** Cả màn hình có **một** nguồn sáng ấm, chếch từ trên xuống. Mặt trên
  bắt sáng, mặt dưới tối. Hai nguồn sáng ngược nhau làm cảnh dẹp lại ngay.
- **Vignette.** Bốn góc phòng tối dần để mắt dồn vào giữa. Vignette là *nền*, không bao giờ
  phủ lên chữ.

Không dùng bóng để "làm nổi" một thứ vốn không phải vật thể. Nếu đang định đổ bóng cho một cái
thẻ thông tin, câu trả lời là đổi tông màu chứ không phải thêm bóng.

### Quầng sáng mời gọi

**Quyển đã mở khóa chưa đọc** có quầng sáng cam (`tertiary`) tỏa ra từ bìa. Đây không phải bóng
đổ và không thuộc hai tầng trên — nó là *chỉ dẫn hành động*, và là thứ duy nhất phát sáng trên
màn hình kệ sách. Một màn hình có hai quầng sáng là một màn hình không có chỉ dẫn nào.

## Motion

Chuyển động ở đây phải **mang nghĩa**, không trang trí. Mỗi hoạt cảnh trả lời một câu hỏi của
người học: quyển này mở được chưa, tôi đang ở trang mấy, tôi vừa nhận được gì.

**Ngân sách chuyển động: tối đa 1–2 thành phần động cùng lúc trên mỗi màn hình.** Kệ sách chỉ
có đúng một thứ nhấp nháy — quyển tiếp theo cần đọc. Hoạt cảnh nhận vật phẩm ở trang cuối là
một chuỗi **tuần tự**, không phải năm thứ động cùng lúc: vật phẩm rơi và xoay → bay vào túi
hành trang → (sang màn kệ sách) ổ khóa bật mở. Đừng chạy chồng chúng lên nhau.

### Ngoại lệ: chuyển động nền

Hạt bụi bay trong luồng sáng của căn phòng **không tính vào ngân sách trên**, với điều kiện nó
đạt đủ cả bốn ràng buộc — thiếu một cái là nó thành thành phần động thứ hai và phải bỏ:

1. Nằm dưới mọi nội dung, `pointer-events: none`, `aria-hidden`.
2. Opacity tối đa 0.18 và không bao giờ đi qua vùng có chữ đang đọc.
3. Chu kỳ ≥ 12 giây — chậm tới mức mắt không bắt được nó là "một hoạt cảnh".
4. `prefers-reduced-motion: reduce` thì **dừng hẳn**, không phải làm chậm lại.

Lý do có ngoại lệ này: nó là *không khí của căn phòng*, không phải phản hồi cho hành động nào
của người học. Ngân sách 1–2 thành phần tồn tại để người học biết nhìn vào đâu; một thứ chậm và
mờ tới mức không cướp được sự chú ý thì không phá vỡ mục đích đó. Bất cứ chuyển động nền nào
nhanh hơn hoặc rõ hơn ngưỡng trên đều phá — và đó là lý do bốn con số kia là ngưỡng cứng.

| Loại | Thời lượng | Easing |
| --- | --- | --- |
| Micro-interaction (hover, focus, đổi trạng thái nút) | 150–200ms | `ease-out` |
| Chuyển trạng thái (bìa sách nhô lên, tooltip) | 200–300ms | `ease-out` khi vào, `ease-in` khi ra |
| Lật trang, mở bìa sách 3D | 400–500ms | `ease-in-out` |
| Hoạt cảnh nhận vật phẩm | tối đa 1200ms cả chuỗi | tuần tự, mỗi chặng ≤ 400ms |

Không dùng `linear` cho chuyển động giao diện. Không có hoạt cảnh nào của giao diện vượt 500ms
trừ hai ngoại lệ đã nêu ở bảng trên, và cả hai đều phải bỏ qua được.

### `prefers-reduced-motion` là bắt buộc

Đây không phải phần tùy chọn. Người dùng bật giảm chuyển động thì:

- Quầng sáng nhấp nháy trên bìa sách **dừng hẳn** — thay bằng viền `tertiary` tĩnh.
- Lật trang và mở bìa 3D thành chuyển cảnh mờ dần (fade) ≤ 150ms.
- Hoạt cảnh vật phẩm rơi bị bỏ qua; hiện thẳng kết quả "Bạn nhận được: …".

Trạng thái cuối phải giống hệt nhau ở cả hai chế độ. Người tắt chuyển động không được mất
thông tin nào — nếu tắt hoạt cảnh làm mất một thông báo, thiết kế đó sai.

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
- **`book-cover-completed`**: nền `primary`, dấu triện tròn (`stamp-completed`) ở góc trên. Vẫn
  bấm được để đọc lại, nhưng không còn phát sáng — nó đã hết vai trò mời gọi.

`stamp-completed` dùng nền `tertiary-deep` chứ không phải `tertiary`. Dấu triện là thứ **duy
nhất** phân biệt "đã đọc xong" với "chưa đọc", nên nó là thành phần giao diện mang thông tin và
phải đạt 3:1 theo WCAG 1.4.11. Icon kem trên `tertiary` chỉ đạt 2.89:1; trên `tertiary-deep` là
5.47:1.

`progress-ribbon` và `button-primary` cùng dùng nền `tertiary-deep` với chữ kem. Đây là hai
thành phần accent duy nhất mang chữ; mọi chỗ accent khác đều là đồ họa thuần.

`eyebrow` dùng `tertiary-deep` chứ không phải `tertiary`, vì nó là chữ nhỏ đặt trên nền
`neutral` sáng.

`input-border` khai báo **viền của ô nhập**, không phải chữ. Preflight của Tailwind zero hóa
`border-width` trên mọi phần tử, nên ô nhập không còn viền mặc định của trình duyệt; mà form
lại nằm trên thẻ `bg-surface`, tức ô nhập cùng màu nền của thẻ chứa nó — 1.00:1, người dùng
không thấy ô ở đâu cho tới khi bấm trúng. Viền là `surface-locked` (9.20:1 trên `surface`,
7.93:1 trên `neutral`), cùng màu với đường kẻ chia phần đã dùng trong khu quản trị. Hai lựa
chọn khác đã tính: `secondary` đạt 5.22:1 cũng qua, `secondary-light` chỉ 1.53:1 nên **không
dùng được** — nó trượt ngưỡng 3:1 của WCAG 1.4.11. (Con số đó là của #E3C39B; bản #C4A886
dùng tới 2026-09-04 đạt 2.06:1 — vẫn trượt, nên kết luận không đổi.)

Khai báo này dùng đúng thủ thuật của `focus-ring`: `components` trong `design.md` chỉ có
`backgroundColor` và `textColor` — không có `borderColor` — nên một cặp màu-ranh-giới phải
mượn khe `textColor` thì `design:lint` mới tính tương phản cho nó. Ngưỡng lint là 4.5:1, chặt
hơn mức 3:1 mà ranh giới cần, nên qua được lint là dư an toàn.

`quiz-wrong` là `destructive` trên `surface` (5.96:1) — cặp màu dùng cho câu trả lời sai ở bài
kiểm tra cuối sách: viền của ô câu hỏi và dòng "Chưa đúng…" bên dưới nó. Khai ở đây vì đó là
**cặp duy nhất trong sản phẩm báo LỖI cho học sinh**, tức chỗ ít được phép trượt tương phản
nhất, và vì `design:lint` chỉ nhìn thấy những cặp được khai trong file này — nó không đọc
component. Màu KHÔNG phải tín hiệu duy nhất ở đó (còn icon và câu chữ, WCAG 1.4.1); cặp này
tồn tại để giữ cho phần màu của tín hiệu không âm thầm tụt xuống dưới ngưỡng.

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
- **Don't** quên rằng icon và thành phần giao diện **mang thông tin** cũng có ngưỡng riêng —
  3:1 theo WCAG 1.4.11. `design:lint` chỉ kiểm tra được các cặp đã khai báo trong `components`,
  nên khi thêm một icon-trên-nền-màu mới thì phải khai báo nó ở đó, đừng để ngoài hệ.
- **Don't** đổ bóng lên chữ, icon, nút, hay thẻ nội dung — tầng nội dung dựa vào lớp tông màu.
  Bóng, bề dày và mặt bắt sáng chỉ dành cho tầng đồ nội thất (xem mục Elevation & Depth).
- **Do** cho mọi vật đứng trên tấm ván một bóng tiếp đất. Bìa sách không có bóng dưới chân thì
  nó lơ lửng, và cả cái kệ lập tức trông như một hàng thẻ bấm được.
- **Don't** dùng `secondary` hay `primary-dark` làm màu chữ trên nền tối của căn phòng. Cặp
  đúng là `on-primary` cho chữ chính và `secondary-light` cho chữ phụ.
- **Do** chọn font thay thế có đủ dấu tiếng Việt nếu phải đổi; Playfair Display và Lora đều
  đạt yêu cầu này. Kiểm tra bằng khối `unicode-range` chứa `U+1EA0-1EF9` trong CSS mà Google
  Fonts trả về — ví dụ Kalam **không** có khối này nên không dùng được cho dự án.
- **Don't** dùng emoji làm icon (`🔥`, `🎒`, `✓`, `✕`). Dùng `lucide-react`, cùng bộ với tên
  icon đã dùng trong mockup Pencil (`flame`, `backpack`, `lock`, `lock-open`, `check`, `x`,
  `chevron-left`, `chevron-right`, `volume-2`, `stamp`). Emoji render khác nhau theo từng hệ
  điều hành và không nhận được `aria-label` hay màu theo token.
- **Do** để lộ vòng focus bàn phím trên mọi thứ bấm được: `ring` trên nền sáng, `ring-on-dark`
  trên nền nâu/tối. Không bao giờ `outline: none` mà không thay bằng thứ khác — bìa sách và
  mũi tên lật trang đều phải dùng được bằng bàn phím.
- **Do** tôn trọng `prefers-reduced-motion` (xem mục Motion). Đây là ràng buộc bắt buộc, không
  phải phần thêm nếu còn thời gian.
