# ChronoShelf — "Cửa Sổ Lịch Sử"

Nền tảng học lịch sử trực quan cho học sinh Việt Nam. Người dùng khám phá một thư viện cổ:
mỗi chuyên mục là một **kệ sách**, mỗi bài học là một **quyển sách** lật từng trang. Đọc hết
một quyển và trả lời đúng bài kiểm tra cuối sách thì nhận được một **vật phẩm**, và chính vật
phẩm đó mở khóa quyển tiếp theo trên kệ.

Next.js 16 (App Router) · React 19 · PostgreSQL 18 cục bộ + Sequelize · Tailwind CSS 3.4 ·
TypeScript. Chỉ nhắm **màn hình PC**, ngưỡng thấp nhất là 1024×768.

## Đọc file nào

| File | Trả lời câu hỏi |
|---|---|
| `content.md` | Sản phẩm *là gì* — sitemap, cơ chế, nội dung từng trang. |
| `DESIGN.md` | Trông *như thế nào* — toàn bộ design token và lý do từng con số. |
| `db/schema/README.md` | Thứ tự chạy schema, ba role và vì sao có ba. Đọc trước khi đụng SQL. |
| `db/seed/` | Nội dung khởi tạo: kệ, sách, câu hỏi, bài giảng, cùng ảnh và slide đi kèm. |

## Bắt đầu

Cần **Node 24+** và **PostgreSQL 18 chạy cục bộ**.

```bash
npm install
cp .env.example .env.local     # rồi điền DATABASE_URL và SESSION_SECRET
```

`DATABASE_URL` phải trỏ role **`chronoshelf_app`**, không phải `postgres` — superuser bỏ qua
toàn bộ RLS và mọi policy sẽ ngừng tác dụng trong im lặng. Lý do đầy đủ ở `.env.example`.

Dựng database. Ba lệnh này cần chuỗi kết nối superuser; để nó ở `.env.pgadmin` (đã gitignore)
và gọi thẳng script, vì `npm run` không nạp được file env đó:

```bash
node --env-file-if-exists=.env.local --env-file=.env.pgadmin scripts/db-migrate.mjs
node --env-file=.env.pgadmin scripts/seed-content.mjs
npm run dev
```

Mở `http://localhost:3000` — dùng `localhost`, **không phải `127.0.0.1`**: Next 16 chặn tài
nguyên dev cross-origin và React sẽ không hydrate xong.

## Dựng trên server

Seed dựng lại **toàn bộ nội dung** đang có: 3 kệ, 13 quyển, câu hỏi trắc nghiệm, bài giảng,
cùng 72 ảnh và 2 bộ slide nằm trong `db/seed/media/` và `db/seed/tai-lieu/`. Không có dữ liệu
người dùng nào đi theo.

```bash
# 1. Dưới quyền superuser: role ứng dụng và database (chỉ một lần)
psql -U postgres -c "CREATE ROLE chronoshelf_app LOGIN PASSWORD '<mật khẩu mạnh>'"
psql -U postgres -c "CREATE DATABASE chronoshelf"

# 2. .env.local: DATABASE_URL trỏ chronoshelf_app, SESSION_SECRET là chuỗi ngẫu nhiên dài
#    .env.pgadmin: PGADMIN_URL=postgres://postgres:<mật khẩu>@127.0.0.1:5432/chronoshelf
node --env-file-if-exists=.env.local --env-file=.env.pgadmin scripts/db-migrate.mjs
node --env-file=.env.pgadmin scripts/seed-content.mjs
npm run db:check                 # phải ra "… đạt / 0 hỏng"

# 3. Build và chạy
npm run build && npm start
```

Rồi đăng ký một tài khoản qua giao diện và phong admin cho nó:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM public.users WHERE email = 'ban@example.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Seed chạy lại bao nhiêu lần cũng được. Nó **không** ghi đè phần admin đã biên tập trên kệ
(giới thiệu, phần thưởng, ảnh bìa, tranh ghép) hay bài giảng đã có. Nhưng nó **ghi đè** sách,
trang và câu hỏi theo bản trong repo.

**Đã sửa nội dung qua `/quan-tri` ở máy dev?** Xuất lại trước khi commit, nếu không seed sẽ dựng
ra bản cũ:

```bash
node --env-file=.env.pgadmin scripts/seed-export.mjs
```

## Lệnh

```bash
npm run check          # CỔNG DUY NHẤT cho code — chạy trước khi nói "xong"
npm run db:check       # hàng rào bảo mật nhìn từ ứng dụng, nối bằng đúng role ứng dụng
npm run dev            # dev server
npm run design:build   # sinh lại tailwind.theme.json từ DESIGN.md
```

`npm run check` cũng chạy tự động ở pre-commit (`.githooks/pre-commit`, nối bằng `npm run
prepare`). Sau mỗi lần đụng `db/schema/` thì chạy thêm `db:check` **và**
`scripts/db-mutation-check.mjs`.

## Vài điều dễ vấp

- Sửa màu/chữ/spacing thì sửa **`DESIGN.md`** rồi `npm run design:build`. Đừng sửa
  `tailwind.theme.json` bằng tay, và đừng hardcode mã hex trong component.
- Sửa **nội dung bài học** thì vào màn quản trị `/quan-tri`, không sửa file. `db/seed/` là
  bootstrap một chiều — sửa nó không làm đổi nội dung đang chạy. Chiều ngược lại (database →
  `db/seed/`) là `scripts/seed-export.mjs`.
- `npm run check` cần `.env.local` có mặt. `DATABASE_URL` không cần trỏ tới database sống,
  nhưng phải tồn tại — `next build` nạp `lib/db/sequelize.ts` và file đó throw nếu thiếu.
