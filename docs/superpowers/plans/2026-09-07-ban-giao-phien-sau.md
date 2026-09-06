# Bàn giao — trạng thái ngày 2026-09-07

> Đọc file này khi mở phiên mới. Nó ghi **đã làm gì**, **cổng đang ở đâu**, và **việc kế tiếp
> là gì kèm thứ đang chặn nó**. Kiến thức lâu dài thuộc về `CLAUDE.md`; file này là ảnh chụp
> một thời điểm và sẽ bị xóa khi các mục "còn lại" xong hết.
>
> Thay cho `2026-09-06-ban-giao-phien-sau.md`.

Nhánh: `feature/ke-sach-doc-sach`. Phiên này: **bài trắc nghiệm cuối sách** (content.md §4.3),
mảnh cơ chế lớn cuối cùng của vòng lặp lõi.

Admin hiện tại là `quachhung389@gmail.com`. Tài khoản `ui-audit@example.invalid` cũng có quyền
admin và được dùng để soi giao diện — nó là tài khoản thật trong database dev, không phải mồi
nhử của `db:check`.

---

## Đã làm

**Đọc hết trang cuối không còn là điều kiện đủ để nhận vật phẩm.** Quyển nào có câu hỏi thì
phải trả lời đúng HẾT mới được trao. Toàn bộ thiết kế và lý do từng quyết định nằm ở
`docs/superpowers/specs/2026-09-07-bai-trac-nghiem-cuoi-sach-design.md` (449 dòng) — dưới đây
chỉ là những gì phiên sau cần biết ngay.

### Đáp án không bao giờ rời khỏi database

Đây là phần đáng giá nhất của đợt này, và cũng là phần dễ phá nhất nếu không biết:

`book_questions.correct_index` **không có `GRANT SELECT`** cho `chronoshelf_anon` lẫn
`chronoshelf_auth`. Hàng rào là **GRANT theo cột**, không phải policy — RLS lọc DÒNG và không
có khái niệm cột. Hệ quả cụ thể: một `SELECT *` vô ý trong `readShelf()` sẽ **nổ** với
`permission denied for table book_questions` thay vì âm thầm in đáp án ra HTML.

Ba chốt đi kèm, đừng gỡ cái nào:

- Model Sequelize `BookQuestion` **cố ý không khai** `correctIndex`. Thêm vào là mọi truy vấn
  câu hỏi chết ngay.
- Chỉ hai cửa đọc được đáp án, cả hai `SECURITY DEFINER`: `complete_book` (chấm bài) và
  `admin_book_questions` (màn soạn thảo, tự kiểm `is_admin()` bên trong).
- `90-verify.sql` mục **B2** khẳng định cả ba chuyện đó; `db:mutation` có ba đột biến riêng
  chứng minh B2 biết kêu.

**Đã đo thật, không suy đoán**: `curl` không cookie tới `/lich-su-the-gioi` trả về đủ 15 câu hỏi
của kệ (client cần chúng để vẽ) và **0** lần xuất hiện của `correct_index` / `correctIndex` /
`"correct"` trong HTML.

### Chấm bài nằm ở máy chủ, và không có đường vòng

`complete_book(text)` đã đổi thành `complete_book(text, smallint[])`. **Phải `DROP FUNCTION`
chứ không `CREATE OR REPLACE`** — thêm tham số chỉ tạo ra một bản NẠP CHỒNG, và bản hai-tham-số
cũ sẽ ở lại như một cửa thứ hai trao vật phẩm mà không chấm bài. `90-verify.sql` nay đếm
`pronargs` để chặn đúng chuyện đó.

Chấm theo **thứ tự** (`row_number()`), không theo giá trị `position`: xóa một câu để lại lỗ
thủng trong `position` y như `pages`, mà client thì gửi về một mảng song song với danh sách câu
hỏi nó nhận được.

Trượt thì hàm **`RETURN`**, không `RAISE EXCEPTION` — exception hủy cả transaction của request,
đúng bài học bộ đếm OTP đã ghi trong `CLAUDE.md`.

### Nội dung

38 câu hỏi cho cả 13 quyển (Việt Nam 15, Thế giới 11, Quanh cuộc sống 12), viết bám sát đúng
văn bản đã seed. `db/seed/*.json` có thêm khóa `questions`, và `seed-content.mjs` biết nạp nó.

Đáp án **không dồn về một chỗ**: phân bố chỉ số đáp án là 10/10/11/7 cho bốn vị trí — "cứ chọn
ô đầu" không ăn được.

## Cổng đang ở đâu

```
npm run check        → exit 0
npm run db:check     → 102 đạt / 0 hỏng     (+17 phép mới ở mục "Bài trắc nghiệm cuối sách")
npm run db:mutation  → 45 đạt / 0 hỏng      (+5 đột biến mới)
```

Trong 17 phép mới, quan trọng nhất là phép chạy `complete_book` THẬT với đáp án sai rồi đòi
`user_items` **không nhúc nhích**, và một phép đối chứng chứng minh quyển KHÔNG có câu hỏi vẫn
trao vật phẩm như trước. Năm đột biến mới phá đúng năm đường làm lộ đáp án hoặc lộ nội dung:
cấp `SELECT` cho `correct_index`, dựng lại bản `complete_book` một-tham-số, gỡ dòng `is_admin()`
khỏi `admin_book_questions`, nới policy `read published` thành `USING (true)`, và thêm một
policy SELECT thứ hai bên cạnh policy cũ.

### Một đợt review đối kháng đã tìm ra 6 lỗi — đã sửa hết

Bản đầu của đợt này commit ở `6aad311`; `e4e180a` sửa những gì một agent review đối kháng tìm
được. Hai cái đáng ghi lại vì chúng là loại lỗi dễ lặp lại:

- **Cổng canh policy `read published` HOÀN TOÀN KHÔNG CÓ, và không có dữ liệu để mà canh.**
  Khối B2 bản đầu chỉ khẳng định GRANT theo cột và policy GHI. Tệ hơn: quyển nháp mồi nhử có
  **0 câu hỏi**, nên kể cả khi thêm một phép kiểm thì nó cũng luôn thấy 0 dòng và luôn báo đạt —
  đúng cái bẫy `CLAUDE.md` đã ghi bằng máu cho `__nhap-khong-bao-gio-xuat-ban`. Nay seed tạo
  thêm **một câu hỏi mồi nhử thuộc quyển nháp** (mồi nhử thứ ba, đừng dọn), `db:check` có bốn
  phép quanh nó kèm đối chứng chiều ngược, và `db:mutation` có hai đột biến.
- **`array_length('{}'::text[], 1)` trả NULL, mà CHECK chỉ từ chối khi biểu thức ra FALSE.**
  Nên hai ràng buộc `book_questions_choices_ck` và `book_questions_correct_range_ck` nhận một
  dòng `choices = '{}'` với `correct_index` bất kỳ — đúng thứ chúng tuyên bố là chặn. Đã đo
  thật: `('{}'::text[], 7)` ghi được. Nay bọc `coalesce(…, 0)`; hai ràng buộc chuyển sang đặt
  bằng `ALTER TABLE` vì `CREATE TABLE IF NOT EXISTS` không sửa được bảng đã tồn tại.

Bốn lỗi còn lại: "Quay lại đọc" xóa sạch bài làm (state bài kiểm tra nay sống ở
`BookReaderModal`, không ở `QuizPanel` — panel bị tháo khỏi cây khi quay lại đọc); nộp lần hai
làm đỏ lại những câu vừa sửa suốt một vòng round-trip (nay xóa `wrongPositions` ngay lúc bắt đầu
nộp); `readAnswers` chép `MAX_CHOICES` thành bản sao thứ TƯ mà ba bản kia không nhắc tới (nay
chốt theo trần `smallint`, không còn hằng số nào để trôi); và `Number("")` là `0` nên một POST
thiếu trường `correct` âm thầm chọn ô 1 làm đáp án.

**Và một lỗi tôi tự tìm ra trong lúc sửa**: `ON CONFLICT (book_slug, position)` KHÔNG dùng được
trên bảng này — ràng buộc UNIQUE là DEFERRABLE, mà Postgres từ chối dùng ràng buộc deferrable làm
trọng tài (`55000`). Đây chính là lý do vòng lặp seed xóa-rồi-chèn-lại thay vì upsert. Câu chèn
mồi nhử nay dùng `WHERE NOT EXISTS`; đã chạy `seed:content` **hai lần** để chứng minh idempotent.

### Đã đo thật trong trình duyệt ở 1024×768

Đi hết vòng trên quyển "Đế chế La Mã" bằng tài khoản `ui-audit` (console sạch, 0 lỗi):

| Bước | Kết quả đo được |
|---|---|
| Sai cả 3 câu | Túi giữ nguyên 6, `completed` vẫn false, cả 3 câu đánh dấu sai |
| Đổi 1 đáp án | Dấu sai của ĐÚNG câu đó biến mất ngay, hai câu kia còn nguyên |
| Đúng 2, sai 1 | Vẫn không trao vật phẩm; máy chủ chỉ đúng câu 3 là câu còn sai |
| Đúng cả 3 | Túi 6 → 7, nhận "Huy hiệu quân đoàn La Mã", quyển sau mở khóa |
| Mở lại quyển ĐÃ xong | Nút quay về "Đọc xong — nhận vật phẩm", không hỏi lại |

**Chín payload bịa gửi thẳng vào `/api/me/complete`** — thiếu `answers`, mảng rỗng, chỉ số 999,
chuỗi thay vì số, `null`, số thập phân, số âm, mảng 5000 phần tử, và `answers` không phải mảng —
**tất cả đều trượt, không cái nào trao vật phẩm, không cái nào làm route 500.**

Màn quản trị: ca khó nhất đã thử thật — bỏ trống ô 1 và ô 3, đánh dấu đáp án ở ô 4 → lưu ra
`choices` 2 phần tử với `correct_index = 1`, đúng như thiết kế. Đánh dấu đáp án vào một ô để
TRỐNG thì bị chặn kèm câu giải thích, không tạo dòng nào.

## Việc còn lại

### 1. Ảnh — thứ DUY NHẤT đang chặn thật (chờ người dùng)

Đo trên database dev ngày 2026-09-07:

| | Có | Tổng |
|---|---|---|
| Ảnh bìa sách | **0** | 13 |
| Ảnh minh họa trang | **0** | 50 |
| Ảnh vật phẩm | 5 | 13 |
| Bài giảng có slide thật | **0** | 2 |

Tất cả sửa qua `/quan-tri`, **không đụng một dòng mã nào**. Hai bài giảng hiện có đang mượn tạm
ảnh trong `public/timeline/` — thấy rõ ở `/bai-giang`, bài "Chiến thắng Bạch Đằng năm 938" mang
ảnh gia đình thời tiền sử.

`kim-tu-thap-ai-cap` mới có **2 trang** trong khi 12 quyển kia đều 4 — quyển đó viết dở, và vì
vậy nó cũng chỉ có 2 câu hỏi thay vì 3.

### 2. Ba mảnh của `content.md` chưa dựng

| Việc | Ở đâu trong content.md |
|---|---|
| Âm thanh lật trang + nút tắt tiếng | §4.2 |
| Sưu tầm trọn bộ → danh hiệu + nội dung thưởng | §4.5 |
| Mảnh ghép cho kệ "Lịch sử quanh cuộc sống" | §4.4 |

### 3. Siết `sniffPptx` khi có `.pptx` thật để đối chứng

Không đổi. `laGoiZip()` hiện chỉ khẳng định "là một gói ZIP"; thêm phép so `[Content_Types].xml`
ở offset 30 khi có file thật commit vào repo.

### 4. Dọn tài khoản test trong database dev

Mỗi lần `npm run db:check` chạy là commit thêm 5 tài khoản `*@example.invalid`. Phiên 09-06 đã
thử dọn và **classifier của Claude Code chặn** cả lệnh xóa lẫn lệnh đếm.

```sql
DELETE FROM public.users
WHERE email LIKE '%@example.invalid' AND email <> '__moi-nhu-vai-tro@example.invalid';
```

**Đừng xóa dòng mồi nhử**, và **đừng xóa `ui-audit@example.invalid`** nếu còn muốn dùng nó để
soi giao diện (mật khẩu `chauchuotgiaodien2026`, có quyền admin).

### 5. Nhánh chưa bao giờ merge, và không có remote

`feature/ke-sach-doc-sach` đi trước `master` **74 commit** tính tới đầu phiên này. Nhánh mặc định
của repo là `master` chứ không phải `main`, và `git remote -v` trống. Toàn bộ dự án đang sống
trên đúng một nhánh, đúng một ổ đĩa — chưa có bản sao nào ở đâu khác.

### 6. Những thứ đã cân nhắc và CỐ Ý bỏ

Danh sách cũ còn nguyên hiệu lực — kéo-thả đổi thứ tự, cột `position` cho `lessons`, nhúng trình
chiếu `.pptx`, ép thứ tự đọc trong `complete_book`, phân trang `/bai-giang` và bảng tin, gửi
email, `pgcrypto`/bcrypt, 2FA, đăng nhập bằng Google, và khóa cuộn nền khi mở trình đọc. Lý do
từng mục nằm ở các bản bàn giao trước trong git history. Phiên này thêm ba mục, lý do đầy đủ ở
§10 của spec:

| Việc | Vì sao bỏ |
|---|---|
| RPC đổi thứ tự câu hỏi | Bài kiểm tra chỉ 2–3 câu, thứ tự giữa chúng không mang nghĩa. Ràng buộc UNIQUE vẫn để DEFERRABLE nên đường nâng cấp còn mở |
| Giới hạn số lần làm bài | Đây là hàng rào SƯ PHẠM, không phải hàng rào bảo mật — xem mục dưới |
| Chấm điểm một phần | "Gần đúng" mà vẫn được thưởng thì bài kiểm tra không còn buộc ai đọc lại |

## Bốn điều phiên sau nên biết trước khi gõ phím

1. **Bài trắc nghiệm KHÔNG phải hàng rào bảo mật, và spec nói thẳng như vậy.** Nội dung sách vốn
   công khai, mỗi bài chỉ 2–3 câu, đáp án đoán được bằng cách thử. Thứ nó thật sự bảo đảm chỉ có
   hai: đáp án không bao giờ nằm trong HTML, và không chấm bài được ở phía client. Đừng hứa quá
   phạm vi đó — cùng lỗi mà `CLAUDE.md` đã cảnh báo cho `complete_book`.

2. **`npm run check` là cổng duy nhất cho code**, chạy tự động ở pre-commit. Sau mỗi lần đụng
   `db/schema/` thì thêm `db:check` **và** `db:mutation`. Hai lệnh cần superuser gọi thẳng script,
   `npm run` không nạp `.env.pgadmin`:
   ```
   node --env-file-if-exists=.env.local --env-file=.env.pgadmin scripts/db-migrate.mjs
   ```

3. **Việc UI vẫn không được dừng ở "cổng xanh"** — nhưng phép kiểm trong trình duyệt cũng phải
   đúng công cụ. `fullPage: true` của Playwright **nói dối về `animation-timeline: view()`**: ảnh
   chụp toàn trang chủ cho thấy ba trong bốn mốc thời gian trống trơn, trông y như một lỗi bố cục
   nghiêm trọng. Cuộn thật rồi đo `opacity` thì cả bốn đều bằng 1. Chụp từng khung nhìn.

4. **Sản phẩm CHỈ nhắm màn hình PC.** Ngưỡng thấp nhất phải chạy đúng là **1024×768**. Báo cáo lỗi
   bố cục dưới ~1000px thì bỏ qua.
