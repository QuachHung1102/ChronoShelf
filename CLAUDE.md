# ChronoShelf — "Cửa Sổ Lịch Sử"

Nền tảng học lịch sử trực quan cho học sinh Việt Nam. Người dùng khám phá một thư viện cổ:
mỗi chuyên mục là một kệ sách, mỗi bài học là một quyển sách lật từng trang. Đọc xong một
quyển thì nhận được một vật phẩm, và chính vật phẩm đó mở khóa quyển tiếp theo trên kệ.

**Trả lời người dùng bằng tiếng Việt.**

> ⚠️ **Mọi kiến thức về dự án thuộc về file này.** Đừng tạo lại `AGENTS.md` — nó từng tồn tại
> nhưng chỉ chứa tài liệu SDK của một backend không còn dùng, và đã bị xóa ngày 2026-08-28.

## Nguồn sự thật — đọc trước khi làm

| File | Nội dung |
|---|---|
| `content.md` | Bản mô tả sản phẩm đầy đủ: sitemap, cơ chế, nội dung từng trang. Nguồn sự thật về *cái gì* cần xây. |
| `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md` | **Đọc khi mở phiên mới**: kiến trúc nội dung — nội dung nằm trong database, vai trò admin/user, đọc thẳng `books`/`pages`. Phần *sản phẩm* còn đúng; phần *hạ tầng* viết theo backend cũ, xem banner ở đầu file. |
| `DESIGN.md` | Hệ thiết kế (format `design.md` của Google Labs): toàn bộ color/typography/spacing token + lý do. Nguồn sự thật về *trông như thế nào*. |
| `db/schema/README.md` | Thứ tự chạy schema, ba role và lý do. **Đọc trước khi đụng SQL.** |
| `docs/superpowers/specs/` | Spec đã được duyệt, mỗi subsystem một file. |
| `docs/superpowers/plans/2026-09-06-ban-giao-phien-sau.md` | **Đọc đầu tiên khi mở phiên mới**: đã làm gì, cổng đang ở đâu, việc kế tiếp là gì và thứ đang chặn nó. Ảnh chụp một thời điểm — xóa khi các mục "còn lại" xong hết. |
| `docs/superpowers/plans/` | Kế hoạch triển khai từng bước. Chặng C đã hoàn tất; các plan cũ bị xóa ngày 2026-08-28 vì hướng dẫn theo backend cũ — git history vẫn giữ. |
| `pen.dev/design.pen` | File thiết kế Pencil — mockup UI đã duyệt. |
| `db/schema/` | SQL schema, nguồn sự thật cho cấu trúc DB. |

Sản phẩm được chia thành các subsystem gần như độc lập, mỗi cái đi qua vòng
spec → plan → code riêng: **kệ sách + đọc sách** (cơ chế lõi), trang chủ (timeline
"Ngày ấy – Bây giờ"), túi hành trang, streak + cộng đồng, learning hub (slide/mindmap).
Đừng gộp nhiều subsystem vào một lượt làm.

## Quy tắc bắt buộc

- **`.pen` chỉ mở bằng Pencil MCP** (`get_app_state` với đủ 3 flag → `execute`). KHÔNG dùng
  Read / Grep / Edit lên `.pen`: MCP server của Pencil quy định như vậy, và đọc thô file này
  chỉ cho ra một khối JSON lớn đã cũ thay vì trạng thái thật mà `get_app_state` trả về.
  `.claude/settings.json` có deny rule `Read/Edit/Write(pen.dev/**)`. Nó chặn thật: Claude Code
  chuẩn hóa đường dẫn Windows sang dạng POSIX trước khi so khớp, và deny rule của `Read` cũng
  áp cho `cat`/`head`/`tail`/`sed` chạy qua Bash. **Nhưng deny rule không chặn subprocess tùy
  ý** — `git show HEAD:pen.dev/design.pen` từng đọc được đủ 57361 byte. Lỗ đó nay bịt bằng hook
  `PreToolUse(Bash)` ở `.claude/hooks/guard-pen-dev.mjs`: mọi lệnh shell có chuỗi `pen.dev` đều
  bị chặn, vì mọi lệnh đều đi qua đúng một cửa đó. Vẫn là hàng rào chống lỡ tay, không phải
  ranh giới bảo mật — ghép chuỗi là lách được.
- **Sửa `.pen` xong phải kiểm tra `git status` trước khi commit.** Mutation qua Pencil MCP
  không ghi xuống đĩa ngay — `Get`/`GetVariables` đọc trạng thái trong bộ nhớ editor nên vẫn
  trả về giá trị mới trong khi file trên đĩa còn y nguyên. Đã suýt commit hụt một loạt thay
  đổi vì tin vào `Get`. Nếu `git status` chưa thấy `pen.dev/design.pen` bị sửa, chạy thêm một
  `execute` nữa (ví dụ `SetVariables` lặp lại đúng giá trị cũ) để đẩy phần đang treo xuống đĩa.
- **Tailwind CSS 3.4, không nâng lên v4.** Version pin cứng trong `package.json`. Nâng lên v4
  là một task RIÊNG: v4 đổi cả cách cấu hình theme, tức là đụng vào đường sinh
  `DESIGN.md → tailwind.theme.json`. Đừng nâng kèm theo việc khác.
- **Việc trao vật phẩm phải nằm ở phía server.** Client chỉ báo "đã đọc xong quyển X"; RPC
  `complete_book` (`SECURITY DEFINER`) là cửa DUY NHẤT ghi được vào `user_items`. Không bao
  giờ chuyển logic này xuống client, và không cấp quyền INSERT/UPDATE trực tiếp lên
  `user_items` hay cột `user_book_progress.completed` cho role `chronoshelf_auth`.
  **Đừng hứa quá phạm vi nó bảo đảm:** chỉ máy chủ mới trao được vật phẩm, không hoàn thành
  được sách hay kệ chưa xuất bản, không hoàn thành được quyển rỗng — nhưng nó **KHÔNG ép thứ
  tự đọc** (đã đo 2026-08-29: gọi thẳng quyển cuối kệ với túi đồ rỗng vẫn được trao thưởng).
  Khóa/mở chỉ là chuyện hiển thị — `resolveState` ở `lib/api/unlock.ts` vẽ bìa sách — và nội
  dung quyển "bị khóa" vốn đã công khai. Ngày nào cần ép thật (streak, bảng xếp hạng so người
  với người) thì theo đường nâng cấp ghi sẵn ở `lib/api/unlock.ts`; **đừng suy thứ tự từ
  `position`** — `08-reorder.sql` cho đổi position nên nó không cố định, và một lần admin chèn
  sách vào giữa là làm đứt chuỗi của người đang đọc.
- **Bí mật không vào git.** `.env.local` giữ `DATABASE_URL` và `SESSION_SECRET`; nó đã bị dòng
  `.env*` trong `.gitignore` chặn. Đừng chép giá trị thật sang `.env.example` hay bất kỳ file
  được commit nào. Mật khẩu superuser của Postgres **không nằm trong dự án** — truyền qua
  `PGADMIN_URL` theo từng lệnh khi cần.

## Thiết kế — DESIGN.md là nguồn duy nhất

`DESIGN.md` giữ toàn bộ design token. `tailwind.config.ts` **đọc từ file sinh ra bởi nó**, nên:

```bash
npm run design:lint     # kiểm tra token + tương phản WCAG AA
npm run design:build    # DESIGN.md -> tailwind.theme.json
```

- Đổi màu/chữ/spacing thì sửa `DESIGN.md` rồi chạy `design:build`. **Đừng sửa
  `tailwind.theme.json` bằng tay** — nó là file sinh ra.
- **Đừng hardcode mã hex trong component.** Dùng class Tailwind sinh từ token: `bg-primary`,
  `text-on-primary`, `rounded-md`, `text-headline-lg`…
- **Tailwind là chính; SCSS chỉ cho phần phải code tay.** Layout/màu/chữ/khoảng cách viết bằng
  class Tailwind ngay trong JSX. Chỉ mở `*.module.scss` khi Tailwind không diễn đạt gọn được:
  `@keyframes`, `box-shadow`/gradient tùy biến, kích thước không có trong thang spacing. Trong
  SCSS vẫn lấy màu từ token bằng `theme('colors.tertiary / 55%')` — không viết hex.
- `design:lint` chặn lỗi tương phản. Palette đã được sửa để đạt AA: `tertiary` (#E8622C) chỉ
  dùng cho đồ họa, `tertiary-deep` khi accent làm nền cho chữ, `tertiary-light` khi accent là
  chữ trên nền nâu. Chi tiết lý do nằm trong mục Colors của `DESIGN.md`.

## Nội dung nằm trong database

Nội dung bài học (kệ, sách, trang, vật phẩm) nằm ở 4 bảng `shelves`, `items`, `books`,
`pages`; bài giảng & slide nằm ở `lessons` + `documents`. Sửa nội dung đang chạy bằng
**màn quản trị `/quan-tri`** (`/quan-tri`, `/quan-tri/[shelf]`, `/quan-tri/[shelf]/[book]`,
`/quan-tri/vat-pham`, `/quan-tri/bai-giang`; server action ở `lib/admin/actions.ts`, upload
ảnh qua `/api/quan-tri/anh` vào bảng `media`, upload `.pptx` qua `/api/quan-tri/tai-lieu` vào
bảng `documents`). `psql` dưới quyền
superuser chỉ còn dùng cho bootstrap (`seed:content`), đổi schema (`db:migrate`) và cấp quyền
admin — **đừng dùng nó để sửa nội dung**: superuser bỏ qua RLS và không đi qua
`readImageFields()`, nên ảnh sẽ không vào bảng `media` —
**không sửa bằng cách đụng vào file** (`db/seed/*.json` là bootstrap một chiều, xem đoạn dưới).
Admin phải tạo được sách lúc chạy mà không cần build lại. Lý do đầy đủ ở
`docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md` §2.1, §5.

`db/seed/*.json` là **bootstrap một chiều**: `npm run seed:content` ghi thẳng vào database (cần
`PGADMIN_URL`). Sửa file đó KHÔNG làm đổi nội dung đang chạy.

Seed cũng tạo **hai dòng mồi nhử** mà `npm run db:check` phụ thuộc: quyển nháp vĩnh viễn
`__nhap-khong-bao-gio-xuat-ban` và dòng vai trò `admin` của tài khoản mồi nhử
`22222222-2222-2222-2222-222222222222`. **Đừng "dọn" chúng.** Thiếu mồi nhử thì hai phép kiểm
vẫn chạy, vẫn báo đạt, nhưng hết nghĩa — mọi sách thật đều đã xuất bản nên phép đọc-sách-nháp
luôn thấy 0 dòng, và `user_roles` không còn dòng "của người khác" nào nên phép đọc-trộm-vai-trò
cũng luôn thấy 0 dòng, kể cả khi RLS hỏng hoàn toàn.

**Không có cột "vật phẩm cần để mở".** Quyển `i` mở bằng vật phẩm thưởng của quyển `i-1`,
suy ra từ vị trí chứ không lưu — nên chuỗi mở khóa không thể đứt. Đánh đổi và đường nâng cấp
ghi ở `lib/api/unlock.ts`.

Vai trò nằm ở `public.user_roles`: không có dòng nghĩa là `user`, chỉ admin mới có dòng.
`chronoshelf_auth` không có GRANT ghi nào lên bảng đó, nên không ai tự phong admin được. Cấp
admin bằng SQL chạy dưới quyền superuser:

```bash
PGPASSWORD=... "/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -h 127.0.0.1 -d chronoshelf \
  -c "INSERT INTO public.user_roles (user_id, role)
      SELECT id, 'admin' FROM public.users WHERE email = 'ai-do@example.com'
      ON CONFLICT (user_id) DO UPDATE SET role = 'admin'"
```

## Backend — PostgreSQL cục bộ

**PostgreSQL 18 cục bộ + Sequelize + Next.js Route Handlers.** Không có server Express riêng —
app đã là Next.js nên thêm một process nữa chỉ tốn CORS, hai chỗ deploy và logic phiên viết hai
lần. Đã cân nhắc MySQL và loại: repo có 14 policy RLS (MySQL không có RLS), 3 ràng buộc
`DEFERRABLE INITIALLY DEFERRED` mà RPC đổi thứ tự được thiết kế quanh nó (MySQL không có), và
cột `summary text[]`.

Trước 2026-08-28 dự án chạy trên một BaaS ngoài. Nó đã bị gỡ bỏ hoàn toàn — nếu còn thấy dấu vết
nào ở đâu thì đó là sót, xóa đi.

### Ba role, và vì sao không phải một

`DATABASE_URL` nối bằng `chronoshelf_app` — role **`NOINHERIT` không có quyền gì cả**. Mỗi request
mở một transaction rồi `SET LOCAL ROLE` sang `chronoshelf_anon` hoặc `chronoshelf_auth`, kèm
`SET LOCAL app.user_id`. Tất cả đi qua đúng một hàm: `withRole()` ở `lib/db/tx.ts`.

- **Quên truyền `transaction` xuống một truy vấn là hỏng TO và hỏng NGAY** — nó chạy dưới
  `chronoshelf_app` và Postgres trả `permission denied`. Fail đóng, không âm thầm chạy với quyền
  rộng hơn. Đó là lý do **không** cần CLS/AsyncLocalStorage để tự gắn transaction.
- **Đừng nối bằng `postgres`.** Superuser bỏ qua toàn bộ RLS: mọi policy sẽ ngừng tác dụng trong
  im lặng, ứng dụng vẫn chạy y như thường, và không có gì báo cho ai biết.
- `app.current_user_id()` thay `auth.uid()`; `public.users` thay `auth.users`.

### Đổi schema

1. Sửa **đúng file** trong `db/schema/` — tách theo *một mối quan tâm một file*, không phải một
   file khổng lồ theo ngày. Mọi file viết để chạy lặp được.
2. `PGADMIN_URL=postgres://postgres:...@127.0.0.1:5432/chronoshelf npm run db:migrate`
3. `npm run db:check` (hàng rào nhìn từ ứng dụng) **và** `npm run db:mutation` (chứng minh
   `90-verify.sql` biết kêu).

Logic đặc quyền vẫn đi qua hàm Postgres `SECURITY DEFINER` — `complete_book`, `is_admin`,
`app.dang_ky`, `app.bat_dau_dang_nhap`, `app.ket_thuc_dang_nhap`, `app.cau_hoi_khoi_phuc`,
`app.bat_dau_khoi_phuc`, `app.ket_thuc_khoi_phuc`. Nguồn danh tính là `SET LOCAL app.user_id`,
do middleware đặt sau khi xác thực ở tầng Node.

### Đăng nhập

**Email + mật khẩu, khôi phục bằng câu hỏi bảo mật. KHÔNG có email nào được gửi đi** — dự án
không có nhà cung cấp mail và sẽ không gắn. Luồng OTP cũ đã bị gỡ HẲN (bảng `login_codes` và hai
hàm của nó bị DROP ở `db/schema/15-mat-khau.sql`, và `90-verify.sql` khối A nổ nếu chúng quay lại).

Băm bằng `crypto.scrypt` của stdlib — **không phải pgcrypto, không phải bcrypt**. Tham số
N=32768, r=8, p=1 chọn từ số đo thật trên máy này (~59 ms, ~32 MB mỗi lượt); bcrypt bị loại vì nó
cắt cụt mật khẩu ở 72 byte trong im lặng, mà tiếng Việt có dấu thì 72 byte chỉ là 24 ký tự. Tham số
lưu THEO TỪNG DÒNG nên nâng N sau này không làm hỏng mật khẩu cũ. Xem `lib/auth/mat-khau.ts`.

**Bản băm không bao giờ rời khỏi database.** Node xin `*_params` (thuật toán + salt), tự băm, gửi
bản băm xuống để SQL so. Hai lượt gọi đó là HAI transaction riêng — gói chung là giữ một connection
mở suốt 59 ms băm mà chẳng làm gì, và tách ra không mất an toàn vì bộ đếm nằm ở lượt thứ hai.

Ba hàng rào, tất cả ở tầng database nên không route nào lách được:
- 5 lần sai mật khẩu → khóa 15 phút. 5 lần sai đáp án → khóa riêng 15 phút.
- Email KHÔNG tồn tại vẫn nhận được tham số băm và vẫn nhận được một câu hỏi bảo mật (chọn theo
  chính email đó, ổn định qua các lần hỏi). Không có hai nhánh này thì trang đăng nhập và trang
  quên-mật-khẩu thành máy dò danh sách người dùng.
- Đáp án chỉ lưu dạng băm, và được chuẩn hóa (bỏ dấu, hạ chữ thường, gộp khoảng trắng) trước khi
  băm — "Hà Nội" và "ha noi" phải khớp, nếu không thì câu hỏi bảo mật khóa luôn chính chủ ra ngoài.

**Câu hỏi bảo mật là hàng rào YẾU và ta biết.** NIST SP 800-63B khuyến nghị bỏ hẳn xác thực dựa
trên kiến thức. Nó ở đây vì người dùng đã chọn, sau khi được nói rõ điều đó; thứ giữ cho nó không
thành cửa mở toang là giới hạn số lần thử ở trên.

Danh sách câu hỏi CỐ ĐỊNH, tồn tại ở hai nơi — `lib/auth/cau-hoi-bao-mat.ts` và ràng buộc
`users_security_question_ck`. Có test đọc thẳng file SQL để bắt lệch; đừng sửa một nơi rồi thôi.

Phiên là cookie `httpOnly` chứa payload JSON ký HMAC-SHA256 (`lib/auth/token.ts`). **Cố ý không
phải JWT**: định dạng này không có trường `alg`, nên không có gì để kẻ tấn công thương lượng.

## Bẫy đã gặp

- **`sequelize` KHÔNG nằm trong danh sách Next tự loại khỏi bundle, `pg` thì có.** Sequelize
  nạp dialect bằng `require()` động nên bundler không lần ra. Thiếu
  `serverExternalPackages: ["sequelize"]` trong `next.config.ts` là hỏng lúc chạy, không phải
  lúc build.
- **Thư mục có tiền tố `_` trong `app/` là private folder — Next bỏ qua hoàn toàn.** Đã mất một
  lượt vì đặt route thử ở `app/api/_probe/`: `next build` vẫn xanh, route không hề tồn tại, và
  phép thử rỗng nghĩa mà trông y như đạt. Nhìn bảng Route sau khi build để biết route có thật.
- **`next start`/`next dev` không chết theo `TaskStop`.** Tiến trình cũ còn giữ cổng, nên lần
  chạy sau nhận `EADDRINUSE` và mọi request bắn vào **server cũ với bản build cũ** — triệu chứng
  là "route mới trả 404" trong khi nó có trong bảng Route. Kiểm bằng
  `Get-NetTCPConnection -LocalPort <cổng>` rồi `Stop-Process`.
- **`Model.upsert()` của Sequelize ghi LẠI MỌI CỘT.** `chronoshelf_auth` chỉ có
  `GRANT UPDATE (current_page)` trên `user_book_progress`, nên upsert sẽ đâm vào quyền cột. Dùng
  `INSERT … ON CONFLICT DO UPDATE SET current_page` viết tay (`app/api/me/progress/route.ts`).
- **`has_function_privilege('role', 'schema.fn()', …)` phải phân giải tên, việc đó đòi USAGE
  trên schema.** Hỏi về một role không có USAGE thì chính phép kiểm nổ thay vì trả lời. Tra OID
  trong `pg_proc` khi cần hỏi về `chronoshelf_app`.
- **`Promise.all` trên hai truy vấn cùng một transaction Sequelize sẽ hỏng** — chúng chồng lên
  nhau trên một connection. Trong `withRole` thì chạy tuần tự.
- **Không bao giờ gọi `sequelize.sync()`.** Nó không biết gì về RLS, policy, ràng buộc
  DEFERRABLE hay hàm SECURITY DEFINER — bảng nó tạo ra là bảng không có hàng rào nào.
- **Trong file có `"use server"`, MỌI export đều là một endpoint POST công khai** — kể cả hàm
  chỉ đọc. Vì vậy `lib/admin/shelves.ts` (đọc) tách khỏi `lib/admin/actions.ts` (ghi), và mọi
  action bắt đầu bằng `requireAdmin()`. Tài liệu Next: *"the route is reachable to anyone who
  can send the same POST. Treat every action as an untrusted entry point."*
- **Không truyền được function làm `children` từ Server Component xuống Client Component.**
  React báo `Functions are not valid as a child of Client Components`. Trạng thái `pending` của
  form lấy bằng `useFormStatus` trong một nút con, không phải bằng render prop.
- **Vào dev server bằng `127.0.0.1` thay vì `localhost` làm React không hydrate xong.** Next 16
  chặn tài nguyên dev cross-origin, WebSocket HMR hỏng, và form submit kiểu native — triệu chứng
  nhìn y như một bug của app (URL mất sạch query param). Dùng `localhost`, hoặc thêm
  `allowedDevOrigins` vào `next.config.ts`.
- **`designmd export` ĐÁNH RƠI `lineHeight`.** Nó xuất `fontWeight` và `letterSpacing` vào tuple
  `fontSize` nhưng không xuất `lineHeight`, nên mọi chữ chạy 1.5 mặc định của Tailwind thay vì
  1.15–1.75 như DESIGN.md. Không cổng nào bắt được: `design:lint` chỉ đọc DESIGN.md (nơi giá trị
  vẫn đúng). `scripts/design-line-height.mjs` vá lại và tự nó là một cổng — thiếu lineHeight cho
  bất kỳ token nào thì nó thoát mã 1.
- **Phân loại lỗi Postgres bằng SQLSTATE, đừng bằng văn xuôi.** Đã vấp: `/violates foreign key/`
  không khớp `violates RESTRICT setting of foreign key constraint` (có chữ chen vào giữa), và
  sqlstate là `23001` chứ không phải `23503`. Văn xuôi đổi theo phiên bản và theo `lc_messages`;
  sqlstate thì không. Sequelize bọc lỗi gốc vào `.parent` nên `e.code` ở tầng ngoài luôn
  `undefined` — xem `pgInfo()` ở `lib/admin/actions.ts`.
- **Đoạn tĩnh thắng đoạn động trong App Router.** `/quan-tri/vat-pham` che `/quan-tri/[shelf]`,
  nên một kệ đặt tên "Vật phẩm" (slug `vat-pham`) sẽ mất màn quản trị. `createShelf` coi slug đó
  như đã dùng. **Thêm route TĨNH nào ở gốc URL thì phải thêm slug đó vào `RESERVED_SLUGS`
  (`lib/admin/actions.ts`) trong cùng lượt.** Đã quên hai lần: `cong-dong` và `media` lọt ra
  ngoài danh sách cho tới 2026-09-04 — một kệ đặt tên "Cộng đồng" sẽ vào `/cong-dong` ra bảng
  tin, và màn quản trị của kệ đó biến mất.
- **Kho địa chỉ hóa theo nội dung phải trả về TÊN ĐÃ LƯU, không vọng lại tên vừa gửi.** Cùng
  byte = cùng dòng, nên `ON CONFLICT DO NOTHING` giữ tên của lần tải đầu; trả tên mới về cho
  form là để người dùng thấy một tên rồi tải về ra tên khác. Đã đo thật trong trình duyệt trên
  `/api/quan-tri/tai-lieu`. Sửa bằng một câu `SELECT` đọc lại sau khi ghi.
- **Tên tệp đi vào `Content-Disposition` phải có bản chỉ-ASCII.** Giá trị header đi qua undici,
  và một ký tự ngoài Latin-1 làm chính `new Response()` NÉM — route chết, không phải tải về sai
  tên. Tên bài giảng tiếng Việt gần như chắc chắn có dấu. Dùng `filename=` bản ASCII đã lọc +
  `filename*=UTF-8''…` bản đủ dấu.
- **Hai nhánh của một điều kiện mà cùng mở đầu bằng `<input>` thì React TÁI DÙNG phần tử đó.**
  Ô file (uncontrolled) biến thành ô hidden (controlled) và console cảnh báo đúng thế. Xảy ra ở
  `SlideField`; `ImageField` thoát vì nhánh sau của nó mở đầu bằng `<div>`. Cho hai nhánh hai
  `key` khác nhau để React tháo ra dựng lại.
- **Ghi file vào `public/` LÚC CHẠY không phục vụ được.** `next start` trả 404, `next dev` trả
  200 — bẫy "chạy tốt trên máy tôi" chỉ nổ ở production. File commit sẵn thì vẫn bình thường. Đó
  là lý do ảnh nằm trong bảng `media` (bytea) chứ không nằm trên đĩa.
- **`sequelize.query()` không truyền `type` trả `[rows, pg.Result]` — phần tử thứ hai là OBJECT,
  không phải số dòng.** Mười phép `affected === 0` trong `lib/admin/actions.ts` vì thế là mã chết
  suốt một thời gian dài: ép kiểu `as [unknown, number]` che mất điều đó lúc biên dịch, nên khi RLS
  chặn một UPDATE thì giao diện vẫn báo "Đã lưu." Dùng `rowsAffected()` ở `lib/db/rows-affected.ts`,
  và `db:check` có một phép chạy UPDATE trúng 0 dòng để bắt khi Sequelize đổi hình dạng trả về.
- **`RAISE EXCEPTION` trong hàm SECURITY DEFINER hủy CẢ transaction của request — kể cả câu UPDATE
  ngay phía trên nó.** Giới hạn 5 lần thử mã OTP từng hoàn toàn vô hiệu vì đúng chuyện này:
  `UPDATE login_codes SET attempts = attempts + 1` bị roll back cùng exception, nên bộ đếm vĩnh viễn
  bằng 0 và nhánh `attempts + 1 > 5` không bao giờ với tới — tức là chiếm tài khoản từ xa chỉ bằng
  cách thử hết 10^6 mã. Hàm nào cần GHI LẠI dấu vết của một lần gọi thất bại thì phải `RETURN NULL`
  rồi để tầng Node ném lỗi SAU khi transaction đã commit. Luồng OTP đó nay đã bị gỡ, nhưng LUẬT thì
  còn nguyên và đang áp cho `app.ket_thuc_dang_nhap` / `app.ket_thuc_khoi_phuc` — xem
  `lib/auth/dang-nhap.ts`, chỗ `throw` bắt buộc nằm NGOÀI `withRole()`.
- **Phép kiểm khóa ngoại của Postgres BỎ QUA row-level security** (tài liệu PG, mục Row Security
  Policies). Một INSERT tham chiếu tới dòng mà RLS đang giấu vẫn thành công, nên route nào phân biệt
  "khóa ngoại hỏng" với "ok" thì thành máy dò slug sách nháp. Cho câu lệnh tự đi qua RLS
  (`INSERT … SELECT … FROM public.books WHERE slug = $2`) thay vì để khóa ngoại trả lời.
- **`crypto.timingSafeEqual` so BYTE, còn `String.length` đếm KÝ TỰ.** Chốt chặn độ dài viết theo ký
  tự để lọt một chữ ký 43 ký tự nhưng 44 byte, và hàm ném `RangeError` thay vì trả `null`.
  `getSessionUserId()` được gọi ở `/`, `/[shelf]`, `/dang-nhap`, `/quan-tri`, nên đó là 500 toàn site
  gây ra bởi một cookie méo. Dựng `Buffer` trước rồi so `.length` của buffer.
- **`empty:hidden` trên một vùng `aria-live` giết chính vùng đó.** `display: none` gỡ phần tử khỏi
  cây trợ năng, nên khi Server Action trả kết quả thì nội dung VÀ việc hiện lại xảy ra trong cùng một
  lần cập nhật DOM — trình đọc màn hình coi đó là vùng live vừa được THÊM chứ không phải một thay
  đổi, và thường không đọc. Vùng live phải có mặt sẵn: rỗng nhưng vẫn hiện.
- **`design:lint` KHÔNG tự chặn lỗi tương phản.** Rule `contrast-ratio` có severity `warning`, mà CLI
  đặt `exitCode = errors > 0` — cảnh báo in ra rồi thoát 0. Đó là lý do ô nhập quản trị chạy ở 1.00:1
  cho tới lúc có người mở trình duyệt ra đo. Nay `design:lint` đi qua `scripts/design-lint-gate.mjs`,
  thoát 1 khi có BẤT KỲ error hoặc warning nào; và `design:verify` (trong `check`) chặn `DESIGN.md`
  trôi lệch khỏi `tailwind.theme.json`.
- **Agent nền chết vì hết hạn mức thì trả `null`, và script nào gộp `null` với "đã bị bác bỏ" sẽ báo
  cáo NGƯỢC sự thật.** Một đợt review đối kháng từng mất 101/120 agent phản biện đúng kiểu đó:
  workflow vẫn kết thúc `status: completed`, tổng kết ghi "33 phát hiện bị bác" trong khi 32 cái chưa
  từng được ai xem — và cả 25 cái sau đó được xác nhận là lỗi thật. Luôn tách BA trạng thái —
  sống-sót, bị-bác, CHƯA-XỬ — rồi chạy lại nhóm cuối. Đừng để phiếu trắng đếm thành phiếu chống.

## Lệnh

```bash
npm run check          # CỔNG DUY NHẤT cho code — chạy trước khi nói "xong". ~13s
npm run db:check       # hàng rào nhìn từ ứng dụng, nối bằng đúng role ứng dụng. Sau mỗi lần đổi db/schema/
npm run db:mutation    # phá từng hàng rào rồi đòi 90-verify.sql phải kêu. Cần PGADMIN_URL
npm run db:migrate     # chạy db/schema/*.sql theo thứ tự. Cần PGADMIN_URL
npm run seed:content   # bootstrap db/seed/*.json -> bảng nội dung. Cần PGADMIN_URL
npm run dev            # dev server
npm run design:build   # sinh lại tailwind.theme.json từ DESIGN.md
```

Ba lệnh cần `PGADMIN_URL` (chuỗi kết nối superuser) vì chúng tạo role, đổi schema và sửa policy.
**Ứng dụng không bao giờ dùng nó** — `.env.local` chỉ có `DATABASE_URL` (role `chronoshelf_app`)
và `SESSION_SECRET`. Truyền theo từng lệnh, đừng cất trong file:

```bash
PGADMIN_URL=postgres://postgres:...@127.0.0.1:5432/chronoshelf npm run db:migrate
```

`npm run check` cần `.env.local` có mặt (xem `.env.example`) — KHÔNG chạy "ngoại tuyến hoàn
toàn" được. `next build` (bước cuối của `check`) nạp `lib/db/sequelize.ts`, file đó `throw`
ngay lúc nạp module nếu thiếu `DATABASE_URL`. Đã kiểm thực nghiệm 2026-08-28: giấu
`.env.local` đi thì `next build` thoát mã 1 ở bước "Collecting page data" với
`Failed to collect configuration for /api/auth/code`, dù mọi route đều `force-dynamic` — bước
đó vẫn phải nạp module để đọc `export const dynamic`, nên code chạy lúc nạp module vẫn chạy.

`DATABASE_URL` **không cần trỏ tới database đang sống** để build qua; chỉ cần CÓ MẶT — đã kiểm
2026-08-28 bằng cách trỏ nó vào `127.0.0.1:59999/khong-co-that`, `next build` vẫn thoát mã 0.
Không route nào gọi database lúc build vì tất cả đều `force-dynamic`. Nhưng `npm run db:check`,
`db:migrate`, `db:mutation` và `seed:content` thì cần database thật.

`npm run check` cũng chạy tự động ở **pre-commit**: `.githooks/pre-commit`, được nối vào bằng
`core.hooksPath` trong script `prepare` của npm (npm tự gọi `prepare` sau `npm install`, nên
máy mới clone là có hook luôn — không cần husky). Cần bỏ qua một lần thì `git commit --no-verify`.

`npm run check` chạy tuần tự, dừng ở lỗi đầu tiên, xếp theo thứ tự nhanh-hỏng-trước:
`design:lint` → `design:verify` → `test` → `lint` → `build`. Từng cái vẫn gọi riêng được
khi cần lặp nhanh. Đừng tự bịa ra một tổ hợp lệnh khác — nếu thiếu cổng nào thì thêm vào
`check`, để chỗ nào cũng chỉ có một câu trả lời cho câu hỏi "đã xong chưa".

Hai cái bẫy đã bị đóng lại, đừng mở ra:

- **`npx tsc --noEmit` một mình sẽ báo lỗi giả trên cây vừa clone.** `tsconfig.json` include
  `.next/types/**/*.ts`, mà `.next/` bị gitignore — kiểu `AppRoutes` (dùng bởi `PageProps<…>`)
  chưa tồn tại thì tsc thoát mã 2. Dùng `npm run typecheck`, nó chạy `next typegen` trước.
  `npm run build` cũng tự lo phần này.
- **File test import nhau bằng đuôi `.ts` thật.** `node --test` chạy TypeScript trực tiếp và
  bộ resolve của Node cần đuôi; vì vậy `tsconfig.json` bật `allowImportingTsExtensions`.

## Test — cố tình rất ít

`node --test` của Node 24, **không có framework nào**. Test nằm cạnh mã nguồn ở
`lib/**/*.test.ts`.

Bề mặt test JS chỉ gồm module **thuần, import tương đối**: alias `@/` không resolve được dưới
test runner của Node (đã thử — `ERR_MODULE_NOT_FOUND`), nên bất cứ thứ gì chạm vào `@/` là
không test kiểu này được. Đó là lý do `resolveState` nằm riêng ở `lib/api/unlock.ts` chứ
không ở trong `shelf.ts`, và `safeNext` nằm riêng ở `lib/safe-next.ts`.

Đừng cài Vitest/Jest chỉ để lách chuyện alias. Phần còn lại của repo đã có cổng riêng và
những cổng đó bắt lỗi tốt hơn một bộ test JSX:

| Rủi ro | Ai bắt |
|---|---|
| Chuỗi mở khóa đứt gãy | Không xảy ra được — không có cột nào lưu nó |
| Người dùng thường sửa được nội dung | `npm run db:check` — ghi thử cả 4 bảng `shelves`/`items`/`books`/`pages` |
| Người dùng tự phong admin | `npm run db:check` — thử lúc chưa đăng nhập lẫn khi đã đăng nhập |
| Token màu/chữ sai, tương phản dưới AA | `design:lint` |
| Sai kiểu, route không tồn tại | `build` (typegen + tsc) |
| **RLS và quyền của `complete_book`** | **`npm run db:check`** |

Hàng cuối là rủi ro lớn nhất của dự án, và nó được canh bằng **ba** cổng khác nhau chứ
không phải một:

| Cổng | Chạy bằng quyền | Trả lời câu hỏi |
|---|---|---|
| `db/schema/90-verify.sql` (trong `db:migrate`) | superuser | Catalog có đúng như thiết kế không? (`has_table_privilege`, biểu thức policy, `condeferred`) |
| `npm run db:check` | `chronoshelf_app`, đúng role Route Handler dùng | Một request THẬT làm được những gì? |
| `npm run db:mutation` | superuser | `90-verify.sql` có thật sự biết kêu không? |

Cần cả ba vì mỗi cái mù ở chỗ cái kia nhìn thấy. SQL chạy bằng quyền admin kiểm được
`has_function_privilege` nhưng không kiểm được thứ quan trọng hơn — cái mà một request thật
làm được. Ngược lại, `db:check` không thấy được `condeferred` hay biểu thức policy.

`scripts/db-check.mjs` liệt kê số phép ở cuối output — đọc output, đừng nhớ con số. Script tự
tạo tài khoản test qua chính luồng đăng ký thật (và nạp đúng `lib/auth/mat-khau.ts` chứ không chép
lại tham số scrypt sang đây), nên **không cần biến môi trường nào ngoài `DATABASE_URL`**. Một bản trước đây đòi tài khoản test qua biến môi trường và âm thầm BỎ QUA
6 phép khi thiếu — "bỏ qua" thì không phải "đạt", đừng làm lại kiểu đó.

### Ba bài học phải giữ

**1. Liệt kê trạng thái "còn nguyên", đừng liệt kê trạng thái "đã hỏng."** Danh sách lỗi-được-
coi-là-đã-lộ không bao giờ đủ. Phép gọi `complete_book` khi chưa đăng nhập chỉ đạt khi nhận
ĐÚNG sqlstate `42501` VÀ message bắt đầu bằng `permission denied for function`; mọi thứ khác
là rò rỉ. Một bản trước từng dùng slug bịa và coi "có lỗi là đạt" — nếu EXECUTE lỡ bị cấp, hàm
vẫn dừng ở "Book not found" và phép kiểm báo PASS đúng lúc lỗ nghiêm trọng nhất mở toang. Sửa
bằng slug thật vẫn chưa đủ: lần thử tiếp theo lộ ra một lỗi THỨ BA (vi phạm khóa ngoại) không
ai lường trước. Vì vậy phải neo vào cái đúng, không phải liệt kê cái sai.

**2. `42501` nói HAI chuyện khác nhau — phải soi message.** `permission denied for table` là
thiếu GRANT; `new row violates row-level security policy` là policy chặn. Với bốn bảng nội
dung, phép kiểm đòi ĐÚNG loại thứ hai: thiếu GRANT thì admin thật cũng ghi hỏng và phép kiểm
không chứng minh được gì.

**3. Nhưng `user_items` thì ngược lại — và đó là chủ ý.** Ở đó hàng rào là chính GRANT: KHÔNG
role nào ghi được, cửa duy nhất là `complete_book` chạy SECURITY DEFINER. Nên thông điệp đúng
ở đó là `permission denied for table user_items`, và nếu một ngày nó đổi thành "violates
row-level security policy" thì nghĩa là ai đó vừa CẤP THÊM GRANT INSERT — đúng thứ phải nổ.
Bài học: mỗi hàng rào phải khẳng định theo đúng cơ chế của CHÍNH NÓ, đừng áp một khuôn chung.
(Đã vấp thật ngày 2026-08-28: dùng khuôn "phải bị policy chặn" cho `user_items` và phép kiểm
báo hỏng — nhưng schema đúng, khuôn mới sai.)

## Agent harness — cái gì nằm ở đâu

| Đường dẫn | Vai trò |
|---|---|
| `CLAUDE.md` (file này) | Toàn bộ kiến thức dự án. |
| `db/schema/README.md` | Thứ tự chạy schema, ba role và lý do. Đọc trước khi đụng SQL. |
| `scripts/db-migrate.mjs` | Chạy `db/schema/NN-*.sql` theo thứ tự, mỗi file một transaction. |
| `scripts/db-mutation-check.mjs` | Phá từng hàng rào (mỗi cái trong một transaction rồi ROLLBACK) và đòi `90-verify.sql` phải kêu. |
| `.claude/settings.json` | Allowlist lệnh + deny rule `pen.dev/**` + đăng ký hook. |
| `.claude/hooks/guard-pen-dev.mjs` | `PreToolUse(Bash)`, chặn mọi lệnh shell chạm `pen.dev`. |
| `.githooks/pre-commit` | Chạy `npm run check` trước mỗi commit. Nối bằng `npm run prepare`. |
| `scripts/db-check.mjs` | Self-check ranh giới bảo mật tầng DB (`npm run db:check`). |
| `scripts/design-lint-gate.mjs` | Biến `designmd lint` thành cổng thật — cảnh báo tương phản cũng thoát 1. |
| `lib/db/rows-affected.ts` | Đọc số dòng UPDATE/DELETE chạm tới, chịu được cả hai hình dạng Sequelize trả về. |
| `docs/agents/` | Quy ước cho skill: `issue-tracker.md`, `domain.md`. |
| `.scratch/<feature>/` | Issue tracker (repo chưa có remote nên không dùng GitHub Issues). |
| `docs/superpowers/specs/` + `plans/` | Spec và kế hoạch dài theo cả subsystem. |
| `lib/**/*.test.ts` | Test `node --test`, xem mục Test ở trên. |

Sửa `.claude/settings.json` hay file hook thì **phải mở phiên mới** mới có hiệu lực — Claude
Code nạp chúng lúc khởi động phiên.

## Agent skills

### Issue tracker

Issue và ticket nằm dưới dạng markdown trong `.scratch/<feature>/` (repo chưa có git remote).
Spec dài theo subsystem vẫn ở `docs/superpowers/`. Xem `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` ở gốc repo — cả hai chưa tồn tại, tạm thời
`content.md`, `DESIGN.md` và file này giữ vai trò đó. Xem `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

