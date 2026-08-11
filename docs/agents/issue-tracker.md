# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

Repo này chưa có git remote, nên không dùng GitHub/GitLab Issues.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Ranh giới với `docs/superpowers/`

Repo dùng song song hai quy ước tài liệu, đừng trộn chúng:

| Nơi | Chứa gì |
|---|---|
| `docs/superpowers/specs/` + `plans/` | Spec đã duyệt và kế hoạch triển khai cho **cả một subsystem**, sinh ra từ workflow brainstorming → writing-plans. Tài liệu dài, sống lâu, được commit. |
| `.scratch/<feature>/` | Ticket ngắn và spec tác vụ của các engineering skill (`to-tickets`, `to-spec`, `wayfinder`…). Đơn vị nhỏ hơn, vòng đời ngắn hơn. |

Khi một ticket trong `.scratch/` thuộc về một subsystem đã có spec, hãy trỏ ngược về file spec
trong `docs/superpowers/specs/` thay vì chép lại nội dung.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
