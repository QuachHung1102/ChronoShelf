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
| **`CLAUDE.md`** | **Bắt đầu từ đây.** Toàn bộ kiến thức dự án: kiến trúc, quy tắc bắt buộc, bẫy đã gặp, lệnh. |
| `content.md` | Sản phẩm *là gì* — sitemap, cơ chế, nội dung từng trang. |
| `DESIGN.md` | Trông *như thế nào* — toàn bộ design token và lý do từng con số. |
| `db/schema/README.md` | Thứ tự chạy schema, ba role và vì sao có ba. Đọc trước khi đụng SQL. |
| `docs/superpowers/specs/` | Spec đã duyệt, mỗi subsystem một file. |

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
- Sửa **nội dung bài học** thì vào màn quản trị `/quan-tri`, không sửa file. `db/seed/*.json`
  là bootstrap một chiều — sửa nó không làm đổi nội dung đang chạy.
- `npm run check` cần `.env.local` có mặt. `DATABASE_URL` không cần trỏ tới database sống,
  nhưng phải tồn tại — `next build` nạp `lib/db/sequelize.ts` và file đó throw nếu thiếu.
