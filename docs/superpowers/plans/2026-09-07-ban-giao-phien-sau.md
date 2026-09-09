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
npm run check        → exit 0                (nay có thêm design:dead-class)
npm run db:check     → 110 đạt / 0 hỏng     (đo lại 2026-09-10)
npm run db:mutation  → 53 đạt / 0 hỏng      (đo 2026-09-09)
npm run db:migrate   → 19 file schema
```

> **Bổ sung 2026-09-10 — đợt soát sau khi đổi thế giới thị giác.** Sáu lỗi im lặng do lượt
> đổi ~805 token để lại, tất cả đã sửa và đo lại trong trình duyệt: khối tài khoản ở rail
> vô hình (1,00:1), bản đồ chọn quốc gia đen kịt trên 705 `<path>`, ô chọn đáp án rơi về
> xanh hệ thống, gạch chân ghi công mất màu, thẻ kệ ở trang chủ mất cả hover lẫn active,
> chip "Nháp" 4,03:1. Cộng một lỗi bố cục: viền `<fieldset>` kẻ ngang câu hỏi trắc nghiệm.
> Chi tiết ở `docs/agents/bay-da-gap.md`; kể lại ở `docs/nhat-ky/2026-09-10.html`.
>
> Kèm theo là cổng mới `npm run design:dead-class` (đã chứng minh biết kêu) và một phép
> quét tương phản chạy trên 13 màn — sau khi sửa, **0 cặp dưới ngưỡng AA**.
>
> **Cùng ngày, thế giới cũ bị gỡ HẲN.** `components/Room.tsx` (+ `.module.scss`) đã xóa;
> trình đọc, đăng nhập, túi hành trang và trang chủ dựng lại trong chậu mực. Chi tiết ở
> mục "Thay thế giới thị giác" của `CLAUDE.md`. Đợt này lộ thêm ba loại lỗi mà lượt quét
> chữ không thấy — thước tiến độ dùng chung trên hai nền ngược nhau, và **bảy ký hiệu**
> mang thông tin ở 1,57–1,91:1 (WCAG 1.4.11 đòi 3:1). Nay quét CẢ đồ họa, không chỉ chữ:
> 6 màn + trình đọc, **0 lỗi**.
>
> Việc "dựng lại 6 màn" trong bàn giao cũ nay **chỉ còn 0**: cộng đồng, bài giảng và khu
> quản trị không phải dựng lại — chúng vốn là thẻ giấy trên nền giấy và đã đo sạch.

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

---

## Đợt dọn rác + viết lại tài liệu + tối ưu (cùng ngày)

Một workflow 7 góc nhìn độc lập soi toàn bộ repo, mỗi phát hiện về tối ưu đi qua hai người
phản biện. **24 phát hiện về tối ưu thì 21 bị bác** — phần lớn là "đúng về kỹ thuật nhưng
không đáng làm ở quy mô này". Ba cái sống sót đều đo được, và đã làm cả ba.

### Rác đã dọn

| | Trước | Sau |
|---|---|---|
| Cây làm việc (không kể `node_modules`/`.next`/`.git`) | 18 MB | **7 MB** |
| Ảnh PNG sót ở gốc repo | 21 file | 0 |
| Tài khoản trong DB dev | 65 | **3** |
| `db/schema/02-users.sql` | 168 dòng | **41** |
| `CLAUDE.md` | 502 dòng | **436** |

**`02-users.sql` là mục đáng kể nhất**: 146/168 dòng dựng bảng `login_codes` cùng hai hàm OTP
mà `15-mat-khau.sql` DROP ngay trong cùng một lượt migrate. Chúng chưa bao giờ sống quá một
lượt chạy — `90-verify.sql` khối A nổ nếu chúng còn. Tệ hơn: trong khoảng giữa file 02 và file
15, `app.consume_login_code` tồn tại thật với `GRANT EXECUTE TO chronoshelf_anon`, mang đúng
lỗi bộ-đếm-vĩnh-viễn-bằng-0. Đã kiểm bằng phép đo quyết định: **migrate lên một database
TRẮNG** (`chronoshelf_thu`, tạo rồi xóa) và lên database thật — cả hai xanh.

`db:check` **tự tạo 5 tài khoản mỗi lần chạy và không thể tự dọn** — role ứng dụng cố tình
không có `DELETE` trên `users`, chính hàng rào `90-verify.sql` canh. Đó là lý do 62 cái tích
lại. Dọn định kỳ bằng SQL ở mục "Việc còn lại" bên dưới; **giữ `__moi-nhu-vai-tro@` và
`ui-audit@`**.

### Ba tối ưu sống sót

1. **`/dang-nhap`: 491.543 → 71.831 byte client JS (−85,4%).** `LoginForm` import
   `MAT_KHAU_TOI_THIEU` từ `lib/auth/mat-khau.ts`, mà file đó mở đầu bằng
   `import crypto from "node:crypto"` — nên Turbopack kéo cả 445 KB polyfill `node:crypto`
   xuống trình duyệt **chỉ để lấy hằng số `8`**. Và nó là mã chết trọn vẹn: crypto-browserify
   không có `scrypt`, đúng hàm duy nhất file đó gọi. Đã tách phần thuần ra
   `lib/auth/mat-khau-quy-tac.ts`. Đo lại trên artifact `.next`: chunk polyfill **biến mất**,
   không còn chunk nào chạm `crypto-browserify`/`pbkdf2`.
2. **`npm run lint`: 5,6s → 3,2s.** Bật `--cache` với
   `--cache-location node_modules/.cache/eslint` — theo đúng tiền lệ `design:verify` đã ghi
   file sinh ra vào `node_modules/`, nên **không phải đụng `.gitignore`** và không có file lạ
   nào nằm ở gốc repo.
3. **Khối A của `90-verify.sql` bỏ sót đúng hai bảng, và dùng sai hàm.** Danh sách 13 bảng viết
   tay đã lỡ nhịp hai lần (`media`, rồi `book_questions`). Nay **quét `pg_tables`** nên bảng
   mới tự động được canh. Quan trọng hơn: đổi `has_table_privilege` →
   `has_any_column_privilege` — hàm cũ **mù với GRANT theo cột**, tức
   `GRANT SELECT (correct_index) … TO chronoshelf_app` lọt qua trong im lặng. `db:mutation` có
   hai đột biến mới chứng minh cả hai vế.

### Tài liệu đã viết lại

- **`README.md`**: từ bản mặc định `create-next-app` (sai font, sai trình quản lý gói, sai
  cách chạy, không nhắc `.env.local`) thành 65 dòng nói đúng về ChronoShelf.
- **`app/icon.svg`** thay `favicon.ico` mặc định — tab trình duyệt không còn là logo Vercel.
- **`content.md` §8 §9 §4.3**: §8 từng nói render tĩnh / đăng nhập Google / object storage /
  responsive — cả bốn đều ngược thực tế. §9 khai một cột "vật phẩm yêu cầu để mở" mà dự án
  bảo đảm KHÔNG tồn tại.
- **`CLAUDE.md`**: bốn con số đã lệch, sửa theo catalog (14→27 policy, 3→4 ràng buộc
  DEFERRABLE, 8→11 hàm SECURITY DEFINER, "mọi route force-dynamic"→22 tường minh + 2 mặc
  định). Mục **Bẫy đã gặp** (27 mục, 23% file) tách sang `docs/agents/bay-da-gap.md`, giữ lại
  bốn cái đắt nhất.
- **`DESIGN.md`**: ràng buộc "CHỈ PC, 1024×768" chuyển vào đây — nó là quyết định thiết kế, và
  DESIGN.md là file duy nhất `design:verify` canh trong `npm run check`. Thêm cặp màu
  `quiz-wrong` (5.96:1) để `design:lint` gác được cặp duy nhất báo lỗi cho học sinh.
- **Xóa hai plan đã xong việc** (chặng C, bảng tin). Plan là danh sách bước, không giữ quyết
  định nào; git history vẫn còn. `docs/superpowers/plans/` nay chỉ còn bản bàn giao này.

---

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

`kim-tu-thap-ai-cap` **đã viết xong ngày 2026-09-09**: 4 trang + 3 câu hỏi như 12 quyển kia.
Hai trang mới là "Ai đã xây, và xây bằng gì" (làng thợ ở Giza, dụng cụ, con số của Herodotus so
với con số khảo cổ) và "Vì sao lại là hình tháp" (mastaba → kim tự tháp bậc thang của Djoser →
Meidum và kim tự tháp gãy thời Sneferu). Nhân đó sửa một lỗi sự thật có sẵn trong seed: Kheops
giữ kỷ lục **gần** bốn nghìn năm, không phải "hơn" — nó bị một nhà thờ ở châu Âu vượt qua vào
đầu thế kỷ XIV. Phân bố đáp án sau khi thêm: 10/10/11/8.

### 2. Ba mảnh của `content.md` — ĐÃ DỰNG HẾT ngày 2026-09-09

| Việc | Ở đâu | Dựng thế nào |
|---|---|---|
| Âm thanh lật trang + nút tắt tiếng | §4.2 | `components/reader/tieng-lat-trang.ts` — nhiễu trắng qua bandpass, **sinh bằng Web Audio chứ không phải file .mp3**: 0 byte tải về và không có giấy phép âm thanh nào phải ghi công (cả repo đã dựng bốn ràng buộc CHECK chỉ để ảnh không lọt vào mà thiếu credit — một file tiếng tải từ đâu đó là mở lại đúng lỗ ấy ở chỗ không ràng buộc nào canh). Nút tắt tiếng cạnh nút đóng sách, nhớ qua `localStorage`. Tiếng gắn với CÚ LẬT chứ không với nút bấm, nên phím mũi tên và nút "Mở sách" đều kêu. |
| Sưu tầm trọn bộ → danh hiệu + nội dung thưởng | §4.5 | Hai cột `shelves.reward_title` + `reward_body`, soạn ở `/quan-tri`. Cắt ở tầng ĐỌC: `readTuiHanhTrang()` trả `phanThuong: null` khi chưa đủ. Cờ `coPhanThuong` tách riêng để trang mời gọi được ("còn 1 vật phẩm nữa") mà không chạm được vào nội dung. |
| Mảnh ghép → bức tranh toàn cảnh | §4.4 | `shelves.mosaic_url` + hai cột credit. Dựng cho MỌI kệ, không hardcode slug nào. Cắt theo **dải dọc** (`lib/tranh-ghep.ts`, có test): lưới ô vuông đòi một cặp hàng×cột tích đúng bằng số vật phẩm, mà số đó do admin quyết lúc chạy — kệ 5 quyển thì không lưới nào vừa. |

Năm cột mới ở `db/schema/16-bo-suu-tap-tron-bo.sql`, hai ràng buộc mới được `90-verify.sql`
canh và `db:mutation` chứng minh là biết kêu.

**Đã đo thật trong trình duyệt ở 1024×768** (tài khoản `ui-audit`, console sạch 0 lỗi), ba
trạng thái trong một lượt: kệ Việt Nam 5/5 → tranh liền lại + danh hiệu "Người giữ hồn nước";
kệ Thế giới 3/4 → ba dải hiện, dải thứ tư gạch chéo có ổ khóa, kèm dòng "Còn 1 vật phẩm nữa";
kệ Quanh cuộc sống 0/4 → gạch chéo cả bốn. Nút tắt tiếng: 2 cú lật → đúng 1 `AudioContext` và
2 lần phát; tắt rồi lật 2 lần → 0 lần phát; bật lại → nghe thử đúng 1 tiếng; tải lại trang →
vẫn nhớ trạng thái tắt. Màn `/quan-tri` lưu round-trip thật, và bỏ trống danh hiệu trong khi
còn nội dung thưởng thì bị chặn kèm câu giải thích.

**Ảnh tranh ghép vẫn để trống trên cả ba kệ** — nó thuộc mục 1 phía trên. Đã soi giao diện
bằng một tấm ảnh mượn tạm rồi gỡ ngay; không dòng dữ liệu nào còn giữ nó.

### 2b. Soát CRUD phía admin — xong 2026-09-09, tìm được ĐÚNG MỘT lỗ

Đối chiếu ba tầng (server action ↔ GRANT + policy ↔ nút trên giao diện) cho từng thực thể.
Nội dung bài học **đủ cả**: kệ, sách, trang, câu hỏi, vật phẩm, bài giảng đều có tạo/sửa/xóa,
cộng publish và đổi thứ tự ở nơi cần. 24/24 server action đều có ít nhất một component gọi tới
— không có action mồ côi.

Hai chỗ **cố ý** không có D, đừng "sửa": `media` và `documents` là bảng chỉ-ghi-thêm, chính
cấu tạo đó khiến `Cache-Control: immutable` ở route phục vụ đúng theo cấu tạo chứ không theo
lời hứa. Đánh đổi: ảnh mồ côi tích lại và không có đường gỡ trong ứng dụng.

**Lỗ thật, đã vá:** bảng tin cộng đồng chỉ có SELECT + INSERT — *không ai* gỡ được bài hay bình
luận, kể cả admin; cách duy nhất là mở psql dưới quyền superuser. Nay `db/schema/17` mở DELETE
với policy hai vế (tác giả HOẶC admin), giao diện `/cong-dong` có nút gỡ ngay tại bài và tại
từng bình luận, và `lib/community/actions.ts` đọc `rowsAffected()` vì **policy ở đây chặn
trong im lặng** — trúng 0 dòng chứ không ném lỗi.

UPDATE thì cố ý vẫn đóng, và có phép kiểm giữ nó đóng. Lý do ở đầu file 17.

Đo thật ở 1024×768 bằng tài khoản `ui-audit`, console sạch: đăng một bài thử → gỡ → còn 2 bài;
thêm một bình luận thử → gỡ → bình luận cũ của bài vẫn nguyên; nạp `/cong-dong` không kèm
cookie thì HTML **không có** chữ "Gỡ bài" nào. Nhánh "Gỡ (quản trị)" (admin gỡ bài người khác)
chưa bấm được trong trình duyệt vì DB dev chỉ có một tài khoản từng đăng bài — nhưng
`db:check` gọi thẳng DELETE dưới danh tính admin trên bài của người khác và đòi trúng đúng 1
dòng, cộng một phép đối chứng đòi người thường trúng 0 dòng.

### 3. Siết `sniffPptx` khi có `.pptx` thật để đối chứng

Không đổi. `laGoiZip()` hiện chỉ khẳng định "là một gói ZIP"; thêm phép so `[Content_Types].xml`
ở offset 30 khi có file thật commit vào repo.

### 4. Dọn tài khoản test trong database dev — việc ĐỊNH KỲ

Đã dọn 62 cái ngày 2026-09-07 (65 → 3), nhưng **nó sẽ tích lại**: `npm run db:check` tạo 5 tài
khoản mới mỗi lần chạy và không thể tự dọn — role ứng dụng cố tình không có `DELETE` trên
`users`, chính hàng rào `90-verify.sql` canh. Chạy lại khi thấy chướng:

```sql
DELETE FROM public.users
WHERE email LIKE '%@example.invalid'
  AND email NOT IN ('__moi-nhu-vai-tro@example.invalid', 'ui-audit@example.invalid');
```

**Giữ hai cái đó.** `__moi-nhu-vai-tro@` là mồi nhử của `db:check`; `ui-audit@` là tài khoản
admin dùng để soi giao diện (mật khẩu `chauchuotgiaodien2026`) và nó giữ bài đăng cộng đồng —
xóa nó là mất luôn bảng tin. Xóa xong nhớ chạy lại `npm run db:check` để chắc vẫn 102/0.

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
