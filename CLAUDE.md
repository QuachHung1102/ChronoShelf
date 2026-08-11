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
  áp cho `cat`/`head`/`tail`/`sed` chạy qua Bash. **Nhưng nó không chặn subprocess tùy ý** —
  `git show HEAD:pen.dev/design.pen` vẫn đọc được (vì vậy `git show` đã bị bỏ khỏi allowlist,
  nó sẽ hỏi trước khi chạy). Đây là hàng rào chống lỡ tay, không phải ranh giới bảo mật.
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
- `design:lint` chặn lỗi tương phản. Palette đã được sửa để đạt AA: `tertiary` (#E8622C) chỉ
  dùng cho đồ họa, `tertiary-deep` khi accent làm nền cho chữ, `tertiary-light` khi accent là
  chữ trên nền nâu. Chi tiết lý do nằm trong mục Colors của `DESIGN.md`.

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

## Lệnh

```bash
npm run dev            # dev server
npm run build          # phải pass trước khi commit
npm run lint           # eslint
npm run design:lint    # kiểm tra design token
npm run design:build   # sinh lại tailwind.theme.json từ DESIGN.md
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

@AGENTS.md
