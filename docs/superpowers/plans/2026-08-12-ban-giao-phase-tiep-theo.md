# Bàn giao — mở phase mới

Ngày: 2026-08-12
Nhánh: `feature/ke-sach-doc-sach` (chưa merge vào `master`, chưa có remote)
Trạng thái build: `npm run build` pass, `npx tsc --noEmit` sạch, `design:lint` 0 lỗi 0 cảnh báo

Đọc `CLAUDE.md` trước. File này chỉ ghi phần **chưa** nằm trong CLAUDE.md: việc đã xong tới
đâu, quyết định kiến trúc nào đã chốt và vì sao, và bước kế tiếp là gì.

---

## 1. Quyết định kiến trúc đã chốt (đừng làm lại)

### Nội dung ở JSON, database chỉ giữ trạng thái người dùng

`content/shelves/*.json` là **nguồn sự thật** cho tiêu đề sách, nội dung trang, vật phẩm, tên
kệ. Ảnh tĩnh nằm ở `public/`. Import thẳng vào bundle nên trang render tĩnh được.

Database chỉ có 3 bảng:

| Bảng | Vai trò |
|---|---|
| `user_book_progress` | `user_id`, `book_slug`, `current_page`, `completed`, `completed_at` |
| `user_items` | `user_id`, `item_slug`, `obtained_at` |
| `book_unlocks` | Bản chiếu sinh từ JSON: `book_slug`, `shelf_slug`, `position`, `page_count`, `required_item_slug`, `reward_item_slug` |

**Vì sao `book_unlocks` vẫn phải nằm trong DB** — đây là điểm dễ bị "dọn dẹp" nhầm: quyết định
trao vật phẩm bắt buộc chạy phía máy chủ (content.md §8), mà backend **không có `service_role`**
(chỉ `anon` + `authenticated` — đã kiểm tra bằng `pg_roles`). Không có service_role thì route
Next.js không bao giờ đủ quyền ghi `user_items`. Đường duy nhất còn lại là hàm Postgres
`SECURITY DEFINER`, và hàm đó chỉ đọc được chuỗi mở khóa nếu nó nằm trong DB.

Đổi nội dung JSON xong phải chạy `npm run content:sync` rồi đưa SQL sinh ra qua MCP
`run-raw-sql`. `npm run content:check` kiểm tra tính toàn vẹn mà không sinh SQL.

### RPC tách làm hai hàm

`_complete_book_for(user_id, book_slug)` giữ logic; `complete_book(book_slug)` là vỏ một dòng
gọi `auth.uid()`. Tách vì SQL proxy của InsForge chặn `set_config('request.jwt.claims', …)`,
không giả lập được `auth.uid()` nên hàm một-mảnh không test được.

**BẢO MẬT:** `_complete_book_for` **không được** cấp EXECUTE cho `anon`/`authenticated`. Ai gọi
được nó với `user_id` tùy ý là tự phát vật phẩm cho mình. Đã xác minh bằng
`has_function_privilege`. Nếu sửa hàm, kiểm tra lại quyền.

---

## 2. Đã xong

- **Harness**: `CLAUDE.md` (kiến thức dự án — **không** viết vào `AGENTS.md`, file đó bị
  installer InsForge ghi đè), `.claude/settings.json`, `docs/agents/`.
- **Design system**: `DESIGN.md` (format google-labs-code/design.md) là nguồn token duy nhất →
  `npm run design:build` sinh `tailwind.theme.json` → `tailwind.config.ts` đọc. Đã sửa 4 lỗi
  tương phản WCAG. Có mục Motion + token `ring`/`destructive`.
- **Backend**: schema + RLS + RPC đã chạy, self-check 9/9 pass. `book_unlocks` đã seed 5 quyển.
  3 bucket đã tạo (`book-covers`, `page-images`, `item-images`) — hiện **chưa dùng**, vì ảnh
  đã chuyển sang `public/`. Cân nhắc xóa nếu không dùng tới.
- **Code**: `lib/content/` (đọc JSON), `lib/insforge/` (client + data layer), `components/Header.tsx`,
  `components/shelf/BookCover.tsx`.
- **Kệ sách + đọc sách (2026-08-13)**: `BookShelf`, `ShelfPageClient`, `app/lich-su-viet-nam/page.tsx`,
  `components/reader/` (`BookReaderModal`, `PageSpread`, `ItemDropOverlay`). `app/page.tsx` không
  còn là trang create-next-app; ảnh trong JSON đã đổi sang `null` và UI dùng nền phẳng.
  Đã chạy thật đủ 3 nhánh (chưa đăng nhập → báo cần đăng nhập; đọc xong → nhận Trống đồng và mở
  khóa quyển 2; đọc lại → `alreadyCompleted`, `user_items` vẫn đúng 1 dòng).

## 3. Chưa xong — việc của phase tiếp theo

| # | Việc | Ghi chú |
|---|---|---|
| 1 | Auth | Chưa có màn đăng nhập/đăng ký. Chưa đăng nhập thì kệ vẫn xem được nhưng chỉ quyển đầu mở, và nút "Đọc xong" báo "Bạn cần đăng nhập…". Là subsystem riêng, và là thứ chặn nhiều nhất hiện giờ. |
| 2 | Ảnh thật | `cover`/`image` trong JSON đang là `null` → UI hiện khối phẳng + "Ảnh minh họa sẽ được bổ sung". Có ảnh thì đặt vào `public/` rồi điền lại đường dẫn, component đã xử lý sẵn cả hai nhánh. |
| 3 | Túi hành trang + streak | Số 12/7 trên header vẫn là placeholder. Hoạt cảnh "vật phẩm bay vào túi" (spec màn C) chưa làm vì chưa có túi thật. |
| 4 | Chi tiết đọc sách còn thiếu | Âm thanh lật trang + nút tắt tiếng (spec §2 màn B), kéo góc trang, focus trap trong modal (hiện đã có Escape + mũi tên + `role="dialog"`). |
| 5 | Trang chủ thật | `app/page.tsx` mới chỉ là lối vào kệ sách, timeline "Ngày ấy – Bây giờ" là subsystem riêng. |

### Ràng buộc UI đã chốt trong DESIGN.md, phải tuân thủ

- **Không dùng emoji làm icon.** Dùng `lucide-react` (đã cài).
- **Focus ring bắt buộc**: `ring-ring-on-dark` trên nền nâu/tối, `ring-ring` trên nền sáng.
- **`prefers-reduced-motion` bắt buộc**: dùng `motion-safe:` / `motion-reduce:` của Tailwind.
  Quầng sáng nhấp nháy phải dừng hẳn; trạng thái cuối phải giống nhau ở cả hai chế độ.
- **Ngân sách chuyển động**: tối đa 1–2 thành phần động cùng lúc. Hoạt cảnh nhận vật phẩm là
  chuỗi **tuần tự**, không chạy chồng.

---

## 4. Bẫy đã gặp — đừng vấp lại

- **Pencil MCP không ghi xuống đĩa ngay.** `Get`/`GetVariables` đọc bộ nhớ editor nên trả về
  giá trị mới trong khi file còn nguyên. Luôn kiểm `git status` trước khi commit `.pen`.
  (Hiện không còn vẽ `.pen` nữa, nhưng giữ lại phòng khi quay lại.)
- **`AGENTS.md` bị installer InsForge ghi đè toàn bộ.** Đã từng xóa mất block
  `nextjs-agent-rules` và cả nội dung dự án. Mọi thứ về dự án viết vào `CLAUDE.md`.
- **`set_config` bị SQL proxy chặn** — không test `auth.uid()` trực tiếp được, đó là lý do
  RPC tách hai hàm.
- **Exception block trong `DO $$` roll back luôn dữ liệu hàm vừa insert.** Fixture phải tạo
  dòng `user_book_progress` **trước** block `BEGIN…EXCEPTION` thì nó mới sống qua savepoint.
- **`py` là Python launcher trên máy này**, `python`/`python3` đều không có.
- **Tailwind 3.4 xuất màu dạng `rgb(r g b/alpha)`**, không phải hex — grep hex trong CSS build
  ra sẽ báo sai là "token không tới nơi".
- **Thang spacing của Tailwind không có `42`.** `w-42` (168px, bề ngang bìa sách) im lặng không
  sinh ra class nào — bìa bị co lại theo nội dung. Cỡ nào không có trong thang thì đặt tay trong
  `.module.scss`, đừng đoán tên class.
- **Phiên đăng nhập InsForge nằm ở trình duyệt**, nên `getUserShelfState()` gọi từ server
  component luôn trả về rỗng (ai cũng thành "chưa đăng nhập"). Trạng thái người dùng phải lấy
  phía client — đó là lý do có `ShelfPageClient`, và cũng là lý do sau khi đọc xong chỉ cần gọi
  lại `getUserShelfState()` chứ không `router.refresh()`.
- **Backend đang bật xác minh email**: `auth.signUp` trả `requireEmailVerification: true` và
  `accessToken: null`. Muốn tạo user để test thì `UPDATE auth.users SET email_verified = true`
  qua `run-raw-sql` rồi mới `signInWithPassword` được.
- **Chưa đăng nhập, mỗi lần đọc trạng thái sẽ log 401 từ `/api/auth/refresh`** ở console. Đó là
  SDK thử làm mới phiên, không phải lỗi của trang.

## 5. Lệnh

```bash
npm run dev            # dev server
npm run build          # phải pass trước khi commit
npm run lint
npm run content:check  # kiểm tra JSON + chuỗi mở khóa
npm run content:sync   # sinh SQL chiếu JSON -> book_unlocks
npm run design:lint    # kiểm tra token + tương phản
npm run design:build   # DESIGN.md -> tailwind.theme.json
```

## 6. Kiểm chứng lại backend khi mở phase mới

Chạy self-check để chắc RPC còn nguyên (thay `<uuid>` bằng user thật hoặc dùng khối `DO`
trong lịch sử git của file này):

```sql
SELECT p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('complete_book','_complete_book_for');
```

Kỳ vọng: `_complete_book_for` → false/false, `complete_book` → true/false.
