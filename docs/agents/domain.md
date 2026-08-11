# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

Layout: **single-context** — one `CONTEXT.md` + `docs/adr/` at the repo root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you're about to work in

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## Nguồn domain sẵn có của repo này

`CONTEXT.md` và `docs/adr/` chưa tồn tại. Trong lúc chờ chúng được tạo, ba file sau đang giữ
vai trò tương đương và **nên đọc trước khi khám phá codebase**:

| File | Vai trò |
|---|---|
| `content.md` | Bản mô tả sản phẩm: sitemap, cơ chế mở khóa, nội dung từng trang. Nguồn từ vựng nghiệp vụ (kệ sách, quyển, vật phẩm, streak, túi hành trang). |
| `DESIGN.md` | Hệ thiết kế và lý do đằng sau từng token — thực chất là một tập ADR về hình ảnh. |
| `CLAUDE.md` | Ràng buộc kiến trúc đang có hiệu lực, đáng chú ý nhất là quy tắc logic mở khóa phải nằm ở phía server. |

Khi `/domain-modeling` tạo `CONTEXT.md`, hãy rút từ vựng ra từ `content.md` thay vì đặt tên mới.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Dự án dùng tiếng Việt cho từ vựng nghiệp vụ. Giữ nguyên thuật ngữ tiếng Việt trong tiêu đề
ticket và tài liệu (kệ sách, quyển sách, vật phẩm, túi hành trang), dùng tiếng Anh cho định
danh trong code (`shelves`, `books`, `items`, `user_items`).

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
