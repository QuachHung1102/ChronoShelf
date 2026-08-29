# `db/schema/` — nguồn sự thật cho cấu trúc database

Chạy tất cả bằng `npm run db:migrate`. Script chạy các file `NN-*.sql` ở thư mục này
**theo thứ tự tên file**, mỗi file trong một transaction riêng.

Tách nhỏ theo *một mối quan tâm một file* thay vì một file khổng lồ theo ngày. Đổi
schema thì **sửa đúng file liên quan** rồi chạy lại `db:migrate` — mọi file đều viết
để chạy lặp được (`CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF
EXISTS` trước khi tạo).

| File | Nội dung | Cần superuser |
|---|---|---|
| `00-roles.sql` | Ba role và quan hệ thành viên giữa chúng | ✅ |
| `01-app-context.sql` | Schema `app`, hàm `app.current_user_id()` | |
| `02-users.sql` | `users`, `login_codes` — tài khoản và mã đăng nhập | |
| `03-user-roles.sql` | `user_roles`, `is_admin()` | |
| `04-content-tables.sql` | `shelves`, `items`, `books`, `pages` | |
| `05-content-rls.sql` | RLS + policy + grant cho bốn bảng nội dung | |
| `06-user-state.sql` | `user_book_progress`, `user_items` | |
| `07-complete-book.sql` | `_complete_book_for`, `complete_book` | |
| `08-reorder.sql` | `reorder_books`, `reorder_pages` | |
| `09-media.sql` | `media` — kho ảnh bytea, khóa chính là sha256 của chính nội dung; policy đọc-công-khai + GRANT chỉ-ghi-thêm | |
| `10-image-credit.sql` | Vá dữ liệu ảnh cũ RỒI thêm ràng buộc "có ảnh thì phải có nguồn + tác giả" — thứ tự trong file quan trọng | |
| `90-verify.sql` | Khẳng định cấu trúc — nổ nếu hàng rào bị nới | |

## Ba role, không phải một

`chronoshelf_app` là role duy nhất có `LOGIN` — `DATABASE_URL` dùng nó. Nó
**`NOINHERIT`** và là thành viên của hai role không đăng nhập được:

- `chronoshelf_anon` — người chưa đăng nhập
- `chronoshelf_auth` — người đã đăng nhập

Mỗi request mở một transaction rồi `SET LOCAL ROLE` sang đúng một trong hai, kèm
`SET LOCAL app.user_id` khi đã đăng nhập. `SET LOCAL` hết hiệu lực lúc `COMMIT`, nên
không rò rỉ sang request sau.

**Vì sao không gộp thành một role cho gọn:** quyền ở tầng `GRANT` là hàng rào thứ hai
độc lập với policy. Ví dụ `chronoshelf_anon` *không có* `GRANT SELECT` trên
`user_roles` và không có `INSERT` trên `user_book_progress` — kể cả khi một policy bị
sửa hỏng thành `USING (true)`, người chưa đăng nhập vẫn không chạm tới được. Gộp một
role sẽ vứt bỏ lớp đó và biến mọi khẳng định `has_table_privilege('anon', …)` trong
`90-verify.sql` thành vô nghĩa.

**Vì sao không nối thẳng bằng `postgres`:** superuser **bỏ qua toàn bộ RLS**. Nối bằng
nó thì mọi policy trong `05-content-rls.sql` im lặng ngừng tác dụng, ứng dụng vẫn chạy
đúng như thường, và không có gì báo cho ai biết. `chronoshelf_app` đã được xác minh
`rolsuper = f`, `rolbypassrls = f`.

## Cái gì KHÔNG nằm ở đây

`90-verify.sql` chỉ kiểm **cấu trúc** (grant, biểu thức policy, deferrable) nên chạy
được trên database rỗng. Phần kiểm **hành vi** của `complete_book` và các RPC đổi thứ tự
cần dữ liệu seed, nên nằm ở `scripts/db-check.mjs` và chạy sau khi seed. (Trước đây đoạn
này trỏ tới một thư mục `db/verify/` **chưa từng tồn tại** — đã kiểm bằng `ls`.)

Hàng rào nhìn từ ngoài Internet — thứ một request thật làm được — do
`npm run db:check` lo, không phải file ở đây: SQL trong này chạy bằng quyền admin nên
nó kiểm được `has_table_privilege` nhưng không kiểm được điều thật sự quan trọng.
