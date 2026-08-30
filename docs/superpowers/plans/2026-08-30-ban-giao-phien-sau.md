# Bàn giao — trạng thái ngày 2026-08-30

> Đọc file này khi mở phiên mới. Nó ghi **đã làm gì**, **cổng đang ở đâu**, và **việc kế tiếp
> là gì kèm thứ đang chặn nó**. Kiến thức lâu dài vẫn thuộc về `CLAUDE.md`; file này là ảnh
> chụp một thời điểm và sẽ bị xóa khi các mục "còn lại" xong hết.

Nhánh: `feature/ke-sach-doc-sach`. Mốc đầu phiên: `ddb7e0e`. Tổng: **10 commit**,
73 file, +2938 / −329 dòng.

---

## Phần 1 — Sửa 32 lỗi đã được xác nhận (6 commit)

Phiên trước để lại một đợt review đối kháng **báo cáo ngược sự thật**: 101/120 agent phản
biện chết vì hết hạn mức và trả `null`, mà script gộp `null` vào nhánh "đã bác bỏ". Kết quả
tổng kết ghi *"7 sống sót, 33 bị bác"* trong khi **32 phát hiện chưa từng được ai xem**.

Đã phán xử lại 27 claim (sau khi khử 6 bản trùng, thêm 1 claim mới rút từ bản bác bỏ có
bằng chứng): **25 là lỗi thật, 2 bị bác**. Mỗi cái phải tái hiện bằng lệnh chạy thật rồi bị
một góc đối kháng chạy lại.

| Commit | Nội dung |
|---|---|
| `6ea58cf` | **Bảo mật.** Giới hạn 5 lần thử OTP hoàn toàn vô hiệu (chiếm tài khoản từ xa) · `readToken` ném lỗi thay vì trả null → 500 toàn site · `safeNext` lọt open redirect qua `\` · `/api/me/progress` là máy dò slug sách nháp · `chronoshelf_auth` INSERT được cột `completed` |
| `3df69b5` | **Quản trị.** 10 phép `affected === 0` là mã chết · `guard()` phân loại 23503 sai · `updatePage`/`deletePage` không ràng buộc trang thuộc đúng quyển · `RESERVED_SLUGS` thiếu · ba hàm `move*` trả `EMPTY` nên không ai được báo kết quả |
| `d642f5b` | **Trợ năng.** Ô nhập quản trị tương phản **1.00:1 → 9.20:1** · `aria-live` bị `display:none` · nút ▲/▼ làm rơi tiêu điểm · nút "Chọn ảnh" không có vòng focus · ảnh kẹt lại sau khi submit · trùng `id` · `unlockSentence` tính sai · `ShelfPageClient` và `AuthMenu` coi lỗi mạng là "đã đăng xuất" |
| `7d1c983` | **Ghi công ảnh.** Nguồn + tác giả bị cưỡng chế ở DB nhưng chưa bao giờ hiện cho học sinh — điều kiện BY của CC BY-SA không được thỏa |
| `8c00607` | **Cổng.** `seed:content` VỠ trên database trắng (máy vừa clone không bootstrap được) · `db:mutation` để hở vĩnh viễn nếu đứt giữa chừng · 4 khẳng định trong `90-verify.sql` không biết kêu · `design:lint` **không** chặn lỗi tương phản (rule `contrast-ratio` là severity `warning`, CLI thoát 0) |
| `10311c2` | **Tài liệu.** Ba chỗ hứa quá phạm vi, + 7 bẫy mới ghi vào `CLAUDE.md` |

**Hai claim bị bác:** tooltip nút khóa (C19), và bố cục dưới ~804px (C22 — ngoài phạm vi vì
sản phẩm chỉ nhắm màn hình PC).

**Một quyết định cố ý KHÔNG sửa logic:** `_complete_book_for` không ép thứ tự đọc — nhảy
thẳng tới quyển cuối kệ với túi rỗng vẫn được trao thưởng. Bản vá hiển nhiên ("đòi vật phẩm
quyển liền trước") vừa không chặn được (duyệt kệ theo thứ tự là qua), vừa làm **đứt chuỗi**
khi admin chèn sách vào giữa. Đã sửa câu hứa trong `CLAUDE.md` cho đúng phạm vi thay vì sửa
SQL. Chi tiết ở đó.

---

## Phần 2 — Xây tính năng mới (4 commit)

| Commit | Nội dung | Nghiệm thu |
|---|---|---|
| `012a691` | **Trang chủ dòng thời gian** (`content.md` §5.1). 4 khối "Ngày ấy – Bây giờ" kéo vạch so sánh, hiện dần khi cuộn, cuối trang là lối vào kệ kèm tiến độ | 27 khối chữ 0 trượt AA · bàn phím đổi được vạch · 1024×768 không tràn |
| `056f08a` | **Túi hành trang** (§4.5). Chỉ số trên header + trang tủ kính, ô chưa có hiện bóng mờ | 5 ô, 1 đã sưu tầm; Enter mở ra mô tả + link về quyển sách |
| `54e48a3` | **Chuỗi giữ lửa** (§6). Bảng `user_activity`, RPC `record_activity()` SECURITY DEFINER | chuỗi 0 → đọc một trang thật → 1; **slug bịa trả 404 và không nhóm được lửa** |
| `c847df1` | **Upload ảnh bìa kệ + bìa sách**. Gỡ nút thắt của chặng C | tải ảnh thật qua `/quan-tri` → vào bảng `media` → hiện làm nền phòng kèm ghi công |

**Ảnh trang chủ:** 8 tấm từ Wikimedia Commons, bản 1280px, commit sẵn trong
`public/timeline/` (2.7 MB). 2 CC0 · 3 CC BY · 3 CC BY-SA, không tấm nào
NonCommercial/NoDerivatives, không tấm nào có watermark. Đã **loại toàn bộ** bích họa
"Thời Đồ Đá" của Vasnetsov dù rất hợp chủ đề vì có ảnh khỏa thân — đây là nền tảng cho học
sinh phổ thông.

---

## Cổng đang ở đâu

```
npm run check        → exit 0, 64 test (12 test mới của tinhStreak)
npm run db:check     → 47 đạt / 0 hỏng
npm run db:mutation  → 20 đạt / 0 hỏng
db/schema/90-verify  → 6 mục A–F đều đạt
```

14 file schema (mới: `11-activity.sql`, `12-shelf-cover-credit.sql`).
8 route (mới: `/tui-hanh-trang`). 8 file test.

`npm run check` nay có thêm hai cổng:
- `design:lint` đi qua `scripts/design-lint-gate.mjs` — **cảnh báo tương phản cũng thoát 1**.
- `design:verify` — chặn `DESIGN.md` trôi lệch khỏi `tailwind.theme.json`.

---

## Việc còn lại

### 1. Chọn quốc gia trên bản đồ (đang chờ MỘT quyết định)

Thay ô nhập mã ISO-3166-1 numeric trong `ShelfAdmin` bằng bản đồ thế giới bấm được.
Cột `shelves.country_code` đã có sẵn và form đã ghi được nó — chỉ thiếu phần bản đồ.

**Câu hỏi đã đặt cho người dùng, CHƯA có trả lời:** dùng bản SVG đầy đủ của Wikimedia
(public domain, ~1–3 MB, đường bờ biển chi tiết) hay bản rút gọn (~200 KB)? Hỏi lại trước
khi làm — nó quyết định luôn việc file có commit vào repo hay không.

Ràng buộc: SVG phải có mã ISO trên từng `path` thì mới nối được với `country_code`. Ô nhập
hiện tại **vẫn dùng được**, nên đây là nâng cấp chứ không phải sửa lỗi.

### 2. Bài giảng & Slide (`content.md` §7)

Mục thứ 5 trong sitemap, **chưa có route nào**. Đây là subsystem lớn nhất còn lại và cần đi
đủ vòng spec → schema → code:

- Phân loại theo Lịch sử lớp 10 / 11 / 12.
- File `.pptx` xem trước được trên web và tải về.
- Sơ đồ tư duy.
- Liên kết chéo: đọc xong một quyển thì gợi ý slide + mindmap của chương đó.

**Chưa quyết:** file `.pptx` lưu ở đâu. Bảng `media` hiện chỉ nhận 4 kiểu ảnh raster
(`media_mime_check`) và trần 2 MiB — một bộ slide sẽ vượt cả hai. Đừng nới allowlist đó một
cách tùy tiện: nó là hàng rào chống stored XSS qua SVG, và `90-verify.sql` so khớp **chính
xác** định nghĩa ràng buộc. Hướng sạch hơn là một bảng riêng cho tài liệu.

### 3. Bảng tin cộng đồng (`content.md` §6)

Phần thứ hai của §6, chưa động tới. Streak đã xong nhưng nhiệm vụ giữ chuỗi hiện chỉ tính
"đọc xong ít nhất một trang" — vế "đăng một bài viết ngắn lên bảng tin" chưa có chỗ nào.
Kèm theo là danh hiệu ở mốc 7 / 30 ngày.

### 4. Kệ thứ ba: "Lịch sử quanh cuộc sống"

Sitemap có 3 kệ, database mới có 2 (`lich-su-viet-nam` 6 quyển kể cả mồi nhử,
`lich-su-the-gioi` 1 quyển). Đây là việc **soạn nội dung** qua `/quan-tri`, không phải việc
code — admin tự làm được, không cần build lại.

### 5. Những thứ đã cân nhắc và CỐ Ý bỏ

Đừng làm lại nếu không có yêu cầu mới:

| Việc | Vì sao bỏ |
|---|---|
| Kéo-thả đổi thứ tự | ▲/▼ nay đã giữ tiêu điểm và đọc kết quả cho trình đọc màn hình. Kéo-thả cần thêm `@dnd-kit` và hỏng trên bàn phím trừ khi làm thêm phần điều khiển bằng phím. Người dùng đã chọn bỏ. |
| Focus trap cho modal quản trị | Chặng C không có modal — tất cả là form trên trang. |
| Gửi email thật cho mã OTP | Cần nhà cung cấp mail + khóa API từ người dùng. `lib/auth/otp.ts` in mã ra console ở dev và **NỔ** ở production — đó là chủ ý, không phải lỗi bỏ quên. |
| Ép thứ tự đọc trong `complete_book` | Xem Phần 1, đoạn cuối. |

---

## Ba điều phiên sau nên biết trước khi gõ phím

1. **`npm run check` là cổng duy nhất cho code**, và nó chạy tự động ở pre-commit. Sau mỗi
   lần đụng `db/schema/` thì thêm `db:check` **và** `db:mutation` — cần `PGADMIN_URL`.

2. **Việc UI không được dừng ở "cổng xanh".** Phiên này tìm ra hai lỗi mà cả `check` lẫn
   `db:check` đều mù: vòng focus của thanh trượt không bao giờ hiện (`~` chỉ khớp phần tử
   đứng sau, mà `<input>` nằm cuối DOM), và trước đó là `${s.fitViewport}` bị nội suy thành
   chuỗi `"undefined"`. Cả hai chỉ lộ ra khi mở trình duyệt đo bằng `getComputedStyle`.

3. **Sản phẩm CHỈ nhắm màn hình PC.** Ngưỡng thấp nhất phải chạy đúng là **1024×768** (máy
   phòng tin học). Báo cáo lỗi bố cục dưới ~1000px thì bỏ qua — đó là dải tablet/điện thoại
   nằm ngoài phạm vi.
