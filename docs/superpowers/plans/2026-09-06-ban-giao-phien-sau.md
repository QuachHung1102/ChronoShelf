# Bàn giao — trạng thái ngày 2026-09-06

> Đọc file này khi mở phiên mới. Nó ghi **đã làm gì**, **cổng đang ở đâu**, và **việc kế tiếp
> là gì kèm thứ đang chặn nó**. Kiến thức lâu dài thuộc về `CLAUDE.md`; file này là ảnh chụp
> một thời điểm và sẽ bị xóa khi các mục "còn lại" xong hết.
>
> Thay cho `2026-09-04-ban-giao-phien-sau.md`. Ba mục "còn lại" của bản đó **vẫn còn nguyên** —
> cả ba đều chờ người dùng hoặc chờ một tệp thật, không mục nào bị chặn bởi mã.

Nhánh: `feature/ke-sach-doc-sach`. Phiên này: **2 commit**.

Admin hiện tại là `quachhung389@gmail.com`. Tài khoản `ui-audit` dùng để soi giao diện cũng
có quyền admin — nó là tài khoản thật trong database dev, không phải mồi nhử của `db:check`.

---

## Đã làm

| Commit | Nội dung |
|---|---|
| `31efffb` | **Dọn file dành cho agent**: `AGENTS.md` rút còn một con trỏ sang `CLAUDE.md`, và `.codex/config.toml` bị `.gitignore` chặn |
| `633a066` | **Đợt trau chuốt giao diện** toàn ứng dụng — không thêm màn hình nào, 46 file |

### `31efffb` — vì sao đụng tới `AGENTS.md`

`AGENTS.md` là một bản **chép** của `CLAUDE.md` và đã trôi lệch: nó vẫn mô tả luồng đăng nhập
OTP cùng hai hàm `app.issue_login_code` / `app.consume_login_code` — những thứ đã bị DROP ở
`db/schema/15-mat-khau.sql` từ `9e67a64`. Hai bản kiến thức thì luôn có một bản sai, và không
cổng nào bắt được bản sai đó.

Không xóa hẳn vì hai lý do đã kiểm chứng trong `node_modules/next/dist/server/lib/generate-agent-files.js`:
Codex đọc `AGENTS.md` chứ không đọc `CLAUDE.md`, và `next dev` chỉ dựng lại file này khi **cả
hai** cùng vắng mặt (nhánh *"Neither file exists"*). Xóa một mình `AGENTS.md` thì an toàn với
`next dev` — nhưng Codex mất điểm vào.

`.codex/config.toml` giữ một **Bearer token** của MCP server và trước đó **không** bị chặn (đo
bằng `git check-ignore`). `.codex/hooks.json` + `.codex/hooks/guard-pen-dev.mjs` vẫn được commit:
đó là hàng rào `pen.dev`, bản sao y hệt của `.claude/hooks/guard-pen-dev.mjs`.

### `633a066` — đợt giao diện, gom theo vấn đề

- **Kệ sách nói thật ngay từ lần sơn đầu.** `ShelfPageClient` khởi tạo bằng `SIGNED_OUT` rồi mới
  gọi `/api/me/state`, nên mọi lượt vào kệ đều sơn SAI trước rồi một nhịp sau mới nhảy sang sự
  thật. `lib/content/user-state.ts` đọc trạng thái ở server làm giá trị khởi tạo. Client **vẫn**
  gọi lại `/api/me/state` — trạng thái phải làm mới sau khi đọc xong một quyển và sau khi đăng
  nhập ở header, cả hai đều không đổi route.
- **Khung xương khi chuyển trang.** Ứng dụng trước đó không có một `loading.tsx` nào, mà mọi
  trang đều `force-dynamic`. Một file ở gốc `app/` che hết các trang nền sáng, một bản riêng cho
  `app/[shelf]` vì màn kệ là nền tối.
- **Mục điều hướng đang chọn không còn phân biệt CHỈ bằng màu** (WCAG 1.4.1 mức A). Gạch chân cam
  = trang hiện tại, gạch kem = đang trỏ tới.
- **Trạng thái `:active`** cho ba loại nút (trước đó cả ứng dụng không có cái nào), và vá màu
  autofill của Chrome.
- **Thẻ quản trị có ranh giới thật** — trước đó `bg-surface` trên nền `neutral` là 1.16:1.
- **Token thêm bậc**: `2xl`/`3xl`, `measure` 456px, `headline-xl` 48px; `secondary-light` sáng lên
  `#E3C39B` để đạt AA trên **mọi** nền tối đang dùng. Lý do từng con số nằm trong `DESIGN.md`.
- **Gom cái bị chép tay**: `FOCUS_RING_ON_DARK`, `navItemClass`, `components/admin/card.tsx`;
  `getAdminUserId` bọc `cache()` (hai transaction → một cho mỗi lượt xem `/quan-tri/*`).

## Cổng đang ở đâu

```
npm run check        → exit 0, 99 test          (chạy 2 lần qua pre-commit)
npm run db:check     → chưa chạy lại phiên này — không đụng db/schema/ nên không cần
npm run db:mutation  → chưa chạy lại phiên này — cùng lý do
```

24 route, 17 file schema — không đổi so với bản trước.

### Đã đo thật trong trình duyệt ở 1024×768

Bàn giao trước ghi *"việc UI không được dừng ở cổng xanh"*, nên đợt này đi hết lượt: trang chủ,
kệ sách, trình đọc (bìa → trang đôi → nhận vật phẩm), túi hành trang, cộng đồng, bài giảng, quản
trị. Console sạch. Hai điều được **loại trừ** bằng phép đo chứ không bằng suy đoán:

- **Không có rò rỉ sách nháp.** `curl` không cookie tới `/lich-su-viet-nam` trả đúng 5 quyển đã
  xuất bản và `"Đã đọc xong 0 trên 5 quyển"` — quyển mồi nhử `__nhap-khong-bao-gio-xuat-ban`
  không có trong HTML. (Admin thì thấy nó, đeo nhãn NHÁP — đúng thiết kế.)
- **Trình đọc không để nền trôi.** Nghi ngờ ban đầu là mở sách rồi cuộn thì kệ phía sau trượt
  chỗ. Sai: modal dùng `showModal()` nên phần còn lại `inert`, PageDown giữ `scrollY` ở 0. Chỉ
  `window.scrollBy()` gọi bằng JS mới đẩy được nền, mà đó không phải thao tác của người dùng.
  **Đừng "sửa" bằng `overflow: hidden` trên `body`** — không có lỗi để mà sửa, và khóa cuộn sẽ
  làm nội dung nhảy ngang đúng bề rộng thanh cuộn.

## Việc còn lại

### 1. Slide và sơ đồ tư duy THẬT (chờ người dùng)

Không đổi so với bản trước. Hạ tầng xong và đã chạy thật đầu-cuối, nhưng hai bài giảng hiện có
là **mẫu**: tệp `.pptx` chỉ là gói ZIP nhỏ dựng lúc kiểm thử, còn ảnh xem trước đang mượn tạm
ảnh trong `public/timeline/` — nhìn thấy rõ ở `/bai-giang`, bài "Chiến thắng Bạch Đằng năm 938"
đang mang ảnh gia đình thời tiền sử. Khi nào có bộ slide thật thì vào `/quan-tri/bai-giang`
thay, **không cần đụng mã**.

### 2. Siết `sniffPptx` khi có `.pptx` thật để đối chứng

Không đổi. `laGoiZip()` hiện chỉ khẳng định "là một gói ZIP"; lý do dừng ở đó ghi trong chính
hàm và spec §3. Khi có file thật commit vào repo thì thêm phép so `[Content_Types].xml` ở
offset 30 kèm test.

### 3. Dọn tài khoản test trong database dev — **đã thử, bị chặn**

Mỗi lần `npm run db:check` chạy là commit thêm 5 tài khoản `*@example.invalid`. Phiên này đã
thử dọn và **classifier của Claude Code chặn** cả lệnh xóa lẫn lệnh đếm, vì chúng nạp
`.env.pgadmin` (chuỗi kết nối superuser) rồi ghi vào `public.users`. Không lách; để người dùng
tự chạy khi thấy chướng:

```bash
DELETE FROM public.users
WHERE email LIKE '%@example.invalid' AND email <> '__moi-nhu-vai-tro@example.invalid';
```

**Đừng xóa dòng mồi nhử** — thiếu nó là hai phép kiểm mất hết ý nghĩa.

### 4. Những thứ đã cân nhắc và CỐ Ý bỏ

Danh sách của bản trước còn nguyên hiệu lực — kéo-thả đổi thứ tự, cột `position` cho `lessons`,
nhúng trình chiếu `.pptx`, ép thứ tự đọc trong `complete_book`, phân trang `/bai-giang` và bảng
tin, gửi email, `pgcrypto`/bcrypt, 2FA và đăng nhập bằng Google. Lý do từng mục nằm ở
`2026-09-04-ban-giao-phien-sau.md` trong git history. Phiên này thêm một mục:

| Việc | Vì sao bỏ |
|---|---|
| Khóa cuộn nền khi mở trình đọc | Không có lỗi để sửa — `showModal()` đã làm nền `inert`, đo bằng PageDown. Xem mục "Đã đo thật" ở trên |

## Ba điều phiên sau nên biết trước khi gõ phím

1. **`npm run check` là cổng duy nhất cho code**, chạy tự động ở pre-commit. Sau mỗi lần đụng
   `db/schema/` thì thêm `db:check` **và** `db:mutation` — cần `PGADMIN_URL` (nằm ở
   `.env.pgadmin`, không commit).

2. **Việc UI vẫn không được dừng ở "cổng xanh"** — nhưng phép kiểm trong trình duyệt cũng phải
   đúng công cụ. `fullPage: true` của Playwright **nói dối về `animation-timeline: view()`**:
   ảnh chụp toàn trang chủ cho thấy ba trong bốn mốc thời gian trống trơn, trông y như một lỗi
   bố cục nghiêm trọng. Cuộn thật rồi đo `opacity` thì cả bốn đều bằng 1. Chụp từng khung nhìn,
   đừng chụp toàn trang, với bất kỳ trang nào có hoạt cảnh gắn với tiến trình cuộn.

3. **Sản phẩm CHỈ nhắm màn hình PC.** Ngưỡng thấp nhất phải chạy đúng là **1024×768**. Báo cáo
   lỗi bố cục dưới ~1000px thì bỏ qua.
