# ChronoShelf — điểm vào cho agent

**Mọi kiến thức về dự án nằm ở `CLAUDE.md`.** Đọc file đó trước khi làm bất cứ việc gì:
nguồn sự thật, quy tắc bắt buộc, kiến trúc backend, bẫy đã gặp, và các lệnh cổng.

File này CỐ Ý chỉ là một con trỏ. Trước đây nó là một bản CHÉP của `CLAUDE.md` và đã trôi
lệch: bản chép vẫn mô tả luồng đăng nhập OTP cùng hai hàm `app.issue_login_code` /
`app.consume_login_code` — những thứ đã bị DROP ở `db/schema/15-mat-khau.sql`. Hai bản
kiến thức thì luôn có một bản sai, và không cổng nào bắt được bản sai đó.

Nó tồn tại vì Codex đọc `AGENTS.md` chứ không đọc `CLAUDE.md`, và vì `next dev` sẽ tự dựng
lại nó nếu CẢ HAI file cùng vắng mặt (`node_modules/next/dist/server/lib/generate-agent-files.js`).
Khối quy tắc Next.js bên dưới do `next dev` tự ghi và tự cập nhật — đừng xóa bằng tay.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

