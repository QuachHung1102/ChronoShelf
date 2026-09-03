# Bàn giao — trạng thái ngày 2026-09-04

> Đọc file này khi mở phiên mới. Nó ghi **đã làm gì**, **cổng đang ở đâu**, và **việc kế tiếp
> là gì kèm thứ đang chặn nó**. Kiến thức lâu dài thuộc về `CLAUDE.md`; file này là ảnh chụp
> một thời điểm và sẽ bị xóa khi các mục "còn lại" xong hết.
>
> Thay cho `2026-08-30-ban-giao-phien-sau.md` — **cả bốn mục "còn lại" của bản đó đã xong**.

Nhánh: `feature/ke-sach-doc-sach`. Phiên này: **5 commit**.

**Tài khoản admin đã đổi.** Mọi tài khoản cũ (tạo qua OTP, không có mật khẩu) đã bị xóa theo
đúng yêu cầu "xóa làm lại cho đơn giản" — kể cả `admin@chronoshelf.local`. Admin hiện tại là
`quachhung389@gmail.com`, đăng ký qua giao diện rồi cấp quyền bằng SQL superuser (lệnh ở
`CLAUDE.md`, mục "Nội dung nằm trong database").

---

## Đã làm

| Commit | Nội dung |
|---|---|
| `599b172` | **Bảng tin cộng đồng** (`content.md` §6, vế thứ hai). Đăng bài, bình luận, danh hiệu. Bài đăng tính là nhiệm vụ giữ chuỗi, bình luận thì không |
| `8ff33cb` | **Bản đồ chọn quốc gia** cho kệ, thay ô nhập mã ISO |
| `56d0d44` | **Thư viện bài giảng & slide** (`content.md` §7). Mục thứ 5 của sitemap, trước đó chưa có route nào |
| `7586669` | **Nội dung mẫu**: kệ thứ ba + ba quyển mới cho kệ Thế giới |
| *(commit này)* | **Đăng nhập bằng mật khẩu** thay OTP qua email, khôi phục bằng câu hỏi bảo mật; mốc danh hiệu thứ ba |

Sitemap `content.md` §3 nay **đủ cả 5 mục**.

## Cổng đang ở đâu

```
npm run check        → exit 0, 99 test
npm run db:check     → 85 đạt / 0 hỏng
npm run db:mutation  → 40 đạt / 0 hỏng
db/schema/90-verify  → 8 mục A–H đều đạt (+ khối I tự kiểm trong 15-mat-khau.sql)
```

17 file schema (mới: `13-community.sql`, `14-learning-hub.sql`, `15-mat-khau.sql`).
24 route. Nội dung: 3 kệ / 13 quyển đã xuất bản / 50 trang / 13 vật phẩm / 2 bài giảng mẫu.

## Việc còn lại

### 1. Slide và sơ đồ tư duy THẬT (chờ người dùng)

Hạ tầng xong và đã chạy thật đầu-cuối, nhưng hai bài giảng hiện có là **mẫu**: tệp `.pptx`
chỉ là gói ZIP nhỏ dựng lúc kiểm thử, còn ảnh xem trước và sơ đồ tư duy đang mượn tạm hai
tấm trong `public/timeline/`. Người dùng nói "mình chưa có" — khi nào có bộ slide thật thì
vào `/quan-tri/bai-giang` thay, không cần đụng mã.

### 2. Siết `sniffPptx` khi có `.pptx` thật để đối chứng

`laGoiZip()` hiện chỉ khẳng định "là một gói ZIP". Lý do dừng ở đó ghi đủ trong chính hàm
và trong spec §3 — tóm tắt: máy dựng không tải nổi một `.pptx` thật (đã thử ba nguồn, cả ba
404), và viết phép kiểm chặt hơn dựa trên suy đoán bố cục file là cách chắc chắn để chặn
đúng tệp của người dùng. Khi có file thật commit vào repo thì thêm phép so
`[Content_Types].xml` ở offset 30 kèm test.

### 3. Dọn tài khoản test trong database dev

Mỗi lần `npm run db:check` chạy là commit thêm 5 tài khoản `*@example.invalid` — chúng phải
sống qua nhiều transaction nên không rollback được. Hành vi này có từ trước (luồng OTP cũng
vậy), chỉ là nay 5 thay vì 3. Vô hại nhưng bẩn; dọn bằng superuser khi thấy chướng:
`DELETE FROM public.users WHERE email LIKE '%@example.invalid' AND email <> '__moi-nhu-vai-tro@example.invalid'`.
**Đừng xóa dòng mồi nhử** — thiếu nó là hai phép kiểm mất hết ý nghĩa.

### 4. Những thứ đã cân nhắc và CỐ Ý bỏ

Đừng làm lại nếu không có yêu cầu mới:

| Việc | Vì sao bỏ |
|---|---|
| Kéo-thả đổi thứ tự | Người dùng đã chọn bỏ; ▲/▼ nay đã giữ tiêu điểm và đọc kết quả |
| Cột `position` cho `lessons` | Bài giảng không có chuỗi mở khóa nào để mà phụ thuộc thứ tự |
| Nhúng trình chiếu `.pptx` lên web | Office Online đòi file có URL công khai; dựng trình đọc OOXML phía client là nhiều mã hơn cả subsystem. Xem trước là ảnh tĩnh admin tải lên |
| Ép thứ tự đọc trong `complete_book` | Bản vá hiển nhiên vừa không chặn được vừa làm đứt chuỗi khi admin chèn sách. Xem `lib/api/unlock.ts` |
| Phân trang `/bai-giang` và bảng tin | Vài chục dòng, không tăng theo số người dùng. Trần đã ghi bằng comment `ponytail:` tại chỗ |
| Gửi email (OTP, xác minh, đặt lại mật khẩu) | Người dùng đã chốt bỏ hẳn. Không có `deliver()`, không có nhà cung cấp mail, không có gì để quên cấu hình |
| `pgcrypto` / bcrypt cho mật khẩu | Extension phải bật ở mọi nơi deploy, và bcrypt cắt cụt mật khẩu ở 72 byte — tiếng Việt có dấu thì đó là 24 ký tự. `crypto.scrypt` là stdlib |
| Xác thực hai lớp, đăng nhập bằng Google | Ngoài phạm vi hiện tại; câu hỏi bảo mật là thứ người dùng đã chọn |

## Ba điều phiên sau nên biết trước khi gõ phím

1. **`npm run check` là cổng duy nhất cho code**, chạy tự động ở pre-commit. Sau mỗi lần đụng
   `db/schema/` thì thêm `db:check` **và** `db:mutation` — cần `PGADMIN_URL`.

2. **Việc UI không được dừng ở "cổng xanh".** Phiên này tìm ra ba lỗi mà mọi cổng đều mù:
   React tái dùng `<input>` giữa hai nhánh (`SlideField`), API tải lên vọng lại tên tệp sai,
   và `RESERVED_SLUGS` thiếu hai slug. Cả ba chỉ lộ ra khi mở trình duyệt làm thật.

   Riêng với đăng nhập: `db:check` chứng minh được luật, nhưng **chỉ trình duyệt mới chứng
   minh được người dùng đi hết được luồng**. Đã chạy thật cả ba: đăng ký, đăng nhập, và khôi
   phục hai bước.

3. **Sản phẩm CHỈ nhắm màn hình PC.** Ngưỡng thấp nhất phải chạy đúng là **1024×768**. Báo
   cáo lỗi bố cục dưới ~1000px thì bỏ qua.
