# Thiết kế: Nội dung động + Quản trị + Bản đồ thế giới

> ## ⚠️ PHẦN HẠ TẦNG ĐÃ LỖI THỜI (2026-08-28)
>
> Spec này viết khi backend còn là một BaaS ngoài. **Phần SẢN PHẨM vẫn là nguồn sự thật**:
> mô hình nội dung, vai trò admin/user, chuỗi mở khóa suy từ vị trí, luồng biên tập.
>
> **Phần hạ tầng thì không.** Mọi chỗ nói về role `anon`/`authenticated`, `auth.uid()`,
> `auth.users`, MCP `run-raw-sql`, SDK hay storage của BaaS đều đã bị thay. Nguồn sự thật
> cho hạ tầng bây giờ là `CLAUDE.md` mục "Backend — PostgreSQL cục bộ" và
> `db/schema/README.md`.


Ngày: 2026-08-24
Trạng thái: Đã duyệt (2026-08-24), chờ viết plan
Nhánh: `feature/ke-sach-doc-sach`

Đọc `CLAUDE.md` và `docs/superpowers/plans/2026-08-12-ban-giao-phase-tiep-theo.md` trước.
Spec này thay đổi một quyết định kiến trúc đã chốt trong hai file đó — mục 2 giải thích vì sao.

## 1. Bối cảnh & phạm vi

Cơ chế lõi (kệ sách + đọc sách) và auth đã chạy. Xác minh ngày 2026-08-24:
`npm run check` pass, `npm run db:check` 6/6, `auth.users` có **0 dòng** (user test đã xóa),
3 bucket `book-covers` / `item-images` / `page-images` đã tạo và **public** nhưng chưa dùng.

Đợt này giải quyết một yêu cầu mới: **admin phải tự tạo thêm sách được, không cần lập trình viên
và không cần build lại**. Yêu cầu đó không tương thích với kiến trúc hiện tại (nội dung là JSON
import thẳng vào bundle), nên nó kéo theo cả một chuỗi thay đổi.

**Trong phạm vi:**

1. Vai trò `admin` / `user` trong database.
2. Nội dung bài học chuyển từ `content/shelves/*.json` vào database.
3. Giao diện quản trị `/quan-tri`: tạo/sửa kệ, sách, trang, vật phẩm.
4. Trang chủ thành bản đồ thế giới; route kệ sách thành route động.
5. Ảnh thật (Wikimedia Commons / tài liệu đại học) thay 5 file SVG tự vẽ.
6. Focus trap trong `BookReaderModal` (accessibility, `DESIGN.md` đã yêu cầu).

**Ngoài phạm vi — mỗi phần một spec riêng về sau:**

- Túi hành trang + streak (số `12` / `7` trên `Header.tsx` vẫn là placeholder).
- Âm thanh lật trang + nút tắt tiếng.
- Kéo góc trang để lật (turn.js đã gỡ, phải tự viết).
- Timeline "Ngày ấy – Bây giờ" — bản đồ thế giới chiếm chỗ trang chủ, phần timeline cần spec lại.
- Câu hỏi trắc nghiệm cuối sách.
- Mobile / responsive.

## 2. Quyết định kiến trúc

### 2.1 Nội dung chuyển vào database

`CLAUDE.md` hiện chốt "nội dung ở JSON, database chỉ giữ trạng thái người dùng". Quyết định đó
đúng khi nội dung là dữ liệu biên tập do lập trình viên commit. Nó **sai** ngay khi admin phải
tạo sách lúc chạy: sách mới chỉ xuất hiện sau một lần build + deploy.

Hai hướng thay thế đã cân nhắc và loại:

| Hướng | Vì sao loại |
|---|---|
| Admin UI chỉ export JSON để dev commit | Không phải "admin tạo sách" — vẫn cần lập trình viên và một lần deploy cho mỗi quyển. |
| Lai: JSON cho sách cũ, DB cho sách mới | Hai nguồn sự thật cho cùng một loại dữ liệu. Luôn sai về lâu dài. |

Chọn: **nội dung vào DB, JSON thành seed một lần**.

Cái được thêm: hướng này *xóa* code. Đi luôn `scripts/content-sync.mjs`, `npm run content:check`,
`npm run content:sync`, và bảng `book_unlocks`. Tính toàn vẹn mà `content:check` từng canh
được đẩy vào schema và vào đường ghi, chỗ nó không thể bị quên.

Hệ quả phải chấp nhận: trang kệ sách không còn render tĩnh, nó đọc DB mỗi request. Đây là một
truy vấn rẻ trên dữ liệu public, và đổi lại là nội dung sửa xong thấy ngay.

### 2.2 Bỏ hẳn `required_item_slug`

`scripts/content-sync.mjs` hiện **bắt buộc** `book[n].requiredItem === book[n-1].rewardItem`.
Nghĩa là cột `required_item_slug` là dữ liệu thừa: nó suy ra được 100% từ vị trí quyển sách.

Bỏ cột đi thì chuỗi mở khóa **không thể đứt**, vì không có chỗ nào lưu để mà sai:

- Quyển `i` mở ⟺ `i = 0`, **hoặc** người dùng sở hữu `books[i-1].reward_item_slug`.
- Trong RPC, "quyển kế tiếp đã mở" ⟺ người dùng sở hữu vật phẩm thưởng của **quyển vừa đọc xong**.

Ngữ nghĩa giữ nguyên với hôm nay, kể cả trường hợp một quyển không có vật phẩm thưởng: khi đó
quyển sau không có cổng, y hệt `requiredItem = null` hiện tại.

Đánh đổi: mất khả năng mở khóa chéo kệ hoặc phân nhánh. `content:check` đang cấm đúng chuyện đó
rồi nên không mất gì thật. Ghi `ponytail:` ở `lib/api/unlock.ts` kèm đường nâng cấp
(thêm lại cột `required_item_slug` nullable, mặc định null nghĩa là "vật phẩm của quyển trước").

### 2.3 Vai trò: bảng `user_roles`, không dùng `auth.users`

`auth.users` có sẵn cột `is_project_admin`, nhưng role `authenticated` **không có quyền gì**
trên schema `auth` (đã kiểm `information_schema.role_table_grants`: grant chỉ tồn tại trên 3 bảng
`public`). Đọc trực tiếp là không được.

Dùng bảng của mình: `public.user_roles`. **Không có dòng nghĩa là `user`** — chỉ admin mới có
dòng. `authenticated` chỉ được `SELECT` dòng của chính mình (để ẩn/hiện link quản trị),
**không có `INSERT`/`UPDATE`/`DELETE` nào**. Bề mặt tự phong admin bằng 0.

Cấp quyền admin đầu tiên bằng SQL qua MCP `run-raw-sql` — cố ý không có luồng self-service.

## 3. Schema

File: `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` (nguồn sự thật, chạy qua MCP).

### 3.1 Vai trò

```sql
CREATE TABLE public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','admin')),
  granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own role select" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;   -- không INSERT/UPDATE/DELETE

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
$fn$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
```

`is_admin()` phải cấp EXECUTE cho **cả `anon`**: nó xuất hiện trong policy `SELECT` của bảng nội
dung, và quyền EXECUTE bị kiểm **trước** khi toán tử `OR` kịp ngắn mạch.

Đã kiểm bằng thực nghiệm ngày 2026-08-24 chứ không suy đoán: dựng một bảng thử với policy
`USING (flag OR _probe_exec())` trong đó **mọi dòng đều có `flag = true`**, rồi `SELECT` bằng
đúng khóa `anon` qua HTTP. Kết quả: `42501 permission denied for function _probe_exec` — ngắn
mạch không cứu được. (Kiểm bằng `SET LOCAL ROLE` trong `npm run db:check`; trước đây không kiểm được vì proxy chặn đổi
role, cùng họ với việc nó chặn `set_config`.)

Không rò rỉ gì khi cấp cho `anon` — với `anon` thì `auth.uid()` là NULL nên hàm luôn trả
`false`, và hàm chỉ nói về chính người gọi.

`SECURITY DEFINER` ở đây là bắt buộc chứ không phải tiện tay: policy `own role select` khiến một
người dùng thường không đọc được dòng của người khác, nhưng `is_admin()` cần đọc dòng của chính
người gọi từ bên trong policy của **bảng khác**.

### 3.2 Nội dung

```sql
CREATE TABLE public.shelves (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  position     integer NOT NULL,
  country_code text UNIQUE,           -- id số ISO-3166-1 của world-atlas; '704' = Việt Nam
  blurb        text NOT NULL DEFAULT '',
  cover_url    text,
  published    boolean NOT NULL DEFAULT false,
  CONSTRAINT shelves_position_key UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.items (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  image_url    text,
  image_source text,                  -- URL trang gốc trên Wikimedia Commons
  image_credit text                   -- tác giả + giấy phép, ví dụ "Gary Todd, CC0"
);

CREATE TABLE public.books (
  slug             text PRIMARY KEY,
  shelf_slug       text NOT NULL REFERENCES public.shelves(slug) ON DELETE CASCADE,
  position         integer NOT NULL,
  title            text NOT NULL,
  era              text NOT NULL,     -- niên đại dập trên bìa, ví dụ "Năm 938"
  cover_url        text,
  cover_source     text,
  cover_credit     text,
  reward_item_slug text REFERENCES public.items(slug) ON DELETE RESTRICT,
  published        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT books_shelf_position_key UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE public.pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_slug    text NOT NULL REFERENCES public.books(slug) ON DELETE CASCADE,
  position     integer NOT NULL,
  heading      text NOT NULL,
  body         text NOT NULL,
  image_url    text,
  image_source text,
  image_credit text,
  caption      text,
  summary      text[],                -- chỉ trang cuối, 3-5 ý (content.md 4.3)
  CONSTRAINT pages_book_position_key UNIQUE (book_slug, position) DEFERRABLE INITIALLY DEFERRED
);
```

Ba chi tiết cố ý:

- **`DEFERRABLE INITIALLY DEFERRED`** trên các ràng buộc thứ tự. Admin kéo đổi thứ tự hai quyển
  sách là một phép hoán đổi; không có `DEFERRABLE` thì phải đi đường vòng qua một vị trí tạm.
- **`ON DELETE RESTRICT`** cho `reward_item_slug`. `SET NULL` sẽ âm thầm mở toang quyển kế tiếp
  khi ai đó xóa một vật phẩm. `RESTRICT` bắt admin gỡ liên kết trước, và UI nói rõ vì sao.
- **`published`** để admin soạn dở không lộ ra cho học sinh.

### 3.3 RLS và quyền

```sql
-- Đọc: cái đã xuất bản thì ai cũng đọc được; admin đọc được cả bản nháp.
CREATE POLICY "read published" ON public.shelves FOR SELECT USING (published OR public.is_admin());
CREATE POLICY "read published" ON public.books   FOR SELECT USING (published OR public.is_admin());
CREATE POLICY "read items"     ON public.items   FOR SELECT USING (true);
CREATE POLICY "read pages"     ON public.pages   FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.books b
           WHERE b.slug = pages.book_slug AND (b.published OR public.is_admin()))
);

-- Ghi: chỉ admin. Lặp lại y hệt cho cả 4 bảng shelves / books / pages / items.
CREATE POLICY "admin write" ON public.shelves FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.shelves, public.books, public.pages, public.items FROM anon, authenticated;
GRANT SELECT                 ON public.shelves, public.books, public.pages, public.items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shelves, public.books, public.pages, public.items TO authenticated;
```

`GRANT ... TO authenticated` là cần thiết vì RLS chỉ **lọc dòng**, nó không cấp quyền bảng.
Hàng rào thật là policy `admin write`: một người dùng đã đăng nhập nhưng không phải admin sẽ
đi qua được GRANT rồi bị policy chặn lại. Đây chính là thứ `db:check` phải khẳng định (mục 7).

`items` cho đọc không điều kiện: chỉ là tên, mô tả và ảnh, không có gì để giấu, và trang kệ
cần tên vật phẩm để hiện "Cần Trống đồng để mở".

### 3.4 Di trú khỏi `book_unlocks`

```sql
ALTER TABLE public.user_book_progress DROP CONSTRAINT user_book_progress_book_slug_fkey;
ALTER TABLE public.user_book_progress
  ADD CONSTRAINT user_book_progress_book_slug_fkey
  FOREIGN KEY (book_slug) REFERENCES public.books(slug) ON DELETE CASCADE;
DROP TABLE public.book_unlocks;
```

`user_book_progress` và `user_items` giữ nguyên hoàn toàn (kể cả `GRANT UPDATE (current_page)`).
`auth.users` đang có 0 dòng nên không có dữ liệu người dùng nào phải bảo toàn.

### 3.5 RPC `_complete_book_for`

Giữ nguyên toàn bộ phần bảo mật — vẫn tách hai hàm, vẫn `SECURITY DEFINER`, vẫn
`REVOKE ALL ... FROM public, anon, authenticated` trên `_complete_book_for` và chỉ
`GRANT EXECUTE ON complete_book(text) TO authenticated`. Ba thay đổi trong thân hàm:

1. Đọc `public.books` thay cho `public.book_unlocks`, **kèm `AND published`**. Hàm chạy
   `SECURITY DEFINER` nên nó không chịu RLS; thiếu điều kiện này thì một quyển nháp vẫn
   hoàn thành được và vẫn phát vật phẩm.
2. `page_count` lấy bằng `SELECT count(*) FROM public.pages WHERE book_slug = p_book_slug`.
   Sách 0 trang thì `RAISE EXCEPTION 'Book has no pages'` — nếu không, `current_page >= 0`
   luôn đúng và quyển rỗng thành máy phát vật phẩm.
3. `nextBook.unlocked` tính từ **vật phẩm thưởng của quyển hiện tại** (mục 2.2), và quyển kế
   tiếp chỉ xét trong số `published`.

## 4. Tầng dữ liệu ở ứng dụng

Kiểu trong `lib/content/types.ts` **giữ nguyên hình dạng**, chỉ bỏ `ContentBook.requiredItem`.
Nhờ vậy `BookShelf`, `BookCover`, `BookPage` — vốn thuần prop — không phải sửa dòng nào.

| Trước | Sau |
|---|---|
| `lib/content/shelves.ts` import JSON, getter đồng bộ | `lib/content/read.ts` đọc DB qua SDK, getter `async` |
| `ShelfPageClient` tự gọi `buildShelfView(shelfSlug, …)` | Nhận `ContentShelf` qua prop từ server component |
| `BookReaderModal` gọi `getBook(shelfSlug, bookSlug)` | Nhận `ContentBook` qua prop |
| `ItemDropOverlay` gọi `getBook` + `getItem` | Nhận `ContentItem \| null` + `ContentBook \| null` qua prop |
| `app/lich-su-viet-nam/page.tsx` hardcode slug | `app/[shelf]/page.tsx` |

Nội dung là dữ liệu public nên **server component đọc được bằng anon key** — chỉ trạng thái
người dùng đọc ở client để làm mới ngay sau khi đọc xong một quyển. Giữ nguyên ranh giới đó:
server lấy nội dung, `ShelfPageClient` lấy trạng thái rồi ghép.

`lib/api/unlock.ts` gần như không đổi: `resolveState` giữ nguyên thân hàm, tham số đầu đổi
tên từ `requiredItem` thành `prevRewardItem`. Người gọi (`buildShelfView`) truyền
`books[i-1].rewardItem` thay vì `book.requiredItem`. `unlock.test.ts` cập nhật theo.

`BookView.requiredItem` trong `lib/api/types.ts` **giữ nguyên** — đó là vật phẩm mà
`BookCover` hiện trong tooltip "Cần … để mở". Chỉ nguồn của nó đổi: `buildShelfView` tra
`getItem(books[i-1].rewardItem)` thay vì `getItem(book.requiredItem)`. Đây là chỗ duy nhất
trong toàn bộ code còn nhắc tới khái niệm "vật phẩm cần để mở", và nó là giá trị tính ra
tại chỗ chứ không phải dữ liệu lưu trữ.

## 5. Giao diện quản trị `/quan-tri`

Chặn bằng `is_admin()` gọi qua SDK. Đây là **cổng giao diện**, không phải hàng rào bảo mật —
hàng rào thật là RLS ở mục 3.3. Không admin thì hiện "Bạn không có quyền vào khu vực này".

| Route | Nội dung |
|---|---|
| `/quan-tri` | Danh sách kệ. Thêm/sửa kệ, chọn quốc gia trên bản đồ, xuất bản. |
| `/quan-tri/[shelf]` | Sách trong kệ: kéo đổi thứ tự, chọn vật phẩm thưởng, xuất bản, xóa. |
| `/quan-tri/[shelf]/[book]` | Soạn từng trang: tiêu đề, thân bài, ảnh + nguồn + tác giả, chú thích, tóm tắt. Xem trước bằng đúng `BookPage` học sinh thấy. |
| `/quan-tri/vat-pham` | Vật phẩm dùng chung: tên, mô tả, ảnh. |

**Không có ô nhập "vật phẩm cần để mở".** Chuỗi mở khóa hiện ra dưới dạng đọc-thôi
("Mở bằng: Trống đồng — thưởng của quyển 1") vì nó được suy ra chứ không được lưu (mục 2.2).
Admin không có cách nào làm nó đứt.

Nút "Xuất bản" trên một quyển cảnh báo nếu quyển đó không có trang nào, khớp với ràng buộc
ở RPC (mục 3.5 điểm 2).

Upload ảnh: component dùng chung, đẩy file lên bucket tương ứng (`book-covers`, `page-images`,
`item-images` — cả ba đã tồn tại và public), lấy URL công khai rồi ghi vào cột `*_url`.
Ô `*_source` và `*_credit` là **bắt buộc khi có ảnh** — xem mục 6.

## 6. Ảnh

Nguồn: **Wikimedia Commons** (miền công cộng / CC) và tài liệu của các trường đại học.
Tải về rồi upload lên bucket — không hotlink thẳng vào Wikimedia.

Mỗi ảnh lưu kèm `*_source` (URL trang gốc) và `*_credit` (tác giả + giấy phép). Đây là
**điều kiện của giấy phép CC BY-SA**, không phải thủ tục thừa; thiếu nó là dùng sai giấy phép.
`BookPage` và `BookCover` hiện credit ở dạng chữ nhỏ.

5 file `public/items/*.svg` tự vẽ bị thay bằng ảnh thật và xóa khỏi repo.

`public/vendor/jquery.js` + `turn.js` vẫn không ai tham chiếu; để nguyên tại chỗ theo ghi chú
trong bản bàn giao (bản thương mại do người dùng cung cấp).

## 7. Cổng kiểm tra

`npm run check` bỏ `content:check`, còn lại `design:lint && test && lint && build`.
Xóa `scripts/content-sync.mjs`, `npm run content:check`, `npm run content:sync`.

`scripts/db-check.mjs` lên **11 phép**. Phép 1 đổi bảng (`book_unlocks` → `books`, vì kệ nay
đọc từ bảng nội dung thật), 5 phép cũ còn lại giữ nguyên, thêm 5 phép:

| # | Khẳng định |
|---|---|
| 7 | `anon` **không** đọc được bản nháp (`published = false`) |
| 8 | `anon` **không** ghi được `user_roles` |
| 9 | `anon` **không** ghi được `books` |
| 10 | `authenticated` không phải admin **không** ghi được `books` — bị **policy** chặn, không phải thiếu GRANT. Phân biệt bằng message, không bằng sqlstate: Postgres trả chung `42501` cho cả hai. |
| 11 | `authenticated` **không** tự phong admin được (ghi `user_roles` dòng của chính mình) |

Phép 10 là phép quan trọng nhất của đợt này và là phép duy nhất cần một user thật: nó đi đúng
đường của kẻ tấn công **có tài khoản**. Nó **phải** thất bại vì policy chặn, không phải vì thiếu
GRANT — thiếu GRANT thì admin thật cũng không ghi được.

Hai trường hợp đó **không phân biệt được bằng sqlstate**: Postgres trả chung `42501` cho cả
"permission denied for table" (thiếu GRANT) lẫn "new row violates row-level security policy"
(policy chặn đúng). Đã kiểm thực nghiệm trên chính backend này ngày 2026-08-24. Bộ phân biệt
bắt buộc soi **message**, không soi mã lỗi.

Lấy phiên đăng nhập cho phép 10 và 11 ở đâu: luồng OTP cần một hộp thư thật nên không tự động hóa
được. Dùng đúng cách bản bàn giao đã ghi — tạo một tài khoản test bằng `auth.signUp` (email +
mật khẩu), rồi `UPDATE auth.users SET email_verified = true` qua MCP một lần; sau đó
`signInWithPassword` chạy được. Email + mật khẩu đó nằm ở `.env.local`
(`DB_CHECK_USER_EMAIL` / `DB_CHECK_USER_PASSWORD`), file đã bị gitignore.

Thiếu hai biến đó thì phép 10 và 11 **bỏ qua kèm cảnh báo to**, và script thoát mã 0. Cố ý: máy mới
clone vẫn chạy được 9 phép còn lại, nhưng dòng cảnh báo nói thẳng là hai hàng rào quan trọng nhất
đang không được kiểm. Bỏ qua im lặng thì tệ hơn không có phép nào.

Tính toàn vẹn nội dung không cần cổng JS nữa: chuỗi mở khóa không lưu nên không đứt được,
sách 0 trang bị RPC chặn, vật phẩm bị xóa oan bị `ON DELETE RESTRICT` chặn.

## 8. Bản đồ thế giới

`react-simple-maps@3.0.0` loại: peer dep chặn ở `react: ^16.8 || 17.x || 18.x`, dự án đang
React 19.2.8 (đã kiểm bằng `npm view`). Leaflet/MapLibre loại: cần tile server, và bản đồ tile
trông sai hoàn toàn so với thẩm mỹ thư viện cổ.

Dùng **`d3-geo` + `topojson-client`** + gói dữ liệu **`world-atlas`** (`countries-110m.json`),
tự sinh `<path>` SVG.

Tính đường path **ở server component**: `d3-geo` và ~100KB TopoJSON không bao giờ xuống trình
duyệt, client chỉ nhận chuỗi `d` và mã quốc gia. Client component chỉ lo hover, focus và điều hướng.

- Quốc gia có kệ đã xuất bản: tô màu giấy da, bấm được → `/[shelf]`.
- Còn lại: xám, `aria-hidden`, không nhận focus.
- Bàn phím: mỗi quốc gia có kệ là một `<a>` thật trong SVG, `tabIndex` mặc định, focus ring
  `ring-ring-on-dark` (nền bản đồ tối) theo `DESIGN.md`.
- `prefers-reduced-motion`: hiệu ứng hover chỉ đổi màu, không phóng to.

`app/lich-su-viet-nam/page.tsx` bị thay bằng `app/[shelf]/page.tsx`. `BookShelf` đã nhận
`shelfSlug` qua prop nên tầng component không chặn.

## 9. Seed

`content/shelves/lich-su-viet-nam.json` chuyển sang `db/seed/lich-su-viet-nam.json` và
`scripts/seed-content.mjs` sinh SQL `INSERT` cho `shelves` / `items` / `books` / `pages`,
chạy một lần qua MCP `run-raw-sql`.

Đây là **bootstrap một chiều, không phải nguồn sự thật**. Sau khi seed, DB là nguồn duy nhất;
file JSON chỉ còn để dựng lại DB dev từ số không. Ghi rõ điều đó ở đầu file seed để lần sau
không ai sửa JSON rồi tưởng nội dung đã đổi.

Cấp admin đầu tiên (không có luồng self-service):

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = '<email>'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

## 10. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Người dùng thường tự ghi nội dung | Policy `admin write` + `db:check` phép 10. |
| Người dùng tự phong admin | `user_roles` không có GRANT ghi cho `authenticated` + `db:check` phép 8 và 11. |
| Quyển nháp vẫn phát vật phẩm qua RPC | `AND published` trong `_complete_book_for` (RPC không chịu RLS). |
| Quyển 0 trang thành máy phát vật phẩm | `RAISE EXCEPTION` khi `page_count = 0`. |
| Xóa vật phẩm làm hở chuỗi mở khóa | `ON DELETE RESTRICT`. |
| Mất render tĩnh cho trang kệ | Chấp nhận: một truy vấn public rẻ, đổi lấy nội dung sửa xong thấy ngay. |
| `is_admin()` gọi trên mỗi dòng | Hàm `STABLE`, Postgres tính một lần cho mỗi truy vấn. |
| Dùng sai giấy phép ảnh | `*_source` + `*_credit` bắt buộc khi có ảnh, hiện ra trên giao diện. |

## 11. Bước tiếp theo

Chuyển sang skill `writing-plans`, viết kế hoạch triển khai vào
`docs/superpowers/plans/2026-08-24-noi-dung-dong-va-quan-tri-implementation.md`.

Kế hoạch chia làm 4 chặng, mỗi chặng phải để lại một cây build được và `npm run check` xanh:

| Chặng | Nội dung | Xong khi |
|---|---|---|
| A | Schema + RLS + RPC + seed + `db:check` 11 phép | `db:check` 11/11, trang kệ vẫn chạy như cũ nhưng đọc từ DB |
| B | Tầng dữ liệu ứng dụng: `lib/content/read.ts`, prop hóa reader, `app/[shelf]` | `npm run check` xanh, xóa `content-sync.mjs` + `book_unlocks` |
| C | Giao diện quản trị `/quan-tri` | Admin tạo được một quyển mới từ số không và học sinh đọc được nó |
| D | Bản đồ thế giới + ảnh thật + focus trap | Trang chủ là bản đồ, 5 quyển cũ có ảnh thật kèm credit |

Chặng A và B đi liền nhau (B không chạy được nếu A chưa xong). C và D độc lập với nhau.
