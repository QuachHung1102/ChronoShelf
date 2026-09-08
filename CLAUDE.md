# ChronoShelf — "Cửa Sổ Lịch Sử"

Nền tảng học lịch sử trực quan cho học sinh Việt Nam. Người dùng khám phá một thư viện cổ:
mỗi chuyên mục là một kệ sách, mỗi bài học là một quyển sách lật từng trang. Đọc xong một
quyển thì nhận được một vật phẩm, và chính vật phẩm đó mở khóa quyển tiếp theo trên kệ.

**Trả lời người dùng bằng tiếng Việt.**

> ⚠️ **Mọi kiến thức về dự án thuộc về file này.** `AGENTS.md` là một **con trỏ cố ý** trỏ về
> đây — đừng xóa nó, và đừng biến nó thành một bản chép. Codex đọc `AGENTS.md` chứ không đọc
> `CLAUDE.md`, và `next dev` tự dựng lại một stub khi CẢ HAI file cùng vắng mặt. Bản chép cũ
> (tài liệu SDK của một backend không còn dùng) đã bị xóa 2026-08-28; bản con trỏ hiện tại
> dựng ở `31efffb`.

## Nguồn sự thật — đọc trước khi làm

| File | Nội dung |
|---|---|
| `content.md` | Bản mô tả sản phẩm đầy đủ: sitemap, cơ chế, nội dung từng trang. Nguồn sự thật về *cái gì* cần xây. |
| `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md` | **Đọc khi mở phiên mới**: kiến trúc nội dung — nội dung nằm trong database, vai trò admin/user, đọc thẳng `books`/`pages`. Phần *sản phẩm* còn đúng; phần *hạ tầng* viết theo backend cũ, xem banner ở đầu file. |
| `DESIGN.md` | Hệ thiết kế (format `design.md` của Google Labs): toàn bộ color/typography/spacing token + lý do. Nguồn sự thật về *trông như thế nào*. |
| `db/schema/README.md` | Thứ tự chạy schema, ba role và lý do. **Đọc trước khi đụng SQL.** |
| `docs/superpowers/specs/` | Spec đã được duyệt, mỗi subsystem một file. Spec thì Ở LẠI kể cả khi việc đã xong — nó giữ *vì sao*, không phải *làm thế nào*. |
| `docs/superpowers/plans/2026-09-07-ban-giao-phien-sau.md` | **Đọc đầu tiên khi mở phiên mới**: đã làm gì, cổng đang ở đâu, việc kế tiếp là gì và thứ đang chặn nó. Ảnh chụp một thời điểm — xóa khi các mục "còn lại" xong hết. |
| `docs/agents/bay-da-gap.md` | 27 bẫy đã vấp thật, mỗi cái kèm phép đo. Bốn cái đắt nhất còn nằm trong file này. |
| `docs/nhat-ky/` | Nhật ký từng phiên làm việc — xem mục **Nhật ký phiên** ở cuối file. |
| `docs/superpowers/plans/` | Chỉ còn đúng bản bàn giao. Plan xong việc thì **XÓA** — nó là danh sách bước, không giữ quyết định nào; git history vẫn còn. Đã xóa: các plan backend cũ (2026-08-28), chặng C và bảng tin (2026-09-07). |
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
  **Phía Codex hàng rào này chỉ có hiệu lực SAU khi được duyệt tin cậy một lần** — xem dòng
  `.codex/hooks.json` ở bảng cuối file.
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
- **Đáp án bài trắc nghiệm không được rời khỏi database.** `book_questions.correct_index` KHÔNG
  có `GRANT SELECT` cho `chronoshelf_anon` lẫn `chronoshelf_auth` — hàng rào là **GRANT theo
  cột**, không phải policy, vì RLS lọc DÒNG và không biết gì về cột. Đừng cấp `SELECT` cả bảng
  cho tiện, và đừng khai `correctIndex` vào model `BookQuestion`: cả hai đều biến một `SELECT *`
  vô ý trong `readShelf()` thành một lần in đáp án ra HTML. Hai cửa đọc được đáp án là
  `complete_book` (chấm bài) và `admin_book_questions` (tự kiểm `is_admin()`), cả hai
  `SECURITY DEFINER`. **Đổi chữ ký `complete_book` thì phải `DROP FUNCTION` trước** —
  `CREATE OR REPLACE` với chữ ký mới chỉ NẠP CHỒNG, để lại bản cũ như một cửa thứ hai trao vật
  phẩm mà không chấm bài. **Và đừng hứa quá phạm vi**: đây là hàng rào SƯ PHẠM, không phải hàng
  rào bảo mật — sách vốn công khai, mỗi bài 2–3 câu, đáp án đoán được bằng cách thử. Chi tiết ở
  `docs/superpowers/specs/2026-09-07-bai-trac-nghiem-cuoi-sach-design.md`.
- **Bí mật không vào git.** `.env.local` giữ `DATABASE_URL` và `SESSION_SECRET`, `.env.pgadmin`
  giữ `PGADMIN_URL` (chuỗi kết nối superuser). Cả hai đã bị dòng `.env*` trong `.gitignore`
  chặn — đã xác nhận bằng `git check-ignore`. Đừng chép giá trị thật sang `.env.example` hay
  bất kỳ file được commit nào. Xem mục **Lệnh** để biết cách nạp `.env.pgadmin`: `npm run`
  KHÔNG nạp được nó.

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
`pages`, cộng bảng thứ năm `book_questions` cho bài trắc nghiệm cuối sách — bảng đó khác bốn
bảng kia ở đúng một chỗ, xem quy tắc về `correct_index` phía trên; bài giảng & slide nằm ở
`lessons` + `documents`. Sửa nội dung đang chạy bằng
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

Seed cũng tạo **ba dòng mồi nhử** mà `npm run db:check` phụ thuộc: quyển nháp vĩnh viễn
`__nhap-khong-bao-gio-xuat-ban`, **một câu hỏi trắc nghiệm thuộc quyển nháp đó**, và dòng vai
trò `admin` của tài khoản mồi nhử `22222222-2222-2222-2222-222222222222`. **Đừng "dọn" chúng.**
Thiếu mồi nhử thì các phép kiểm vẫn chạy, vẫn báo đạt, nhưng hết nghĩa — mọi sách thật đều đã
xuất bản nên phép đọc-sách-nháp luôn thấy 0 dòng, mọi câu hỏi thật cũng thuộc sách đã xuất bản
nên phép đọc-câu-hỏi-của-sách-nháp cũng vậy, và `user_roles` không còn dòng "của người khác"
nào nên phép đọc-trộm-vai-trò cũng luôn thấy 0 dòng, kể cả khi RLS hỏng hoàn toàn.

**Phần thưởng trọn bộ bị cắt ở tầng ĐỌC, không ở tầng hiển thị.** `shelves.reward_title` +
`reward_body` (content.md §4.5) chỉ rời khỏi `readTuiHanhTrang()` khi người xem đã có ĐỦ vật
phẩm của kệ; chưa đủ thì hàm trả `null` và trang không có gì để lỡ tay in ra. Nhưng đây là
hàng rào **sư phạm**, không phải bảo mật: `shelves` đọc công khai và RLS lọc DÒNG chứ không
lọc cột — đừng để bí mật thật vào hai cột đó. Bức tranh ghép (§4.4) dùng chung cơ chế:
`mosaic_url` cắt thành dải dọc theo `lib/tranh-ghep.ts`, mảnh thứ *k* ứng với vật phẩm thứ
*k* **theo thứ tự đọc** — xáo thứ tự đó là xáo luôn bức tranh.

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
lần. Đã cân nhắc MySQL và loại: repo có **hàng chục policy RLS** (MySQL không có RLS), **bốn**
ràng buộc `DEFERRABLE INITIALLY DEFERRED` mà RPC đổi thứ tự được thiết kế quanh nó (MySQL không
có), và cột `text[]` ở cả `pages.summary` lẫn `book_questions.choices`.

> Không viết số policy ra đây nữa: nó tăng theo mỗi subsystem, không cổng nào canh, và bản cũ
> đã lệch từ 14 lên 27 mà không ai thấy. Đếm khi cần:
> `SELECT count(*) FROM pg_policies WHERE schemaname='public'`.

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

Logic đặc quyền vẫn đi qua hàm Postgres `SECURITY DEFINER` — **11 hàm**, liệt kê được bằng
`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','app') AND p.prosecdef`: `complete_book`, `_complete_book_for`,
`is_admin`, `admin_book_questions`, `record_activity`, và sáu hàm đăng nhập/khôi phục
`app.dang_ky`, `app.bat_dau_dang_nhap`, `app.ket_thuc_dang_nhap`, `app.cau_hoi_khoi_phuc`,
`app.bat_dau_khoi_phuc`, `app.ket_thuc_khoi_phuc`. Nguồn danh tính là `SET LOCAL app.user_id`,
do middleware đặt sau khi xác thực ở tầng Node.

Đối chứng phải giữ: **`reorder_books` / `reorder_pages` / `reorder_shelves` CỐ Ý là SECURITY
INVOKER** — chạy bằng quyền người gọi thì policy `admin write` mới áp được lên UPDATE bên
trong. `90-verify.sql` khối C nổ nếu ai đó "sửa" chúng thành DEFINER.

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

**Danh sách đầy đủ 27 bẫy ở `docs/agents/bay-da-gap.md`.** Nó là nhật ký chỉ-thêm và sẽ còn
dài ra; để nguyên ở đây thì nó chiếm gần một phần tư file mà mọi phiên đều phải đọc trọn.

Bốn cái dưới đây ở lại vì chúng đắt nhất — mỗi cái từng làm một hàng rào bảo mật hoặc một
cổng kiểm tra trở nên VÔ NGHĨA trong khi mọi thứ vẫn báo xanh:

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

- **`array_length({}::text[], 1)` trả NULL, và CHECK chỉ TỪ CHỐI khi biểu thức ra FALSE.**
  NULL thì cho qua, nên `CHECK (array_length(a,1) BETWEEN 2 AND 4)` nhận thẳng một mảng rỗng —
  đúng thứ nó tuyên bố là chặn. Đo thật 2026-09-07 trên `book_questions`. Mọi CHECK trên
  `text[]` phải bọc `coalesce(array_length(a, 1), 0)`.

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
và `SESSION_SECRET`.

Chuỗi superuser nằm ở **`.env.pgadmin`** (đã gitignore). **`npm run db:migrate` KHÔNG nạp được
file đó** — script `npm run` chỉ nạp `.env.local` — nên ba lệnh này phải **gọi thẳng script**:

```bash
node --env-file-if-exists=.env.local --env-file=.env.pgadmin scripts/db-migrate.mjs
node --env-file-if-exists=.env.local --env-file=.env.pgadmin scripts/db-mutation-check.mjs
node --env-file=.env.pgadmin scripts/seed-content.mjs
```

Xác thực của PostgreSQL 18 trên máy này là `scram-sha-256` cho cả `local` lẫn `127.0.0.1` —
không có `trust`, không có `.pgpass` — nên không có đường nào chạy ba lệnh đó mà không có mật
khẩu. `npm run db:check` thì dùng `npm run` được, vì nó chỉ cần `DATABASE_URL`.

`npm run check` cần `.env.local` có mặt (xem `.env.example`) — KHÔNG chạy "ngoại tuyến hoàn
toàn" được. `next build` (bước cuối của `check`) nạp `lib/db/sequelize.ts`, file đó `throw`
ngay lúc nạp module nếu thiếu `DATABASE_URL`. Đã kiểm thực nghiệm 2026-08-28: giấu
`.env.local` đi thì `next build` thoát mã 1 ở bước "Collecting page data" với
`Failed to collect configuration for /api/auth/code`, dù mọi route đều `force-dynamic` — bước
đó vẫn phải nạp module để đọc `export const dynamic`, nên code chạy lúc nạp module vẫn chạy.

`DATABASE_URL` **không cần trỏ tới database đang sống** để build qua; chỉ cần CÓ MẶT — đã kiểm
2026-08-28 bằng cách trỏ nó vào `127.0.0.1:59999/khong-co-that`, `next build` vẫn thoát mã 0.
Không route nào gọi database lúc build: 22 file khai `force-dynamic` tường minh, còn
`/[shelf]` (segment động, không `generateStaticParams`) và `/dang-nhap` (đọc `searchParams`)
dynamic theo mặc định của App Router. Nhưng `npm run db:check`,
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
| Đáp án trắc nghiệm lọt xuống trình duyệt | `npm run db:check` (đọc thử `correct_index` và `SELECT *`) + `90-verify.sql` mục B2 |
| Trao vật phẩm mà không chấm bài | `npm run db:check` — gọi `complete_book` thật với đáp án sai rồi đếm `user_items` |
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
| `scripts/design-line-height.mjs` | Vá `lineHeight` mà `designmd export` đánh rơi. **Tự nó là một cổng**: thiếu lineHeight cho bất kỳ token nào thì thoát 1. |
| `scripts/seed-content.mjs` | Bootstrap MỘT CHIỀU `db/seed/*.json` → bảng nội dung. Cũng tạo ba dòng mồi nhử mà `db:check` phụ thuộc. |
| `scripts/build-world-map.mjs` | Sinh `public/world-countries.json` từ world-atlas cho bản đồ chọn quốc gia. Chạy **một lần**, KHÔNG nằm trong `check`, và cần `npm i --no-save d3-geo topojson-client`. |
| `lib/db/rows-affected.ts` | Đọc số dòng UPDATE/DELETE chạm tới, chịu được cả hai hình dạng Sequelize trả về. |
| `docs/agents/` | `bay-da-gap.md` (27 bẫy), `issue-tracker.md`, `domain.md`. |
| `.scratch/<feature>/` | Issue tracker (repo chưa có remote nên không dùng GitHub Issues). |
| `docs/superpowers/specs/` + `plans/` | Spec và kế hoạch dài theo cả subsystem. |
| `lib/**/*.test.ts` | Test `node --test`, xem mục Test ở trên. |
| `.codex/hooks.json` | Cấu hình hook cho Codex. Dùng CHUNG `.claude/hooks/guard-pen-dev.mjs` — đừng chép file hook sang đây, bản chép sẽ trôi lệch. **Hook của repo mặc định KHÔNG chạy**: Codex có nạp file (nó cảnh báo nếu bạn khai hook ở cả đây lẫn `.codex/config.toml`) nhưng để trạng thái *chưa tin cậy* cho tới khi được duyệt một lần trong TUI (`codex` rồi chấp nhận màn "startup hooks review"). `codex exec` bỏ qua hook chưa duyệt trong im lặng — `--dangerously-bypass-hook-trust` cho chạy đúng một lượt để thử. Duyệt xong sẽ có dòng `[hooks.state."…hooks.json:pre_tool_use:0:0"]` trong `~/.codex/config.toml`. Giao thức thì khớp: Codex gọi shell tool của nó là `tool_name = "Bash"`, gửi `tool_input.command`, và tôn trọng exit 2 + stderr. Đo 2026-09-08. |
| `.agents/skills/` + `skills-lock.json` | Skill của bên thứ ba do trình cài skill quản lý. **KHÔNG phải nguồn của dự án và KHÔNG ghi đè `DESIGN.md`** — vài skill trong đó ra luật thiết kế ngược hẳn (cấm Lucide, đổi font, luật mobile). Khi mâu thuẫn, `DESIGN.md` và file này thắng. |

Sửa `.claude/settings.json` hay file hook thì **phải mở phiên mới** mới có hiệu lực — Claude
Code nạp chúng lúc khởi động phiên.

## Agent skills

### Issue tracker

Issue và ticket nằm dưới dạng markdown trong `.scratch/<feature>/` (repo chưa có git remote).
Spec dài theo subsystem vẫn ở `docs/superpowers/`. Xem `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` ở gốc repo — cả hai chưa tồn tại, tạm thời
`content.md`, `DESIGN.md` và file này giữ vai trò đó. Xem `docs/agents/domain.md`.

## Nhật ký phiên

`docs/nhat-ky/YYYY-MM-DD.html` — mỗi phiên làm việc đáng kể một file, kể lại phiên đó đã
làm gì và vì sao. **Nhật ký của dự án nào thì nằm trong dự án đó**, không nằm ở thư mục tạm
của máy: file trong repo là NGUỒN, và nó được xuất bản thành một trang đọc được. Sửa file rồi
xuất bản lại vào ĐÚNG URL cũ (truyền `url`) thì link không đổi; xuất bản từ đường dẫn khác sẽ
đẻ ra một artifact thứ hai.

Ba luật giữ cho thư mục này khỏi thành nơi trùng lặp:

1. **Nhật ký nhìn LẠI, không nhìn tới.** Trạng thái hiện tại và việc kế tiếp thuộc về bản bàn
   giao trong `docs/superpowers/plans/`. Nhật ký kể một phiên đã xảy ra và **không bao giờ cần
   sửa lại** — nếu bạn thấy mình đang sửa một file trong đây, thứ bạn định viết thuộc chỗ khác.
2. **Không chép kiến thức lâu dài vào đây.** Bẫy → `docs/agents/bay-da-gap.md`; thiết kế
   subsystem → `docs/superpowers/specs/`; quy tắc → chính file này. Nhật ký chỉ trỏ tới chúng.
3. **`docs/nhat-ky/**` NẰM NGOÀI phạm vi `DESIGN.md`.** Đó là trang HTML độc lập, không đi qua
   Tailwind và không dùng `tailwind.theme.json` — nó chỉ *mượn* palette và cặp chữ của dự án cho
   nhất quán. Hook thiết kế sẽ kêu về font/cỡ chữ ngoài thang; đó là lệch phạm vi, không phải
   lỗi. Đừng sửa trang cho vừa thang chữ của sản phẩm, và đừng nới `DESIGN.md` vì nó.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

