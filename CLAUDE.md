# ChronoShelf — "Cửa Sổ Lịch Sử"

Nền tảng học lịch sử trực quan cho học sinh Việt Nam. Người dùng khám phá một thư viện cổ:
mỗi chuyên mục là một kệ sách, mỗi bài học là một quyển sách lật từng trang. Đọc xong một
quyển thì nhận được một vật phẩm, và chính vật phẩm đó mở khóa quyển tiếp theo trên kệ.

**Trả lời người dùng bằng tiếng Việt.**

> ⚠️ **Đừng viết hướng dẫn dự án vào `AGENTS.md`.** File đó do installer InsForge sở hữu và
> bị ghi đè toàn bộ mỗi lần chạy lại `npx @insforge/install`. Mọi kiến thức về dự án thuộc về
> file này. `AGENTS.md` được import ở cuối để giữ phần tham chiếu SDK của InsForge.

## Nguồn sự thật — đọc trước khi làm

| File | Nội dung |
|---|---|
| `content.md` | Bản mô tả sản phẩm đầy đủ: sitemap, cơ chế, nội dung từng trang. Nguồn sự thật về *cái gì* cần xây. |
| `docs/superpowers/plans/2026-08-12-ban-giao-phase-tiep-theo.md` | **Đọc khi mở phiên mới**: đã xong tới đâu, còn gì, và các bẫy đã gặp. |
| `DESIGN.md` | Hệ thiết kế (format `design.md` của Google Labs): toàn bộ color/typography/spacing token + lý do. Nguồn sự thật về *trông như thế nào*. |
| `docs/superpowers/specs/` | Spec đã được duyệt, mỗi subsystem một file. |
| `docs/superpowers/plans/` | Kế hoạch triển khai từng bước, mỗi subsystem một file. |
| `pen.dev/design.pen` | File thiết kế Pencil — mockup UI đã duyệt. |
| `db/schema/` | SQL schema, nguồn sự thật cho cấu trúc DB (backend không tự version). |

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
- **Tailwind CSS 3.4, không nâng lên v4.** InsForge yêu cầu; version đã pin cứng trong
  `package.json`.
- **Logic mở khóa phải nằm ở phía server.** Client chỉ báo "đã đọc xong quyển X"; việc trao vật
  phẩm và mở khóa quyển kế tiếp do RPC `complete_book` (`SECURITY DEFINER`) quyết định. Không bao
  giờ chuyển logic này xuống client, và không cấp quyền INSERT/UPDATE trực tiếp lên `user_items`
  hay cột `user_book_progress.completed` cho role `authenticated`.
- **Bí mật không vào git.** API key InsForge nằm trong `.mcp.json` và `.env.local`, cả hai đã
  được `.gitignore`. Đừng chép key sang file được commit.

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
`pages`. **Admin sửa qua `/quan-tri`, không sửa bằng cách đụng vào file.** Đây là thay đổi
so với mô hình JSON cũ: admin phải tạo được sách lúc chạy mà không cần build lại. Lý do đầy
đủ ở `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md` §2.1.

`db/seed/*.json` là **bootstrap một chiều**, chạy bằng `npm run seed:content` rồi đưa SQL qua
MCP `run-raw-sql`. Sửa file đó KHÔNG làm đổi nội dung đang chạy.

**Không có cột "vật phẩm cần để mở".** Quyển `i` mở bằng vật phẩm thưởng của quyển `i-1`,
suy ra từ vị trí chứ không lưu — nên chuỗi mở khóa không thể đứt. Đánh đổi và đường nâng cấp
ghi ở `lib/insforge/unlock.ts`.

Vai trò nằm ở `public.user_roles`: không có dòng nghĩa là `user`, chỉ admin mới có dòng.
`authenticated` không có GRANT ghi nào lên bảng đó, nên không ai tự phong admin được. Cấp
admin bằng SQL qua MCP.

## Backend — InsForge

Base URL: `https://pk3kdyx2.ap-southeast.insforge.app`

- **Code ứng dụng dùng SDK** (`@insforge/sdk`): auth, CRUD, `rpc()`, storage, functions.
- **Hạ tầng dùng MCP tool**: `run-raw-sql` (schema), `get-table-schema`, `create-bucket`,
  `bulk-upsert` (seed), `create-function`. Không gọi MCP từ code ứng dụng.
- **Trước khi viết code InsForge, gọi `fetch-docs`** — API đổi thường xuyên, đừng viết theo trí nhớ.

### Đổi schema

1. Viết SQL vào `db/schema/<ngày>-<mô-tả>.sql` — file này là nguồn sự thật, có version trong git.
2. Chạy qua MCP `run-raw-sql`.
3. Xác minh bằng một block `DO $$ ... RAISE EXCEPTION ... $$;` tự kiểm tra chạy thẳng trên DB.
   RLS và logic mở khóa phải được test ở tầng DB, không tin vào việc "UI nhìn thấy đúng".

`auth.uid()` có sẵn trong Postgres và trả về user của JWT gọi request; RLS và `complete_book` đều
dựa vào nó. Backend chỉ có role `anon` và `authenticated` — **không có `service_role`**, nên logic
đặc quyền đi qua hàm Postgres `SECURITY DEFINER` chứ không phải edge function cầm service key.

## Bẫy đã gặp

- **MCP `run-raw-sql` từ chối `BEGIN;`/`COMMIT;` tường minh — và không cần chúng.** Proxy
  đã tự bọc mỗi batch trong một transaction. Đã kiểm: batch gồm `CREATE TABLE` rồi một
  `INSERT` trùng khóa làm cả batch roll back, bảng vừa tạo cũng biến mất. Script sinh SQL
  đừng phát hai lệnh đó, nếu không output không dán thẳng vào MCP được.
- **`run-raw-sql` thỉnh thoảng trả `Changing SQL session configuration is not allowed`
  với batch lớn — và nó KHÔNG tất định.** Cùng một query byte-for-byte, chạy lại ngay sau
  đó thì thành công. Đã bisect cả file schema 459 dòng: không có tổ hợp câu lệnh nào tái
  hiện được ổn định; mọi tổ hợp con đều pass, chỉ full batch mới thỉnh thoảng hỏng.
  Đây là flakiness phía proxy. **Cứ chạy lại**, đừng ngồi chia nhỏ file hay sắp xếp lại
  câu lệnh — đã có người mất một lượt bisect đầy đủ để kết luận đúng điều này. Batch hỏng
  thì roll back sạch (đã xác minh), nên retry an toàn.
- **`SET ROLE` / `SET LOCAL ROLE` bị chặn**, cùng họ với `set_config`. Không giả lập được
  `anon`/`authenticated` qua MCP — muốn kiểm quyền thật thì phải đi HTTP bằng khóa anon,
  đó là lý do `scripts/db-check.mjs` tồn tại.

## Lệnh

```bash
npm run check          # CỔNG DUY NHẤT — chạy cái này trước khi nói "xong". ~13s
npm run db:check       # ranh giới bảo mật tầng DB, cần mạng. Sau mỗi lần đổi db/schema/
npm run dev            # dev server
npm run design:build   # sinh lại tailwind.theme.json từ DESIGN.md
npm run seed:content   # sinh SQL bootstrap db/seed/*.json -> bảng nội dung
```

`npm run check` cũng chạy tự động ở **pre-commit**: `.githooks/pre-commit`, được nối vào bằng
`core.hooksPath` trong script `prepare` của npm (npm tự gọi `prepare` sau `npm install`, nên
máy mới clone là có hook luôn — không cần husky). Cần bỏ qua một lần thì `git commit --no-verify`.

`npm run check` chạy tuần tự, dừng ở lỗi đầu tiên, xếp theo thứ tự nhanh-hỏng-trước:
`design:lint` → `test` → `lint` → `build`. Từng cái vẫn gọi riêng được
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
không test kiểu này được. Đó là lý do `resolveState` nằm riêng ở `lib/insforge/unlock.ts` chứ
không ở trong `shelf.ts`, và `safeNext` nằm riêng ở `lib/safe-next.ts`.

Đừng cài Vitest/Jest chỉ để lách chuyện alias. Phần còn lại của repo đã có cổng riêng và
những cổng đó bắt lỗi tốt hơn một bộ test JSX:

| Rủi ro | Ai bắt |
|---|---|
| Chuỗi mở khóa đứt gãy | Không xảy ra được — không có cột nào lưu nó |
| Người dùng thường sửa được nội dung | `npm run db:check` (phép 10) |
| Người dùng tự phong admin | `npm run db:check` (phép 8, 11) |
| Token màu/chữ sai, tương phản dưới AA | `design:lint` |
| Sai kiểu, route không tồn tại | `build` (typegen + tsc) |
| **RLS và quyền của `complete_book`** | **`npm run db:check`** |

Hàng cuối là rủi ro lớn nhất của dự án. `scripts/db-check.mjs` gọi backend thật bằng đúng khóa
`anon` mà trình duyệt cầm — **11 phép**, tất cả qua HTTP thật, không phải SQL qua MCP.

Chín phép đầu chạy khi **chưa đăng nhập**: xác nhận sách đã xuất bản vẫn đọc được, và khẳng
định kẻ chưa đăng nhập **không** ghi được `user_items` hay `user_book_progress`, **không** gọi
được `_complete_book_for` hay `complete_book`, **không** đọc được sách nháp, **không** ghi được
`user_roles` hay `books`, và đọc `user_items` ra rỗng.

Hai phép cuối cần tài khoản thật (`DB_CHECK_USER_EMAIL` / `DB_CHECK_USER_PASSWORD` trong
`.env.local`) và kiểm **người đã đăng nhập nhưng không phải admin**: không ghi được `books`,
và không tự phong admin được cũng không đọc trộm được vai trò người khác trong `user_roles`.
Thiếu hai biến đó thì kết quả báo `9/9 ... (2 PHÉP BỊ BỎ QUA)` — đó là **bỏ qua, không phải
đạt**.

**Phép ghi `books` khi đã đăng nhập bắt buộc phải hỏng vì POLICY chặn, không phải vì thiếu
GRANT** — thiếu GRANT thì admin thật cũng ghi hỏng, phép kiểm không chứng minh được gì. Postgres
trả CHUNG sqlstate `42501` cho cả hai trường hợp, khác nhau duy nhất ở message
(`permission denied for table` so với `new row violates row-level security policy`); script bắt
buộc soi message, không được soi mã lỗi. Đây đã là bẫy thật một lần: ai tin "chặn nào cũng ra
42501 permission denied" mà đơn giản hóa lại thành so mã lỗi thì phép kiểm mất khả năng phân
biệt hai trường hợp đó, và hỏng âm thầm — không còn ai biết.

Hai dòng seed tồn tại chỉ để làm mồi nhử, không phải nội dung thật: quyển nháp vĩnh viễn
`__nhap-khong-bao-gio-xuat-ban` (cho phép 7) và dòng vai trò `admin` của tài khoản mồi nhử
`22222222-2222-2222-2222-222222222222` trong `user_roles` (cho phép 11). Thiếu mồi nhử thì
phép đó vẫn chạy, vẫn báo PASS, nhưng hết nghĩa — sách thật đều đã publish nên phép 7 luôn
thấy 0 dòng, `user_roles` không còn dòng "người khác" nào nên phép 11 luôn thấy 0 dòng, kể cả
khi RLS hỏng hoàn toàn. Đừng "dọn" hai dòng này.

Cố ý **không** viết bằng SQL chạy qua MCP `run-raw-sql`: SQL chạy bằng quyền admin nên kiểm
được `has_function_privilege` nhưng không kiểm được thứ thật sự quan trọng — cái mà một request
thật từ ngoài Internet làm được. Script này đi đúng đường của kẻ tấn công, và không cần MCP nên
chạy được cả khi MCP không kết nối.

## Agent harness — cái gì nằm ở đâu

| Đường dẫn | Vai trò |
|---|---|
| `CLAUDE.md` (file này) | Toàn bộ kiến thức dự án. **Không** viết vào `AGENTS.md` — installer InsForge ghi đè file đó. |
| `.claude/settings.json` | Allowlist lệnh + deny rule `pen.dev/**` + đăng ký hook. |
| `.claude/hooks/guard-pen-dev.mjs` | `PreToolUse(Bash)`, chặn mọi lệnh shell chạm `pen.dev`. |
| `.githooks/pre-commit` | Chạy `npm run check` trước mỗi commit. Nối bằng `npm run prepare`. |
| `scripts/db-check.mjs` | Self-check 11 ranh giới bảo mật tầng DB (`npm run db:check`). |
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

---

@AGENTS.md
