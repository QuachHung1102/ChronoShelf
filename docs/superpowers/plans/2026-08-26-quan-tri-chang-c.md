# Giao diện quản trị `/quan-tri` — Chặng C

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.


> ## ⚠️ NỀN TẢNG ĐÃ ĐỔI — ĐỌC TRƯỚC KHI THEO PLAN NÀY (2026-08-28)
>
> Plan này viết khi backend còn là InsForge. **InsForge đã bị bỏ.** Stack hiện tại là
> PostgreSQL 18 cục bộ + Sequelize + Next.js Route Handlers. Xem `CLAUDE.md` mục
> "Backend — PostgreSQL cục bộ" và `db/schema/README.md`.
>
> **Còn dùng được nguyên vẹn:** Task 2 (`slugify`/`uniqueSlug`), Task 4 (`controls.ts`) —
> cả hai là module thuần, không dính backend. Task 6–9 (giao diện `/quan-tri`) vẫn đúng về
> mặt UI và luồng biên tập.
>
> **Đã xong theo cách khác:** Task 1 (RPC đổi thứ tự) nay nằm ở `db/schema/08-reorder.sql`,
> không phải `2026-08-26-reorder-rpc.sql`; phần khẳng định cấu trúc chuyển sang
> `db/schema/90-verify.sql`, phần kiểm hành vi cần seed thì chưa viết.
>
> **Phải viết lại:** mọi chỗ nhắc `@insforge/sdk`, `insforge.database`, `insforge.auth`,
> MCP `run-raw-sql`, role `anon`/`authenticated`, `auth.uid()`, hay InsForge storage.
> Cụ thể: Task 3 (`isAdmin()` nay gọi `public.is_admin()` qua `withRole`), Task 5 (upload
> ảnh — InsForge storage không còn, phải lưu xuống đĩa).
>
> **Không còn đúng:** ràng buộc "toàn bộ giao diện quản trị chạy phía client" ở phần
> Architecture. Lý do của nó là phiên InsForge nằm ở localStorage nên server không đọc được.
> Nay phiên là cookie `httpOnly`, server component ĐỌC ĐƯỢC bản nháp (`readShelf` đã chạy
> dưới danh tính người xem). Quyết định lại khi tới Task 3.


**Goal:** Admin đăng nhập vào `/quan-tri` tạo được một kệ mới, một quyển sách mới, soạn các trang của nó, xuất bản — rồi học sinh đọc được quyển đó, tất cả mà không chạm vào SQL và không build lại.

**Architecture:** Toàn bộ giao diện quản trị chạy **phía client**. Lý do bắt buộc, không phải sở thích: backend không có `service_role`, quyền admin đến từ JWT, mà phiên InsForge nằm ở trình duyệt — server component dùng khóa anon không có phiên nên nó *không thể* đọc bản nháp hay ghi bất cứ thứ gì. Đây đúng là ranh giới `ShelfPageClient` đã dùng. Route file chỉ là vỏ mỏng bọc `<AdminGate>`. Hàng rào thật vẫn là RLS `admin write` ở tầng DB; `AdminGate` chỉ là cổng giao diện. Thêm hai RPC `reorder_books`/`reorder_pages` vì đổi thứ tự cần **một** transaction (ràng buộc `UNIQUE` là `DEFERRABLE INITIALLY DEFERRED`, mà PostgREST cho mỗi request một transaction riêng).

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2.8, TypeScript, Tailwind 3.4.17, `@insforge/sdk`, PostgreSQL qua InsForge, `node --test`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md` (§5 là phạm vi chính, §6 cho ảnh, §3.3 cho hàng rào ghi)

---

## Global Constraints

- **Tailwind CSS 3.4.17, không nâng lên v4.** InsForge yêu cầu, version pin cứng trong `package.json`.
- **Không hardcode mã hex trong component.** Chỉ dùng class Tailwind sinh từ `DESIGN.md`. Token có sẵn:
  - màu: `primary`, `primary-dark`, `secondary`, `secondary-light`, `tertiary`, `tertiary-deep`, `tertiary-light`, `neutral`, `surface`, `surface-shelf`, `surface-reader`, `surface-room`, `surface-locked`, `on-primary`, `ring`, `ring-on-dark`, `destructive`, `on-destructive`
  - spacing: `xs`, `sm`, `md`, `lg`, `xl`, `page-margin`, `shelf-gap`, `header-height`
  - font-size: `headline-lg`, `headline-md`, `headline-sm`, `title-book`, `body-md`, `body-sm`, `label-md`, `label-caps`, `caption`, `body-book`, `drop-cap`
  - radius: `none`, `sm`, `md`, `lg`, `full`
  - Cần token mới thì sửa `DESIGN.md` rồi chạy `npm run design:build`. **Không sửa `tailwind.theme.json` bằng tay** — nó là file sinh ra.
- **Tailwind là chính; SCSS chỉ cho phần phải code tay** (`@keyframes`, gradient/`box-shadow` tùy biến, kích thước ngoài thang spacing). Trong SCSS lấy màu bằng `theme('colors.tertiary / 55%')`, không viết hex.
- **Không dùng emoji làm icon.** Dùng `lucide-react`.
- **Logic mở khóa và trao vật phẩm chỉ ở phía server**, trong hàm Postgres `SECURITY DEFINER`. Chặng này KHÔNG được thêm INSERT/UPDATE trực tiếp lên `user_items` hay cột `user_book_progress.completed` cho `authenticated`.
- **Không có ô nhập "vật phẩm cần để mở."** Nó suy ra từ vị trí (quyển `i` mở bằng vật phẩm thưởng của quyển `i-1`), hiện ra dạng **đọc-thôi**. Spec §2.2.
- **Ảnh bắt buộc có `*_source` + `*_credit`.** Đây là điều kiện của giấy phép CC BY-SA, không phải thủ tục thừa. Spec §6.
- **Không cài Vitest/Jest.** Test là `node --test` của Node 24, chỉ chạy được trên module **thuần, import tương đối** (alias `@/` không resolve dưới test runner của Node). File test import nhau bằng đuôi `.ts` thật. Xem mục "Test — cố tình rất ít" trong `CLAUDE.md`.
- **Cổng duy nhất là `npm run check`.** Đừng bịa tổ hợp lệnh khác. `npm run db:check` chạy sau mỗi lần đổi `db/schema/`.
- **Trước khi viết code InsForge, gọi MCP `fetch-docs`.** API đổi thường xuyên.
- **MCP `run-raw-sql` từ chối `BEGIN;`/`COMMIT;`** và thỉnh thoảng trả `Changing SQL session configuration is not allowed` với batch lớn — lỗi đó **không tất định**, cứ chạy lại, đừng chia nhỏ file.

## Thứ tự chạy — KHÔNG phải thứ tự đánh số

Task 4 (`components/ui/controls.ts`) chạy **trước** Task 3. Lý do: `AdminGate` và
`AdminShell` ở Task 3 cần đúng chuỗi class focus-ring mà Task 4 đặt tên là
`FOCUS_RING` — viết thẳng chuỗi đó vào Task 3 rồi để Task 4 tạo hằng ngay sau là tự
tay tạo hai bản của cùng một thứ, mà không có bước nào quay lại gộp chúng.

Thứ tự thực thi: **2 → 4 → 3 → 5 → 1 → 6 → 7 → 8 → 9 → 10.**
(Task 1 là DDL, chỉ cần xong trước Task 8 — task đầu tiên gọi RPC đổi thứ tự.)

Trong Task 3, `AdminGate` và `AdminShell` import `FOCUS_RING` từ
`components/ui/controls.ts` thay vì viết lại chuỗi `focus-visible:…`.

## Điều kiện tiên quyết

Backend InsForge phải sống. Ngày 2026-08-26 nó đang trả `No backend services available for app: pk3kdyx2`, và MCP server `insforge` không kết nối được. Task 1 và mọi bước kiểm tay đều **chặn cứng** cho tới khi nó trở lại. Task 2, 3, 4, 5 (phần thuần) viết được ngoại tuyến.

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `db/schema/2026-08-26-reorder-rpc.sql` | Hai RPC đổi thứ tự + khối tự kiểm. Nguồn sự thật cho DDL. |
| `lib/admin/slug.ts` | `slugify` + `uniqueSlug`. **Thuần, import tương đối** — test được. |
| `lib/admin/slug.test.ts` | Test `node --test` cho hai hàm trên. |
| `lib/admin/gate.ts` | `isAdmin()` — hỏi RPC `is_admin`. |
| `lib/admin/shelves.ts` | Đọc/ghi `shelves` phía client (thấy cả bản nháp). |
| `lib/admin/items.ts` | Đọc/ghi `items`. |
| `lib/admin/books.ts` | Đọc/ghi `books`, gọi `reorder_books`. |
| `lib/admin/pages.ts` | Đọc/ghi `pages`, gọi `reorder_pages`. |
| `lib/insforge/storage.ts` | `uploadImage(bucket, file)` → URL công khai. Chỗ DUY NHẤT chạm storage. |
| `components/ui/controls.ts` | Hằng class dùng chung cho form (`FIELD`, `PRIMARY_BUTTON`, `QUIET_BUTTON`, `DANGER_BUTTON`, `LABEL`). Rút từ `LoginForm`. |
| `components/admin/AdminGate.tsx` | Cổng giao diện: đang tải / không có quyền / cho vào. |
| `components/admin/AdminShell.tsx` | Khung chung: `Header` + breadcrumb + tiêu đề. |
| `components/admin/ImageField.tsx` | Upload ảnh + hai ô `source`/`credit` bắt buộc khi có ảnh. |
| `components/admin/RowActions.tsx` | Cụm nút ▲ ▼ Sửa Xóa dùng lại cho mọi danh sách. |
| `components/admin/ShelfAdmin.tsx` | Màn `/quan-tri`: danh sách + form kệ. |
| `components/admin/ItemAdmin.tsx` | Màn `/quan-tri/vat-pham`. |
| `components/admin/BookAdmin.tsx` | Màn `/quan-tri/[shelf]`: sách trong kệ, đổi thứ tự, chuỗi mở khóa đọc-thôi. |
| `components/admin/PageAdmin.tsx` | Màn `/quan-tri/[shelf]/[book]`: soạn trang + xem trước. |
| `app/quan-tri/page.tsx` | Vỏ route. |
| `app/quan-tri/vat-pham/page.tsx` | Vỏ route. |
| `app/quan-tri/[shelf]/page.tsx` | Vỏ route. |
| `app/quan-tri/[shelf]/[book]/page.tsx` | Vỏ route. |

**Sửa:** `lib/content/types.ts`, `lib/content/read.ts`, `components/reader/BookPage.tsx`, `components/reader/ItemDropOverlay.tsx`, `components/auth/LoginForm.tsx`, `components/auth/AuthMenu.tsx`, `CLAUDE.md`.

## Ba quyết định đi lệch khỏi spec §5 — đọc trước khi bắt đầu

1. **Đổi thứ tự bằng nút ▲/▼, không phải kéo-thả.** Spec §5 viết "kéo đổi thứ tự". Kéo-thả cần thêm thư viện hoặc một mớ HTML5 DnD viết tay, và nó hỏng trên bàn phím lẫn màn hình cảm ứng. Hai cái nút làm đúng việc đó với 0 dependency và dùng được bằng bàn phím. `ponytail:` trần của lựa chọn này là danh sách rất dài; đường nâng cấp là gắn `@dnd-kit/sortable` vào đúng chỗ gọi `reorder*` đã có.
2. **Không có ô upload ảnh bìa kệ và ảnh bìa sách trong chặng này.** Đã kiểm bằng grep: `ContentBook.cover` được `read.ts` đọc lên nhưng **không component nào render nó** — bìa sách vẽ hoàn toàn bằng CSS trong `BookCover.module.scss`. Còn bảng `shelves` **không có** cột `cover_source`/`cover_credit`, nên upload vào `shelves.cover_url` sẽ tạo ra một tấm ảnh không có chỗ ghi giấy phép — vi phạm §6. Cả hai thuộc chặng D, cùng lúc với ảnh thật.
3. **Chọn quốc gia bằng ô nhập mã ISO-3166-1 numeric, không phải bấm trên bản đồ.** Bản đồ là chặng D; ô nhập là thứ dùng được ngay và chặng D thay nó bằng cách gắn thêm chỗ chọn, không phải viết lại.

---

### Task 1: Hai RPC đổi thứ tự

Đổi chỗ hai quyển sách cần **một** transaction. `books_shelf_position_key` là `UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY DEFERRED` — bên trong một transaction thì trạng thái trung gian trùng vị trí là hợp lệ, ràng buộc chỉ kiểm lúc commit. Nhưng PostgREST cho **mỗi request một transaction riêng**, nên hai lần `UPDATE` qua SDK sẽ vỡ ngay ở lần đầu. Một hàm Postgres giải quyết trọn: một transaction, một round-trip, và vị trí luôn được ghi lại thành `1..n` sạch sẽ.

Hàm để **`SECURITY INVOKER`** (mặc định, tức là *không* viết `SECURITY DEFINER`). Đây là điểm bảo mật của cả task: hàm chạy bằng quyền người gọi nên RLS `admin write` vẫn áp lên `UPDATE` bên trong. Người đã đăng nhập nhưng không phải admin sẽ update trúng 0 dòng, và khẳng định `ROW_COUNT` biến việc đó thành exception.

**Files:**
- Create: `db/schema/2026-08-26-reorder-rpc.sql`

**Interfaces:**
- Consumes: bảng `public.books`, `public.pages` từ `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql`.
- Produces: `public.reorder_books(p_shelf_slug text, p_slugs text[]) RETURNS void`, `public.reorder_pages(p_book_slug text, p_ids uuid[]) RETURNS void`. Cả hai EXECUTE chỉ cấp cho `authenticated`.

- [ ] **Step 1: Viết khối tự kiểm vào file (đây là "test" của tầng DB — viết trước DDL)**

Tạo `db/schema/2026-08-26-reorder-rpc.sql` với đúng nội dung này:

```sql
-- Đổi thứ tự sách và trang — RPC.
-- Chạy qua MCP `run-raw-sql`. File này là nguồn sự thật, backend không tự version.
-- Spec: docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md §5
--
-- LÝ DO TỒN TẠI: `books_shelf_position_key` và `pages_book_position_key` là
-- DEFERRABLE INITIALLY DEFERRED, nên đổi chỗ hai dòng chỉ hợp lệ khi cả hai UPDATE
-- nằm TRONG CÙNG một transaction. PostgREST cho mỗi request một transaction riêng
-- nên hai lần .update() qua SDK vỡ ngay ở lần đầu. Một hàm là một transaction.
--
-- BẢO MẬT: hai hàm này CỐ Ý KHÔNG PHẢI `SECURITY DEFINER`. Chạy bằng quyền người
-- gọi thì policy "admin write" vẫn áp lên UPDATE bên trong; người đã đăng nhập mà
-- không phải admin sẽ trúng 0 dòng và khẳng định ROW_COUNT dưới đây ném lỗi.
-- Đổi thành SECURITY DEFINER là mở toang quyền sửa nội dung cho mọi tài khoản.

-- === TỰ KIỂM ===
DO $$
DECLARE
  v_pos_1 integer;
  v_pos_2 integer;
  v_msg   text;
BEGIN
  -- 1. Hàm phải tồn tại và KHÔNG được là SECURITY DEFINER.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'reorder_books' AND NOT p.prosecdef) THEN
    RAISE EXCEPTION 'reorder_books thiếu, hoặc là SECURITY DEFINER — RLS "admin write" sẽ bị bỏ qua';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'reorder_pages' AND NOT p.prosecdef) THEN
    RAISE EXCEPTION 'reorder_pages thiếu, hoặc là SECURITY DEFINER — RLS "admin write" sẽ bị bỏ qua';
  END IF;

  -- 2. anon không được gọi; authenticated phải gọi được (RLS mới là hàng rào).
  IF has_function_privilege('anon', 'public.reorder_books(text, text[])', 'EXECUTE')
  OR has_function_privilege('anon', 'public.reorder_pages(text, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon gọi được RPC đổi thứ tự';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.reorder_books(text, text[])', 'EXECUTE')
  OR NOT has_function_privilege('authenticated', 'public.reorder_pages(text, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated không gọi được RPC đổi thứ tự — admin thật cũng không đổi được';
  END IF;

  -- 3. Đổi chỗ thật hai quyển đầu kệ rồi trả về như cũ. Khối DO này chạy bằng quyền
  --    admin của MCP nên RLS không cản — đây là phép kiểm CHỨC NĂNG, không phải quyền.
  SELECT position INTO v_pos_1 FROM public.books WHERE slug = 'khoi-nguon-bo-coi';
  SELECT position INTO v_pos_2 FROM public.books WHERE slug = 'tran-chien-bach-dang-938';
  IF v_pos_1 IS NULL OR v_pos_2 IS NULL THEN
    RAISE EXCEPTION 'thiếu sách seed để kiểm — chạy npm run seed:content trước';
  END IF;

  PERFORM public.reorder_books(
    'lich-su-viet-nam',
    ARRAY(SELECT slug FROM public.books
           WHERE shelf_slug = 'lich-su-viet-nam'
           ORDER BY CASE slug
                      WHEN 'khoi-nguon-bo-coi'          THEN 2
                      WHEN 'tran-chien-bach-dang-938'   THEN 1
                      ELSE position + 100 END));

  IF (SELECT position FROM public.books WHERE slug = 'tran-chien-bach-dang-938') <> 1 THEN
    RAISE EXCEPTION 'đổi chỗ không có tác dụng — vị trí quyển Bạch Đằng vẫn là %',
      (SELECT position FROM public.books WHERE slug = 'tran-chien-bach-dang-938');
  END IF;

  -- 4. Gửi thiếu quyển phải bị từ chối, nếu không vị trí sẽ đụng nhau âm thầm.
  BEGIN
    PERFORM public.reorder_books('lich-su-viet-nam', ARRAY['khoi-nguon-bo-coi']);
    RAISE EXCEPTION 'gửi danh sách thiếu mà vẫn ghi được';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE '%TOÀN BỘ%' THEN RAISE; END IF;
  END;

  -- 5. Trả lại thứ tự ban đầu.
  PERFORM public.reorder_books(
    'lich-su-viet-nam',
    ARRAY(SELECT slug FROM public.books
           WHERE shelf_slug = 'lich-su-viet-nam'
           ORDER BY CASE slug
                      WHEN 'khoi-nguon-bo-coi'        THEN 1
                      WHEN 'tran-chien-bach-dang-938' THEN 2
                      ELSE position + 100 END));
  IF (SELECT position FROM public.books WHERE slug = 'khoi-nguon-bo-coi') <> v_pos_1 THEN
    RAISE EXCEPTION 'không khôi phục được thứ tự ban đầu';
  END IF;

  RAISE NOTICE 'Task 1 OK';
END $$;
```

- [ ] **Step 2: Chạy file qua MCP `run-raw-sql` để thấy nó HỎNG**

Đưa toàn bộ nội dung file cho MCP tool `run-raw-sql`.
Kỳ vọng: `EXCEPTION` với message `reorder_books thiếu, hoặc là SECURITY DEFINER…`.
Thấy `Task 1 OK` ở bước này nghĩa là khối tự kiểm sai — sửa nó trước khi đi tiếp.

- [ ] **Step 3: Thêm DDL vào file, phía TRÊN khối tự kiểm**

Chèn ngay sau khối chú thích đầu file, trước dòng `-- === TỰ KIỂM ===`:

```sql
CREATE OR REPLACE FUNCTION public.reorder_books(p_shelf_slug text, p_slugs text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE v_updated integer;
BEGIN
  -- Phải nhận TOÀN BỘ kệ. Danh sách thiếu sẽ đẩy vài quyển vào đúng vị trí mà một
  -- quyển không nằm trong danh sách đang giữ — hợp lệ ở giữa transaction, vỡ lúc
  -- commit, và thông báo lỗi của Postgres lúc đó chẳng nói được gì cho admin.
  IF EXISTS (SELECT 1 FROM public.books
              WHERE shelf_slug = p_shelf_slug AND NOT (slug = ANY(p_slugs))) THEN
    RAISE EXCEPTION 'reorder_books: phải gửi TOÀN BỘ quyển của kệ %', p_shelf_slug;
  END IF;

  UPDATE public.books b
     SET position = x.ord
    FROM unnest(p_slugs) WITH ORDINALITY AS x(slug, ord)
   WHERE b.slug = x.slug AND b.shelf_slug = p_shelf_slug;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  -- Không phải khẳng định phòng xa: hàm này SECURITY INVOKER nên với người không
  -- phải admin, policy "admin write" làm UPDATE trúng 0 dòng mà KHÔNG báo lỗi.
  -- Dòng này là thứ biến "im lặng không làm gì" thành một lỗi nhìn thấy được.
  IF v_updated <> coalesce(array_length(p_slugs, 1), 0) THEN
    RAISE EXCEPTION 'reorder_books: nhận % slug nhưng chỉ ghi được % dòng (thiếu quyền, hoặc slug sai kệ)',
      coalesce(array_length(p_slugs, 1), 0), v_updated;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reorder_pages(p_book_slug text, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE v_updated integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.pages
              WHERE book_slug = p_book_slug AND NOT (id = ANY(p_ids))) THEN
    RAISE EXCEPTION 'reorder_pages: phải gửi TOÀN BỘ trang của quyển %', p_book_slug;
  END IF;

  UPDATE public.pages p
     SET position = x.ord
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
   WHERE p.id = x.id AND p.book_slug = p_book_slug;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> coalesce(array_length(p_ids, 1), 0) THEN
    RAISE EXCEPTION 'reorder_pages: nhận % id nhưng chỉ ghi được % dòng (thiếu quyền, hoặc id sai quyển)',
      coalesce(array_length(p_ids, 1), 0), v_updated;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.reorder_books(text, text[]) FROM public, anon;
REVOKE ALL ON FUNCTION public.reorder_pages(text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reorder_books(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_pages(text, uuid[]) TO authenticated;
```

- [ ] **Step 4: Chạy lại cả file qua MCP `run-raw-sql`**

Kỳ vọng: `NOTICE: Task 1 OK`.
Gặp `Changing SQL session configuration is not allowed` thì **chạy lại nguyên văn** — đó là flakiness phía proxy, batch hỏng roll back sạch nên retry an toàn. Đừng chia nhỏ file.

- [ ] **Step 5: Chạy `npm run db:check`**

Run: `npm run db:check`
Kỳ vọng: đúng số phép như trước khi bắt đầu task này, không phép nào mới hỏng. Task này không đổi bảng nào nên con số phải giữ nguyên.

- [ ] **Step 6: Commit**

```bash
git add db/schema/2026-08-26-reorder-rpc.sql
git commit -m "feat(db): RPC reorder_books/reorder_pages, mot transaction cho doi thu tu"
```

---

### Task 2: `slugify` + `uniqueSlug` (module thuần, có test)

Admin gõ "Trận chiến Bạch Đằng 938", hệ thống phải sinh `tran-chien-bach-dang-938`. Đây là logic thuần, import tương đối — đúng loại module `node --test` chạy được, nên nó có test thật.

Chú ý một bẫy Unicode: `đ` **không** tách được bằng NFD (nó là một ký tự riêng, không phải `d` + dấu), nên chỉ `normalize("NFD")` rồi lọc dấu là ra `đ` nguyên vẹn rồi bị `[^a-z0-9]` nuốt mất. Phải thay `đ`/`Đ` bằng tay.

**Files:**
- Create: `lib/admin/slug.ts`
- Test: `lib/admin/slug.test.ts`

**Interfaces:**
- Consumes: không gì.
- Produces: `slugify(input: string): string`, `uniqueSlug(base: string, taken: Set<string>): string`.

- [x] **Step 1: Viết test hỏng**

Tạo `lib/admin/slug.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "./slug.ts";

test("bỏ dấu tiếng Việt, giữ số", () => {
  assert.equal(slugify("Trận chiến Bạch Đằng 938"), "tran-chien-bach-dang-938");
});

test("chữ đ không tách được bằng NFD nên phải thay riêng", () => {
  assert.equal(slugify("Đường mòn"), "duong-mon");
});

test("gộp mọi khoảng trắng và dấu câu thành một gạch nối", () => {
  assert.equal(slugify("Nhà  Trần —  thế kỷ XIII!"), "nha-tran-the-ky-xiii");
});

test("không để gạch nối thừa ở hai đầu", () => {
  assert.equal(slugify("  ...Hào khí Đông A...  "), "hao-khi-dong-a");
});

test("chuỗi không còn ký tự nào dùng được thì trả về rỗng", () => {
  assert.equal(slugify("!!! ???"), "");
});

test("slug chưa ai dùng thì giữ nguyên", () => {
  assert.equal(uniqueSlug("bach-dang", new Set()), "bach-dang");
});

test("trùng thì thêm hậu tố số, đếm từ 2", () => {
  assert.equal(uniqueSlug("bach-dang", new Set(["bach-dang"])), "bach-dang-2");
});

test("nhảy qua mọi hậu tố đã bị chiếm", () => {
  assert.equal(
    uniqueSlug("bach-dang", new Set(["bach-dang", "bach-dang-2", "bach-dang-3"])),
    "bach-dang-4",
  );
});
```

- [x] **Step 2: Chạy test để thấy nó hỏng**

Run: `npm test`
Kỳ vọng: FAIL, `Cannot find module` cho `./slug.ts`.

- [x] **Step 3: Viết `lib/admin/slug.ts`**

```ts
/**
 * Sinh slug từ tiêu đề admin gõ vào. Thuần, import tương đối — đó là điều kiện để
 * `node --test` chạy được nó (alias `@/` không resolve dưới test runner của Node),
 * và cũng là lý do file này tách khỏi `lib/admin/shelves.ts`.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Dải dấu kết hợp U+0300–U+036F — sau NFD thì "ạ" thành "a" + U+0323.
    // Viết bằng escape chứ không phải ký tự thô: ký tự kết hợp là VÔ HÌNH trong hầu
    // hết editor, nên một lần copy-paste hỏng sẽ không ai nhìn ra.
    .replace(/[\u0300-\u036f]/g, "")
    // `đ` KHÔNG tách được bằng NFD: nó là ký tự riêng chứ không phải d + dấu, nên
    // không có dòng này thì "Bạch Đằng" ra "bach-ng" — chữ đ bị lọc mất luôn.
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug là khóa chính nên phải duy nhất. `taken` là tập slug đang có, do phía gọi
 * đọc từ database — hàm này không chạm mạng để test được.
 *
 * ponytail: đếm tuyến tính, đủ cho vài trăm quyển. Nhiều hơn thì để database tự lo
 * bằng cách bắt lỗi trùng khóa chính và thử lại.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
```

- [x] **Step 4: Chạy test để thấy nó xanh**

Run: `npm test`
Kỳ vọng: PASS, tổng số test tăng thêm 8.

- [x] **Step 5: Commit**

```bash
git add lib/admin/slug.ts lib/admin/slug.test.ts
git commit -m "feat(admin): slugify tieng Viet + uniqueSlug, co test node --test"
```

---

### Task 3: Cổng admin — `isAdmin()`, `AdminGate`, `AdminShell`, route `/quan-tri`

Kết thúc task này, `/quan-tri` tồn tại: người lạ thấy "Bạn không có quyền vào khu vực này", admin thấy một trang trống có tiêu đề. Đây là deliverable nhìn thấy được đầu tiên.

Đây là **cổng giao diện, không phải hàng rào bảo mật** — hàng rào là RLS `admin write` ở §3.3. Ai đó chỉnh state React để lọt qua `AdminGate` vẫn không ghi được gì.

Có một cái bẫy route: `/quan-tri` và `/[shelf]` cùng khớp đường dẫn `/quan-tri`. Next ưu tiên segment tĩnh nên `/quan-tri` thắng — nghĩa là một kệ mang slug `quan-tri` sẽ vĩnh viễn không vào được. Form kệ ở Task 6 phải cấm slug đó.

**Files:**
- Create: `lib/admin/gate.ts`, `components/admin/AdminGate.tsx`, `components/admin/AdminShell.tsx`, `app/quan-tri/page.tsx`
- Modify: `components/auth/AuthMenu.tsx`

**Interfaces:**
- Consumes: `insforge` từ `lib/insforge/client.ts`; `getSignedInUser`, `onAuthChange` từ `lib/insforge/auth.ts`; `readShelfList` không dùng ở đây (client component không gọi được nó — nó là server-side).
- Produces: `isAdmin(): Promise<boolean>`; `<AdminGate>{children}</AdminGate>`; `<AdminShell title crumbs>{children}</AdminShell>` với `crumbs: { href: string; label: string }[]`.

- [ ] **Step 1: Gọi MCP `fetch-docs` với `"db-sdk-typescript"`**

Cần xác nhận đúng chữ ký `insforge.database.rpc()` cho hàm **không có tham số**. `lib/insforge/shelf.ts` đang gọi `rpc("complete_book", { p_book_slug })`; chưa có tiền lệ gọi hàm 0 tham số trong repo. Đọc docs rồi mới viết Step 2.

- [ ] **Step 2: Viết `lib/admin/gate.ts`**

```ts
import { insforge } from "@/lib/insforge/client";

/**
 * Cổng GIAO DIỆN, không phải hàng rào bảo mật. Hàng rào thật là policy "admin write"
 * ở db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql — người lách được hàm này vẫn
 * không ghi nổi một dòng nào.
 *
 * `is_admin()` là SECURITY DEFINER và đã GRANT EXECUTE cho cả anon lẫn authenticated;
 * với anon thì `auth.uid()` là NULL nên nó luôn trả false. Vì vậy không cần kiểm
 * đăng-nhập-chưa trước khi gọi.
 *
 * Lỗi mạng trả về false: thà chặn nhầm một admin (họ tải lại trang) còn hơn mở nhầm
 * một màn hình quản trị vì backend chớp một cái.
 */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await insforge.database.rpc("is_admin", {});
  if (error) return false;
  return data === true;
}
```

- [ ] **Step 3: Viết `components/admin/AdminGate.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { isAdmin } from "@/lib/admin/gate";
import { onAuthChange } from "@/lib/insforge/auth";

/**
 * Ba trạng thái, không phải hai: "chưa biết" phải khác "không có quyền", nếu không
 * mỗi lần vào trang admin sẽ chớp một nhịp chữ "Bạn không có quyền" rồi mới đổi.
 *
 * Nghe `onAuthChange` vì đăng nhập ở header không đổi route — không có nó thì admin
 * vừa đăng nhập xong vẫn nhìn màn hình từ chối cho tới khi tự tải lại trang.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      isAdmin()
        .catch(() => false)
        .then((ok) => {
          if (alive) setAllowed(ok);
        });
    void load();
    const unsubscribe = onAuthChange(() => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  if (allowed === null) {
    return (
      <p className="px-page-margin py-xl font-body text-body-md text-secondary">Đang kiểm tra quyền…</p>
    );
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-start gap-md px-page-margin py-xl">
        <ShieldAlert aria-hidden className="h-8 w-8 text-tertiary-deep" />
        <h1 className="font-heading text-headline-md text-primary-dark">
          Bạn không có quyền vào khu vực này
        </h1>
        <p className="font-body text-body-md text-secondary">
          Khu vực quản trị chỉ dành cho tài khoản admin. Nếu bạn là admin, hãy đăng nhập
          bằng đúng tài khoản đó.
        </p>
        <Link
          href="/dang-nhap?next=%2Fquan-tri"
          className="rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
        >
          Đăng nhập
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 4: Viết `components/admin/AdminShell.tsx`**

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Khung chung của mọi màn quản trị: breadcrumb + tiêu đề. Không gọi `Header` — route
 * file lo phần đó, vì `Header` cần `shelves` mà chỉ server component đọc được.
 */
export function AdminShell({
  title,
  crumbs = [],
  children,
}: {
  title: string;
  crumbs?: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="px-page-margin py-xl">
      <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-xs">
        {crumbs.map((crumb) => (
          <span key={crumb.href} className="flex items-center gap-xs">
            <Link
              href={crumb.href}
              className="font-body text-body-sm text-tertiary-deep underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
            >
              {crumb.label}
            </Link>
            <ChevronRight aria-hidden className="h-4 w-4 text-secondary" />
          </span>
        ))}
        <span className="font-body text-body-sm text-secondary">{title}</span>
      </nav>
      <h1 className="mt-sm font-heading text-headline-md text-primary-dark">{title}</h1>
      <div className="mt-lg">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Viết `app/quan-tri/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { readShelfList } from "@/lib/content/read";

export const metadata: Metadata = { title: "Quản trị — Cửa Sổ Lịch Sử" };

// Cùng lý do với `/` và `/[shelf]`: danh sách kệ là dữ liệu runtime.
export const dynamic = "force-dynamic";

export default async function QuanTriPage() {
  const shelves = await readShelfList();
  return (
    <>
      <Header activeHref="/quan-tri" shelves={shelves} />
      <main className="flex-1">
        <AdminGate>
          <AdminShell title="Kệ sách">
            <p className="font-body text-body-md text-secondary">Danh sách kệ sẽ nằm ở đây.</p>
          </AdminShell>
        </AdminGate>
      </main>
    </>
  );
}
```

- [ ] **Step 6: Thêm lối vào `/quan-tri` trong `components/auth/AuthMenu.tsx`**

Trong `AuthMenu`, thêm state `admin` và gọi `isAdmin()` trong cùng hàm `load` đã có. Sửa `useEffect` hiện tại:

```tsx
// thêm import
import { isAdmin } from "@/lib/admin/gate";
import { LogOut, Settings, UserRound } from "lucide-react";

// thêm state cạnh `user` và `ready`
const [admin, setAdmin] = useState(false);

// trong useEffect, thay thân hàm `load`:
const load = () =>
  Promise.all([getSignedInUser().catch(() => null), isAdmin().catch(() => false)])
    .then(([signedIn, isAdminNow]) => {
      if (!alive) return;
      setUser(signedIn);
      setAdmin(isAdminNow);
      setReady(true);
    });
```

Rồi trong nhánh đã đăng nhập, chèn ngay trước nút đăng xuất:

```tsx
{admin && (
  <Link
    href="/quan-tri"
    className={`flex items-center gap-xs text-on-primary transition-colors duration-200 ease-out hover:text-tertiary-light ${FOCUS_ON_DARK}`}
  >
    <Settings aria-hidden className="h-5 w-5" />
    <span className="font-body text-label-md">Quản trị</span>
  </Link>
)}
```

- [ ] **Step 7: Chạy cổng**

Run: `npm run check`
Kỳ vọng: xanh, và route mới `/quan-tri` xuất hiện trong bảng route với dấu `ƒ`.

- [ ] **Step 8: Kiểm bằng tay**

Run: `npm run dev`
1. Chưa đăng nhập, mở `/quan-tri` → thấy "Bạn không có quyền vào khu vực này" và nút Đăng nhập.
2. Đăng nhập bằng tài khoản thường (`DB_CHECK_USER_EMAIL` trong `.env.local`) → vẫn thấy màn từ chối, và header **không** có mục "Quản trị".
3. Đăng nhập bằng tài khoản admin → thấy tiêu đề "Kệ sách", header có mục "Quản trị".
4. Đang ở màn từ chối mà đăng nhập admin ở header → màn hình tự đổi, không cần tải lại.

- [ ] **Step 9: Commit**

```bash
git add lib/admin/gate.ts components/admin/AdminGate.tsx components/admin/AdminShell.tsx app/quan-tri/page.tsx components/auth/AuthMenu.tsx
git commit -m "feat(admin): cong /quan-tri — isAdmin, AdminGate, AdminShell, loi vao o header"
```

---

### Task 4: Rút hằng class form ra dùng chung

`LoginForm` đang giữ `FIELD`, `PRIMARY_BUTTON`, `QUIET_BUTTON` ở đầu file. Chặng này thêm bốn màn hình toàn form; chép ba khối chuỗi đó bốn lần là cách chắc chắn nhất để bốn màn hình lệch nhau dần. Rút ra một file, `LoginForm` import ngược lại — không thêm giao diện mới nào, chỉ đổi chỗ ở.

**Files:**
- Create: `components/ui/controls.ts`
- Modify: `components/auth/LoginForm.tsx:8-27`

**Interfaces:**
- Consumes: không gì.
- Produces: hằng chuỗi `FIELD`, `PRIMARY_BUTTON`, `QUIET_BUTTON`, `DANGER_BUTTON`, `LABEL`, `FOCUS_RING`.

- [x] **Step 1: Tạo `components/ui/controls.ts`**

```ts
/**
 * Class Tailwind dùng chung cho form. Rút ra khỏi `LoginForm` khi chặng C thêm bốn
 * màn hình toàn form — chép chuỗi qua từng file là cách chắc chắn nhất để chúng lệch
 * nhau dần.
 *
 * Chỉ hằng chuỗi, không component: một `<Input>` bọc sẵn sẽ phải mọc prop cho từng
 * thứ HTML đã làm được (`type`, `pattern`, `inputMode`, `maxLength`…). Chuỗi class
 * không có bề mặt đó.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-neutral";

export const LABEL = "font-body text-label-md text-primary-dark";

export const FIELD =
  "w-full rounded-md bg-surface px-md py-sm font-body text-body-md text-primary-dark " +
  `placeholder:text-secondary ${FOCUS_RING}`;

export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm " +
  "font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 " +
  `disabled:opacity-60 ${FOCUS_RING}`;

export const QUIET_BUTTON =
  "inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep " +
  `underline underline-offset-2 disabled:opacity-60 ${FOCUS_RING}`;

export const DANGER_BUTTON =
  "inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-destructive " +
  `underline underline-offset-2 disabled:opacity-60 ${FOCUS_RING}`;
```

- [x] **Step 2: Sửa `components/auth/LoginForm.tsx`**

Xóa ba khối hằng `FIELD`, `PRIMARY_BUTTON`, `QUIET_BUTTON` ở đầu file (dòng 8-27) và thay bằng:

```ts
import { FIELD, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";
```

Phần JSX **không đổi một ký tự nào** — tên hằng giữ nguyên. Hai `<label>` đang viết class thẳng thì đổi sang `className={LABEL}` và thêm `LABEL` vào danh sách import.

- [x] **Step 3: Chạy cổng và so bằng mắt**

Run: `npm run check`
Kỳ vọng: xanh.
Rồi `npm run dev`, mở `/dang-nhap`: trang phải trông **y hệt** trước khi sửa. Task này không được đổi một pixel nào.

- [x] **Step 4: Commit**

```bash
git add components/ui/controls.ts components/auth/LoginForm.tsx
git commit -m "refactor(ui): rut hang class form ra components/ui/controls.ts"
```

---

### Task 5: Upload ảnh + hiện credit

Hai nửa của cùng một việc, cố ý không tách: nửa đầu cho admin **gắn** ảnh vào nội dung, nửa sau **hiện giấy phép** của ảnh đó ra cho người đọc. Tách ra thì nửa đầu ship trước sẽ tạo ra đúng một vi phạm CC BY-SA cho tới khi nửa sau ship.

Đã kiểm bằng grep: hôm nay không có chỗ nào trong ứng dụng đọc `image_source`/`image_credit`. Ảnh trang hiện ở `BookPage`, ảnh vật phẩm hiện ở `ItemDropOverlay` — đó là hai chỗ duy nhất cần thêm dòng credit. Ảnh bìa sách (`books.cover_url`) **không được render ở đâu cả** nên không nằm trong task này.

Ba bucket đã tồn tại và đều public: `book-covers`, `page-images`, `item-images`.

**Files:**
- Create: `lib/insforge/storage.ts`, `components/admin/ImageField.tsx`
- Modify: `lib/content/types.ts`, `lib/content/read.ts:20-22,30-36,60-66,72-80,96-102`, `components/reader/BookPage.tsx`, `components/reader/ItemDropOverlay.tsx`

**Interfaces:**
- Consumes: `insforge` từ `lib/insforge/client.ts`; `FIELD`, `LABEL`, `QUIET_BUTTON` từ `components/ui/controls.ts`.
- Produces:
  - `uploadImage(bucket: "book-covers" | "page-images" | "item-images", file: File): Promise<string>` — trả URL công khai, ném `Error` khi hỏng.
  - `ImageValue = { url: string | null; source: string | null; credit: string | null }` — khai báo trong `lib/insforge/storage.ts`, KHÔNG trong component: `lib/admin/*` cần nó và tầng lib không được import ngược lên `components/`.
  - `<ImageField value={imageValue} onChange={(next) => …} bucket label />`.
  - `imageFieldError(value: ImageValue): string | null` — `null` nghĩa là hợp lệ; form gọi nó trước khi lưu.
  - `ContentPage` và `ContentItem` thêm `imageSource: string | null` và `imageCredit: string | null`.

- [ ] **Step 1: Gọi MCP `fetch-docs` với `"storage-sdk"`**

Bắt buộc — đây là chỗ duy nhất trong cả plan chạm storage, và API đổi thường xuyên. Cần biết chính xác: tên method upload, hình dạng `{ data, error }` trả về, và cách lấy URL công khai sau khi upload.

- [ ] **Step 2: Viết `lib/insforge/storage.ts`**

Thân hàm viết **theo docs vừa đọc ở Step 1** — đừng viết theo trí nhớ. Chữ ký và phần xử lý lỗi thì cố định như dưới đây, vì cả plan còn lại chỉ phụ thuộc vào chữ ký này:

```ts
import { insforge } from "./client";

export type ImageBucket = "book-covers" | "page-images" | "item-images";

/**
 * Ba cột `*_url` / `*_source` / `*_credit` luôn đi với nhau nên đi chung một kiểu.
 * Kiểu này nằm ở tầng `lib` chứ không trong component: `lib/admin/items.ts` và
 * `lib/admin/pages.ts` đều cần nó, mà tầng lib import ngược lên `components/` là
 * chiều phụ thuộc sai.
 */
export interface ImageValue {
  url: string | null;
  source: string | null;
  credit: string | null;
}

/** 5 MB. Ảnh minh họa bài học không cần lớn hơn, và giới hạn ở đây rẻ hơn ở backend. */
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

/**
 * Đẩy một file lên bucket rồi trả về URL công khai để ghi vào cột `*_url`.
 *
 * Chỗ DUY NHẤT trong ứng dụng chạm storage. Kiểm kiểu và kích thước ngay đây chứ
 * không ở component: đây là ranh giới tin cậy, và có bốn form sẽ gọi nó.
 */
export async function uploadImage(bucket: ImageBucket, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error(`Chỉ nhận ảnh JPEG, PNG, WebP hoặc SVG — file này là ${file.type || "không rõ"}.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Ảnh nặng ${Math.round(file.size / 1024 / 1024)} MB, tối đa 5 MB.`);
  }

  // Tên file giữ phần đuôi để trình duyệt đoán đúng kiểu; phần đầu thay bằng thời
  // điểm upload để hai admin cùng đẩy "anh.jpg" không đè lên nhau.
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  // ↓↓↓ Phần này viết theo docs `storage-sdk` đọc ở Step 1, KHÔNG theo trí nhớ. ↓↓↓
  // Kết quả cần: một URL công khai dạng chuỗi, gán vào `publicUrl`.
  // Lỗi thì `throw new Error("Không tải được ảnh lên: " + <message>)`.
  const publicUrl = "";
  // ↑↑↑

  if (!publicUrl) throw new Error("Không tải được ảnh lên: backend không trả về URL.");
  return publicUrl;
}
```

- [ ] **Step 3: Viết `components/admin/ImageField.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { uploadImage, type ImageBucket, type ImageValue } from "@/lib/insforge/storage";
import { FIELD, LABEL, DANGER_BUTTON } from "@/components/ui/controls";

export type { ImageValue };

/**
 * `null` nghĩa là hợp lệ. Không có ảnh cũng hợp lệ — chỉ khi CÓ ảnh thì nguồn và
 * tác giả mới bắt buộc, vì đó là điều kiện của giấy phép CC BY-SA (spec §6), không
 * phải thủ tục thừa.
 *
 * Tách ra khỏi component để form gọi được trước khi lưu: `required` trên input chỉ
 * chặn khi người dùng bấm submit, còn form ở đây lưu bằng nút riêng.
 */
export function imageFieldError(value: ImageValue): string | null {
  if (!value.url) return null;
  if (!value.source?.trim()) return "Có ảnh thì bắt buộc điền nguồn (URL trang gốc).";
  if (!value.credit?.trim()) return "Có ảnh thì bắt buộc điền tác giả + giấy phép.";
  return null;
}

export function ImageField({
  value,
  onChange,
  bucket,
  label,
}: {
  value: ImageValue;
  onChange: (next: ImageValue) => void;
  bucket: ImageBucket;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange({ ...value, url: await uploadImage(bucket, file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được ảnh lên.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-sm rounded-md bg-surface p-md">
      <legend className={LABEL}>{label}</legend>

      {value.url && (
        <div className="flex items-start gap-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL runtime từ bucket, không qua loader */}
          <img src={value.url} alt="" className="h-24 w-24 rounded-sm object-cover" />
          <button
            type="button"
            onClick={() => onChange({ url: null, source: null, credit: null })}
            className={DANGER_BUTTON}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
            Gỡ ảnh
          </button>
        </div>
      )}

      <label className="inline-flex w-fit cursor-pointer items-center gap-xs font-body text-body-sm text-tertiary-deep underline underline-offset-2">
        <ImagePlus aria-hidden className="h-4 w-4" />
        {busy ? "Đang tải lên…" : value.url ? "Đổi ảnh khác" : "Chọn ảnh"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="sr-only"
          disabled={busy}
          onChange={(event) => void pick(event.target.files?.[0])}
        />
      </label>

      {value.url && (
        <>
          <label className={LABEL} htmlFor={`${bucket}-source`}>
            Nguồn ảnh — URL trang gốc (bắt buộc)
          </label>
          <input
            id={`${bucket}-source`}
            type="url"
            required
            placeholder="https://commons.wikimedia.org/wiki/File:..."
            value={value.source ?? ""}
            onChange={(event) => onChange({ ...value, source: event.target.value })}
            className={FIELD}
          />

          <label className={LABEL} htmlFor={`${bucket}-credit`}>
            Tác giả + giấy phép (bắt buộc)
          </label>
          <input
            id={`${bucket}-credit`}
            type="text"
            required
            placeholder="Nguyễn Văn A, CC BY-SA 4.0"
            value={value.credit ?? ""}
            onChange={(event) => onChange({ ...value, credit: event.target.value })}
            className={FIELD}
          />
          <p className="font-body text-caption text-secondary">
            Hai ô này là điều kiện của giấy phép CC BY-SA, không phải thủ tục thừa —
            chúng hiện ra dưới ảnh cho người đọc.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-destructive p-sm font-body text-body-sm text-on-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 4: Thêm hai trường vào `lib/content/types.ts`**

Trong `ContentItem`, ngay sau `image`:

```ts
  /** Bắt buộc khi có ảnh — điều kiện của CC BY-SA (spec §6). */
  imageSource: string | null;
  imageCredit: string | null;
```

Trong `ContentPage`, ngay sau `image`: chèn đúng hai dòng đó (kèm chú thích).

- [ ] **Step 5: Sửa `lib/content/read.ts` để đọc hai cột mới**

Bốn chỗ:

```ts
// 1. PAGE_SELECT
const PAGE_SELECT = "position, heading, body, image_url, image_source, image_credit, caption, summary";

// 2. interface PageRow — thêm sau image_url
  image_source: string | null;
  image_credit: string | null;

// 3. interface ItemRow — thêm sau image_url
  image_source: string | null;
  image_credit: string | null;

// 4. truy vấn items trong readShelf
    insforge.database.from("items").select("slug, name, description, image_url, image_source, image_credit"),
```

Rồi trong `toPage` và `toItem`, thêm vào object trả về:

```ts
    imageSource: row.image_source,
    imageCredit: row.image_credit,
```

- [ ] **Step 6: Hiện credit trong `components/reader/BookPage.tsx`**

Trong khối `<figure>`, thay `figcaption` hiện tại bằng:

```tsx
          {(page.caption || page.imageCredit) && (
            <figcaption className="font-body text-caption text-secondary">
              {page.caption && <span className="italic">{page.caption}</span>}
              {page.caption && page.imageCredit && " — "}
              {page.imageCredit && (
                <span>
                  Ảnh:{" "}
                  {page.imageSource ? (
                    <a
                      href={page.imageSource}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {page.imageCredit}
                    </a>
                  ) : (
                    page.imageCredit
                  )}
                </span>
              )}
            </figcaption>
          )}
```

- [ ] **Step 7: Hiện credit trong `components/reader/ItemDropOverlay.tsx`**

Ngay sau đoạn `{item.description}`, thêm:

```tsx
            {item.imageCredit && (
              <p className="mt-xs font-body text-caption text-secondary">
                Ảnh:{" "}
                {item.imageSource ? (
                  <a href={item.imageSource} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {item.imageCredit}
                  </a>
                ) : (
                  item.imageCredit
                )}
              </p>
            )}
```

- [ ] **Step 8: Chạy cổng**

Run: `npm run check`
Kỳ vọng: xanh. `tsc` sẽ bắt mọi chỗ tạo `ContentPage`/`ContentItem` mà quên hai trường mới — sửa hết trước khi đi tiếp.

- [ ] **Step 9: Commit**

```bash
git add lib/insforge/storage.ts components/admin/ImageField.tsx lib/content/types.ts lib/content/read.ts components/reader/BookPage.tsx components/reader/ItemDropOverlay.tsx
git commit -m "feat(admin): upload anh len bucket + hien credit CC BY-SA cho nguoi doc"
```

---

### Task 6: Quản lý kệ — `/quan-tri`

**Files:**
- Create: `lib/admin/fail.ts`, `lib/admin/shelves.ts`, `components/admin/ShelfAdmin.tsx`, `components/admin/RowActions.tsx`
- Modify: `app/quan-tri/page.tsx`

**Interfaces:**
- Consumes: `slugify`, `uniqueSlug` từ `lib/admin/slug.ts`; hằng từ `components/ui/controls.ts`; `AdminShell`.
- Produces:
  - `AdminShelf = { slug: string; name: string; position: number; countryCode: string | null; blurb: string; published: boolean; bookCount: number }`
  - `listShelves(): Promise<AdminShelf[]>`
  - `createShelf(input: { name: string; slug: string; countryCode: string | null; blurb: string }): Promise<void>`
  - `updateShelf(slug: string, patch: Partial<Omit<AdminShelf, "slug" | "bookCount">>): Promise<void>`
  - `deleteShelf(slug: string): Promise<void>`
  - `<RowActions onUp onDown onEdit onDelete disabledUp disabledDown busy />` — bốn callback không tham số, ba boolean.

- [ ] **Step 1: Viết `lib/admin/fail.ts`**

Bốn file `lib/admin/*.ts` đều cần đúng một hàm này. Chép nguyên văn bốn lần là cách
chắc chắn nhất để bốn thông báo lỗi lệch nhau dần.

```ts
/**
 * Biến `{ data, error }` của SDK thành exception có ngữ cảnh. Mọi hàm trong
 * `lib/admin/*` đi qua đây để thông báo lỗi tới tay admin luôn có dạng
 * "<việc đang làm>: <lời backend nói>".
 */
export function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message ? `${fallback}: ${error.message}` : fallback);
}
```

- [ ] **Step 1b: Viết `lib/admin/shelves.ts`**

```ts
import { insforge } from "@/lib/insforge/client";
import { fail } from "./fail";

/**
 * Đọc/ghi bảng `shelves` cho màn quản trị. Chạy PHÍA CLIENT — bắt buộc, không phải
 * tiện tay: bản nháp chỉ hiện ra với admin, mà quyền admin đến từ JWT, mà phiên
 * InsForge nằm ở trình duyệt. Server component dùng khóa anon không có phiên nên
 * `readShelf`/`readShelfList` trong `lib/content/read.ts` vĩnh viễn không thấy nháp.
 */
export interface AdminShelf {
  slug: string;
  name: string;
  position: number;
  countryCode: string | null;
  blurb: string;
  published: boolean;
  bookCount: number;
}

/** Segment tĩnh của app sẽ nuốt mất kệ mang slug này — Next ưu tiên route tĩnh. */
export const RESERVED_SLUGS = new Set(["quan-tri", "dang-nhap"]);

export async function listShelves(): Promise<AdminShelf[]> {
  const { data, error } = await insforge.database
    .from("shelves")
    .select("slug, name, position, country_code, blurb, published, books(slug)")
    .order("position");
  if (error) fail(error, "Không đọc được danh sách kệ");

  type Row = {
    slug: string;
    name: string;
    position: number;
    country_code: string | null;
    blurb: string;
    published: boolean;
    books: { slug: string }[] | null;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    position: row.position,
    countryCode: row.country_code,
    blurb: row.blurb,
    published: row.published,
    bookCount: row.books?.length ?? 0,
  }));
}

export async function createShelf(input: {
  name: string;
  slug: string;
  countryCode: string | null;
  blurb: string;
}): Promise<void> {
  // Vị trí mới = cuối danh sách. Đọc rồi ghi nên về lý thuyết có cửa sổ đua; một
  // admin thao tác một lúc thì không chạm tới, và nếu chạm thì `shelves_position_key`
  // ném lỗi trùng chứ không ghi sai âm thầm.
  // ponytail: đọc-rồi-ghi. Nhiều admin cùng lúc thì chuyển sang RPC tính max trong DB.
  const existing = await listShelves();
  const position = existing.reduce((max, s) => Math.max(max, s.position), 0) + 1;

  const { error } = await insforge.database.from("shelves").insert([
    {
      slug: input.slug,
      name: input.name,
      position,
      country_code: input.countryCode || null,
      blurb: input.blurb,
      published: false,
    },
  ]);
  if (error) fail(error, "Không tạo được kệ");
}

export async function updateShelf(
  slug: string,
  patch: Partial<Omit<AdminShelf, "slug" | "bookCount">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.position !== undefined) row.position = patch.position;
  if (patch.countryCode !== undefined) row.country_code = patch.countryCode || null;
  if (patch.blurb !== undefined) row.blurb = patch.blurb;
  if (patch.published !== undefined) row.published = patch.published;

  const { error } = await insforge.database.from("shelves").update(row).eq("slug", slug);
  if (error) fail(error, "Không lưu được kệ");
}

/** Xóa kệ kéo theo sách và trang của nó (ON DELETE CASCADE). Không hoàn tác được. */
export async function deleteShelf(slug: string): Promise<void> {
  const { error } = await insforge.database.from("shelves").delete().eq("slug", slug);
  if (error) fail(error, "Không xóa được kệ");
}
```

- [ ] **Step 2: Viết `components/admin/RowActions.tsx`**

```tsx
"use client";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { FOCUS_RING } from "@/components/ui/controls";

const ICON_BUTTON =
  `inline-flex h-8 w-8 items-center justify-center rounded-sm text-secondary ` +
  `transition-colors duration-200 ease-out hover:text-primary-dark ` +
  `disabled:opacity-40 disabled:hover:text-secondary ${FOCUS_RING}`;

/**
 * ▲/▼ thay cho kéo-thả. Spec §5 viết "kéo đổi thứ tự"; hai cái nút làm đúng việc đó
 * mà không thêm dependency nào, và dùng được bằng bàn phím lẫn màn hình cảm ứng —
 * kéo-thả HTML5 hỏng ở cả hai.
 *
 * ponytail: trần là danh sách rất dài (đưa một quyển từ cuối lên đầu tốn n cú bấm).
 * Đường nâng cấp: gắn @dnd-kit/sortable vào đúng chỗ đang gọi reorder*, không phải
 * viết lại tầng dữ liệu.
 */
export function RowActions({
  onUp,
  onDown,
  onEdit,
  onDelete,
  disabledUp,
  disabledDown,
  busy,
}: {
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  disabledUp: boolean;
  disabledDown: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-xs">
      <button type="button" onClick={onUp} disabled={disabledUp || busy} className={ICON_BUTTON}>
        <ChevronUp aria-hidden className="h-4 w-4" />
        <span className="sr-only">Lên trên</span>
      </button>
      <button type="button" onClick={onDown} disabled={disabledDown || busy} className={ICON_BUTTON}>
        <ChevronDown aria-hidden className="h-4 w-4" />
        <span className="sr-only">Xuống dưới</span>
      </button>
      <button type="button" onClick={onEdit} disabled={busy} className={ICON_BUTTON}>
        <Pencil aria-hidden className="h-4 w-4" />
        <span className="sr-only">Sửa</span>
      </button>
      <button type="button" onClick={onDelete} disabled={busy} className={`${ICON_BUTTON} hover:text-destructive`}>
        <Trash2 aria-hidden className="h-4 w-4" />
        <span className="sr-only">Xóa</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Viết `components/admin/ShelfAdmin.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  createShelf,
  deleteShelf,
  listShelves,
  updateShelf,
  RESERVED_SLUGS,
  type AdminShelf,
} from "@/lib/admin/shelves";
import { slugify, uniqueSlug } from "@/lib/admin/slug";
import { FIELD, LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";
import { RowActions } from "./RowActions";

const EMPTY = { name: "", slug: "", countryCode: "", blurb: "" };

export function ShelfAdmin() {
  const [shelves, setShelves] = useState<AdminShelf[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    () =>
      listShelves()
        .then(setShelves)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Không tải được danh sách kệ.")),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const name = draft.name.trim();
    if (!name) {
      setError("Tên kệ không được để trống.");
      return;
    }
    const slug = draft.slug.trim() || uniqueSlug(slugify(name), new Set(shelves.map((s) => s.slug)));
    if (RESERVED_SLUGS.has(slug)) {
      setError(`"${slug}" là đường dẫn của hệ thống — chọn slug khác, nếu không kệ này sẽ không mở được.`);
      return;
    }
    void run(async () => {
      if (editing) {
        await updateShelf(editing, {
          name,
          countryCode: draft.countryCode.trim() || null,
          blurb: draft.blurb,
        });
      } else {
        await createShelf({
          name,
          slug,
          countryCode: draft.countryCode.trim() || null,
          blurb: draft.blurb,
        });
      }
      setDraft(EMPTY);
      setEditing(null);
    });
  }

  // Đổi chỗ hai kệ: `shelves_position_key` là DEFERRABLE nhưng PostgREST cho mỗi
  // request một transaction, nên đi vòng qua một vị trí tạm âm — không có RPC riêng
  // cho `shelves` vì số kệ rất ít và thao tác này hiếm.
  // ponytail: ba round-trip cho một lần đổi chỗ. Đủ với vài chục kệ; nhiều hơn thì
  // thêm reorder_shelves giống hai RPC ở db/schema/2026-08-26-reorder-rpc.sql.
  function move(index: number, delta: number) {
    const a = shelves[index];
    const b = shelves[index + delta];
    if (!a || !b) return;
    void run(async () => {
      await updateShelf(a.slug, { position: -1 });
      await updateShelf(b.slug, { position: a.position });
      await updateShelf(a.slug, { position: b.position });
    });
  }

  return (
    <div className="flex flex-col gap-xl">
      <section className="flex flex-col gap-md rounded-md bg-surface p-lg">
        <h2 className="font-heading text-headline-sm text-primary-dark">
          {editing ? `Sửa kệ "${editing}"` : "Thêm kệ mới"}
        </h2>

        <label className={LABEL} htmlFor="shelf-name">Tên kệ</label>
        <input
          id="shelf-name"
          className={FIELD}
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="Lịch sử Việt Nam"
        />

        {!editing && (
          <>
            <label className={LABEL} htmlFor="shelf-slug">
              Slug (bỏ trống để sinh tự động từ tên)
            </label>
            <input
              id="shelf-slug"
              className={FIELD}
              value={draft.slug}
              onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
              placeholder={draft.name ? slugify(draft.name) : "lich-su-viet-nam"}
            />
          </>
        )}

        <label className={LABEL} htmlFor="shelf-country">
          Mã quốc gia ISO-3166-1 numeric (704 = Việt Nam) — để trống nếu chưa gắn bản đồ
        </label>
        <input
          id="shelf-country"
          className={FIELD}
          inputMode="numeric"
          value={draft.countryCode}
          onChange={(event) => setDraft({ ...draft, countryCode: event.target.value.replace(/\D/g, "") })}
          placeholder="704"
        />

        <label className={LABEL} htmlFor="shelf-blurb">Mô tả ngắn</label>
        <textarea
          id="shelf-blurb"
          className={`${FIELD} min-h-24`}
          value={draft.blurb}
          onChange={(event) => setDraft({ ...draft, blurb: event.target.value })}
        />

        <div className="flex items-center gap-md">
          <button type="button" onClick={save} disabled={busy} className={PRIMARY_BUTTON}>
            <Plus aria-hidden className="h-4 w-4" />
            {editing ? "Lưu thay đổi" : "Tạo kệ"}
          </button>
          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setDraft(EMPTY);
              }}
              className={QUIET_BUTTON}
            >
              Hủy
            </button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        {shelves.map((shelf, index) => (
          <div
            key={shelf.slug}
            className="flex flex-wrap items-center justify-between gap-md rounded-md bg-surface p-md"
          >
            <div className="flex flex-col gap-xs">
              <Link
                href={`/quan-tri/${shelf.slug}`}
                className="font-heading text-headline-sm text-primary-dark underline underline-offset-4"
              >
                {shelf.name}
              </Link>
              <p className="font-body text-caption text-secondary">
                /{shelf.slug} · {shelf.bookCount} quyển ·{" "}
                {shelf.published ? "đã xuất bản" : "bản nháp"}
                {shelf.countryCode ? ` · mã quốc gia ${shelf.countryCode}` : ""}
              </p>
              {shelf.published && shelf.bookCount === 0 && (
                <p className="font-body text-caption text-destructive">
                  Kệ đã xuất bản nhưng chưa có quyển nào — học sinh sẽ thấy một kệ trống.
                </p>
              )}
            </div>

            <div className="flex items-center gap-md">
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => updateShelf(shelf.slug, { published: !shelf.published }))}
                className={QUIET_BUTTON}
              >
                {shelf.published ? "Gỡ xuất bản" : "Xuất bản"}
              </button>
              <RowActions
                busy={busy}
                disabledUp={index === 0}
                disabledDown={index === shelves.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                onEdit={() => {
                  setEditing(shelf.slug);
                  setDraft({
                    name: shelf.name,
                    slug: shelf.slug,
                    countryCode: shelf.countryCode ?? "",
                    blurb: shelf.blurb,
                  });
                }}
                onDelete={() => {
                  if (
                    !window.confirm(
                      `Xóa kệ "${shelf.name}"? ${shelf.bookCount} quyển sách và toàn bộ trang của chúng sẽ mất theo. Không hoàn tác được.`,
                    )
                  )
                    return;
                  void run(() => deleteShelf(shelf.slug));
                }}
              />
            </div>
          </div>
        ))}

        {shelves.length === 0 && (
          <p className="font-body text-body-md text-secondary">Chưa có kệ nào.</p>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-destructive p-md font-body text-body-sm text-on-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Nối vào `app/quan-tri/page.tsx`**

Thay khối `<p>Danh sách kệ sẽ nằm ở đây.</p>` bằng `<ShelfAdmin />` và thêm import `import { ShelfAdmin } from "@/components/admin/ShelfAdmin";`.

- [ ] **Step 5: Chạy cổng**

Run: `npm run check`
Kỳ vọng: xanh.

- [ ] **Step 6: Kiểm bằng tay**

Run: `npm run dev`, đăng nhập admin, mở `/quan-tri`.
1. Tạo kệ "Lịch sử thế giới" bỏ trống slug → slug tự sinh `lich-su-the-gioi`, trạng thái "bản nháp".
2. Mở `/lich-su-the-gioi` ở tab ẩn danh → 404 (chưa xuất bản, RLS chặn). Đây là phép kiểm RLS thật.
3. Bấm "Xuất bản" → mở lại tab ẩn danh, trang hiện ra với kệ rỗng.
4. Thử tạo kệ có slug `quan-tri` → bị chặn kèm giải thích.
5. Bấm ▲/▼ đổi thứ tự hai kệ → thứ tự đổi, và nav trên `Header` đổi theo sau khi tải lại.
6. Xóa kệ vừa tạo → biến mất.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/shelves.ts components/admin/RowActions.tsx components/admin/ShelfAdmin.tsx app/quan-tri/page.tsx
git commit -m "feat(admin): man /quan-tri — them, sua, doi thu tu, xuat ban, xoa ke"
```

---

### Task 7: Quản lý vật phẩm — `/quan-tri/vat-pham`

Làm trước sách vì form sách cần chọn vật phẩm thưởng từ danh sách này.

**Files:**
- Create: `lib/admin/items.ts`, `components/admin/ItemAdmin.tsx`, `app/quan-tri/vat-pham/page.tsx`

**Interfaces:**
- Consumes: `ImageField`, `imageFieldError` từ `components/admin/ImageField.tsx`; `ImageValue` từ `lib/insforge/storage.ts`; `slugify`/`uniqueSlug`; hằng controls.
- Produces:
  - `AdminItem = { slug: string; name: string; description: string; image: ImageValue; usedByBooks: string[] }`
  - `listItems(): Promise<AdminItem[]>`, `createItem(...)`, `updateItem(...)`, `deleteItem(slug)`

- [ ] **Step 1: Viết `lib/admin/items.ts`**

```ts
import { insforge } from "@/lib/insforge/client";
import { fail } from "./fail";
import type { ImageValue } from "@/lib/insforge/storage";

export interface AdminItem {
  slug: string;
  name: string;
  description: string;
  image: ImageValue;
  /** Slug những quyển đang lấy vật phẩm này làm phần thưởng — xóa sẽ bị FK chặn. */
  usedByBooks: string[];
}

export async function listItems(): Promise<AdminItem[]> {
  const [itemsRes, booksRes] = await Promise.all([
    insforge.database
      .from("items")
      .select("slug, name, description, image_url, image_source, image_credit")
      .order("slug"),
    insforge.database.from("books").select("slug, reward_item_slug"),
  ]);
  if (itemsRes.error) fail(itemsRes.error, "Không đọc được danh sách vật phẩm");
  if (booksRes.error) fail(booksRes.error, "Không đọc được danh sách sách");

  type ItemRow = {
    slug: string;
    name: string;
    description: string;
    image_url: string | null;
    image_source: string | null;
    image_credit: string | null;
  };
  const books = (booksRes.data ?? []) as { slug: string; reward_item_slug: string | null }[];

  return ((itemsRes.data ?? []) as ItemRow[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: { url: row.image_url, source: row.image_source, credit: row.image_credit },
    usedByBooks: books.filter((b) => b.reward_item_slug === row.slug).map((b) => b.slug),
  }));
}

export async function createItem(input: {
  slug: string;
  name: string;
  description: string;
  image: ImageValue;
}): Promise<void> {
  const { error } = await insforge.database.from("items").insert([
    {
      slug: input.slug,
      name: input.name,
      description: input.description,
      image_url: input.image.url,
      image_source: input.image.source,
      image_credit: input.image.credit,
    },
  ]);
  if (error) fail(error, "Không tạo được vật phẩm");
}

export async function updateItem(
  slug: string,
  input: { name: string; description: string; image: ImageValue },
): Promise<void> {
  const { error } = await insforge.database
    .from("items")
    .update({
      name: input.name,
      description: input.description,
      image_url: input.image.url,
      image_source: input.image.source,
      image_credit: input.image.credit,
    })
    .eq("slug", slug);
  if (error) fail(error, "Không lưu được vật phẩm");
}

/**
 * `books.reward_item_slug` là ON DELETE RESTRICT — cố ý. SET NULL sẽ âm thầm mở toang
 * quyển kế tiếp cho tất cả mọi người. Nên hàm này HỎNG khi vật phẩm còn được dùng, và
 * giao diện phải nói rõ quyển nào đang giữ nó.
 */
export async function deleteItem(slug: string): Promise<void> {
  const { error } = await insforge.database.from("items").delete().eq("slug", slug);
  if (error) fail(error, "Không xóa được vật phẩm");
}
```

- [ ] **Step 2: Viết `components/admin/ItemAdmin.tsx`**

Cấu trúc y hệt `ShelfAdmin`: state `items`/`draft`/`editing`/`busy`/`error`, hàm `reload`, hàm `run`, form ở trên, danh sách ở dưới. Khác bốn chỗ:

1. Form có thêm `<ImageField value={draft.image} onChange={(image) => setDraft({ ...draft, image })} bucket="item-images" label="Ảnh vật phẩm" />`.
2. Trước khi lưu, chặn bằng `imageFieldError`:

```tsx
const imageError = imageFieldError(draft.image);
if (imageError) {
  setError(imageError);
  return;
}
```

3. Không có ▲/▼ — vật phẩm không có cột `position`. Dùng nút Sửa và Xóa rời, không dùng `RowActions`.
4. Nút Xóa kiểm trước khi gọi:

```tsx
onClick={() => {
  if (item.usedByBooks.length > 0) {
    setError(
      `Không xóa được "${item.name}": ${item.usedByBooks.length} quyển đang lấy nó làm phần thưởng ` +
        `(${item.usedByBooks.join(", ")}). Đổi phần thưởng của những quyển đó trước.`,
    );
    return;
  }
  if (!window.confirm(`Xóa vật phẩm "${item.name}"?`)) return;
  void run(() => deleteItem(item.slug));
}}
```

Mỗi dòng danh sách hiện: ảnh nhỏ (nếu có), tên, slug, mô tả, và khi `usedByBooks.length > 0` thì một dòng `text-caption text-secondary` ghi "Phần thưởng của: …".

- [ ] **Step 3: Viết `app/quan-tri/vat-pham/page.tsx`**

Sao đúng khuôn `app/quan-tri/page.tsx`: `metadata` title `"Vật phẩm — Quản trị"`, `export const dynamic = "force-dynamic"`, `<Header activeHref="/quan-tri" shelves={shelves} />`, `<AdminGate><AdminShell title="Vật phẩm" crumbs={[{ href: "/quan-tri", label: "Quản trị" }]}><ItemAdmin /></AdminShell></AdminGate>`.

- [ ] **Step 4: Thêm liên kết tới `/quan-tri/vat-pham` trong `AdminShell`**

Trong `AdminShell`, ngay dưới `<h1>`, thêm một hàng liên kết ngang giữa hai khu:

```tsx
      <div className="mt-sm flex gap-md">
        <Link href="/quan-tri" className="font-body text-body-sm text-tertiary-deep underline underline-offset-2">
          Kệ sách
        </Link>
        <Link href="/quan-tri/vat-pham" className="font-body text-body-sm text-tertiary-deep underline underline-offset-2">
          Vật phẩm
        </Link>
      </div>
```

- [ ] **Step 5: Chạy cổng**

Run: `npm run check`
Kỳ vọng: xanh.

- [ ] **Step 6: Kiểm bằng tay**

1. Tạo vật phẩm mới không ảnh → lưu được.
2. Tạo vật phẩm có ảnh nhưng bỏ trống nguồn → bị chặn kèm lý do.
3. Điền đủ nguồn + tác giả → lưu được, ảnh hiện trong danh sách.
4. Thử xóa `trong-dong` (đang là phần thưởng của `khoi-nguon-bo-coi`) → bị chặn, thông báo nêu đúng tên quyển.

- [ ] **Step 7: Commit**

```bash
git add lib/admin/items.ts components/admin/ItemAdmin.tsx app/quan-tri/vat-pham/page.tsx components/admin/AdminShell.tsx
git commit -m "feat(admin): man /quan-tri/vat-pham — CRUD vat pham kem anh co credit"
```

---

### Task 8: Quản lý sách trong kệ — `/quan-tri/[shelf]`

Màn hình có sức nặng nhất: đổi thứ tự (gọi RPC ở Task 1), chọn vật phẩm thưởng, xuất bản có điều kiện, và **chuỗi mở khóa hiện ra dạng đọc-thôi**.

Chuỗi mở khóa suy ra từ vị trí, không lưu ở đâu cả (spec §2.2). Quyển đầu kệ luôn mở; quyển `i` mở bằng vật phẩm thưởng của quyển `i-1`; quyển `i-1` không thưởng gì thì quyển `i` không có cổng. Logic đó đã nằm ở `resolveState` trong `lib/insforge/unlock.ts` — màn này chỉ **mô tả** nó bằng chữ, không tính lại.

**Files:**
- Create: `lib/admin/books.ts`, `components/admin/BookAdmin.tsx`, `app/quan-tri/[shelf]/page.tsx`

**Interfaces:**
- Consumes: `listItems` từ `lib/admin/items.ts`; `slugify`/`uniqueSlug`; `RowActions`; hằng controls.
- Produces:
  - `AdminBook = { slug: string; title: string; era: string; position: number; rewardItemSlug: string | null; published: boolean; pageCount: number }`
  - `listBooks(shelfSlug): Promise<AdminBook[]>`, `createBook(...)`, `updateBook(...)`, `deleteBook(slug)`, `reorderBooks(shelfSlug, slugsInOrder)`

- [ ] **Step 1: Viết `lib/admin/books.ts`**

```ts
import { insforge } from "@/lib/insforge/client";
import { fail } from "./fail";

export interface AdminBook {
  slug: string;
  title: string;
  era: string;
  position: number;
  rewardItemSlug: string | null;
  published: boolean;
  pageCount: number;
}

export async function listBooks(shelfSlug: string): Promise<AdminBook[]> {
  const { data, error } = await insforge.database
    .from("books")
    .select("slug, title, era, position, reward_item_slug, published, pages(id)")
    .eq("shelf_slug", shelfSlug)
    .order("position");
  if (error) fail(error, "Không đọc được danh sách sách");

  type Row = {
    slug: string;
    title: string;
    era: string;
    position: number;
    reward_item_slug: string | null;
    published: boolean;
    pages: { id: string }[] | null;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    slug: row.slug,
    title: row.title,
    era: row.era,
    position: row.position,
    rewardItemSlug: row.reward_item_slug,
    published: row.published,
    pageCount: row.pages?.length ?? 0,
  }));
}

export async function createBook(input: {
  shelfSlug: string;
  slug: string;
  title: string;
  era: string;
}): Promise<void> {
  // ponytail: đọc-rồi-ghi để lấy vị trí cuối. Cùng đánh đổi với createShelf.
  const existing = await listBooks(input.shelfSlug);
  const position = existing.reduce((max, b) => Math.max(max, b.position), 0) + 1;

  const { error } = await insforge.database.from("books").insert([
    {
      slug: input.slug,
      shelf_slug: input.shelfSlug,
      position,
      title: input.title,
      era: input.era,
      published: false,
    },
  ]);
  if (error) fail(error, "Không tạo được quyển sách");
}

export async function updateBook(
  slug: string,
  patch: { title?: string; era?: string; rewardItemSlug?: string | null; published?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.era !== undefined) row.era = patch.era;
  if (patch.rewardItemSlug !== undefined) row.reward_item_slug = patch.rewardItemSlug;
  if (patch.published !== undefined) row.published = patch.published;

  const { error } = await insforge.database.from("books").update(row).eq("slug", slug);
  if (error) fail(error, "Không lưu được quyển sách");
}

export async function deleteBook(slug: string): Promise<void> {
  const { error } = await insforge.database.from("books").delete().eq("slug", slug);
  if (error) fail(error, "Không xóa được quyển sách");
}

/**
 * Một round-trip, một transaction. Bắt buộc phải đi qua RPC: ràng buộc
 * `books_shelf_position_key` là DEFERRABLE INITIALLY DEFERRED, nghĩa là trạng thái
 * trung gian trùng vị trí chỉ hợp lệ TRONG một transaction — mà PostgREST cho mỗi
 * request một transaction riêng, nên hai lần `.update()` vỡ ngay ở lần đầu.
 *
 * Phải gửi TOÀN BỘ slug của kệ theo đúng thứ tự mong muốn; hàm SQL từ chối danh
 * sách thiếu. Xem db/schema/2026-08-26-reorder-rpc.sql.
 */
export async function reorderBooks(shelfSlug: string, slugsInOrder: string[]): Promise<void> {
  const { error } = await insforge.database.rpc("reorder_books", {
    p_shelf_slug: shelfSlug,
    p_slugs: slugsInOrder,
  });
  if (error) fail(error as { message?: string }, "Không đổi được thứ tự");
}
```

- [ ] **Step 2: Viết `components/admin/BookAdmin.tsx`**

Khuôn giống `ShelfAdmin`, thêm bốn thứ riêng:

**a. Nạp thêm danh sách vật phẩm** để đổ vào `<select>` phần thưởng:

```tsx
const [items, setItems] = useState<AdminItem[]>([]);
useEffect(() => {
  listItems().then(setItems).catch(() => setItems([]));
}, []);
```

**b. Đổi thứ tự bằng RPC** — hoán vị trong mảng rồi gửi cả danh sách:

```tsx
function move(index: number, delta: number) {
  const next = [...books];
  const target = index + delta;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target], next[index]];
  void run(() => reorderBooks(shelfSlug, next.map((b) => b.slug)));
}
```

**c. Chuỗi mở khóa đọc-thôi.** Dưới mỗi dòng sách, hiện đúng một câu — mô tả lại quy tắc, không có ô nhập nào:

```tsx
function unlockLine(books: AdminBook[], index: number, items: AdminItem[]): string {
  if (index === 0) return "Mở sẵn — quyển đầu kệ.";
  const prev = books[index - 1];
  if (!prev.rewardItemSlug)
    return `Mở sẵn — quyển "${prev.title}" ngay trước không thưởng vật phẩm nào.`;
  const item = items.find((i) => i.slug === prev.rewardItemSlug);
  return `Mở bằng: ${item?.name ?? prev.rewardItemSlug} — thưởng của quyển ${index} ("${prev.title}").`;
}
```

Hiện nó kèm chú thích một lần ở đầu danh sách:

```tsx
<p className="font-body text-body-sm text-secondary">
  Chuỗi mở khóa suy ra từ thứ tự, không có ô nào để nhập: quyển sau mở bằng vật phẩm
  thưởng của quyển ngay trước. Đổi thứ tự hoặc đổi phần thưởng là chuỗi tự tính lại,
  nên nó không thể đứt.
</p>
```

**d. Chặn xuất bản quyển 0 trang.** RPC `_complete_book_for` `RAISE EXCEPTION 'Book has no pages'`, nên một quyển rỗng đã xuất bản là cái bẫy chờ học sinh:

```tsx
onClick={() => {
  if (!book.published && book.pageCount === 0) {
    setError(
      `"${book.title}" chưa có trang nào. Xuất bản bây giờ thì học sinh mở ra sẽ thấy quyển rỗng ` +
        `và không hoàn thành được. Soạn ít nhất một trang trước.`,
    );
    return;
  }
  void run(() => updateBook(book.slug, { published: !book.published }));
}}
```

`<select>` phần thưởng có một `<option value="">Không thưởng gì</option>` ở đầu, rồi mỗi vật phẩm một option; `onChange` gọi `updateBook(book.slug, { rewardItemSlug: event.target.value || null })`.

Tiêu đề mỗi dòng là `<Link href={`/quan-tri/${shelfSlug}/${book.slug}`}>` để vào màn soạn trang.

- [ ] **Step 3: Viết `app/quan-tri/[shelf]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookAdmin } from "@/components/admin/BookAdmin";
import { readShelfList } from "@/lib/content/read";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/quan-tri/[shelf]">): Promise<Metadata> {
  return { title: `Sách trong kệ ${(await params).shelf} — Quản trị` };
}

export default async function QuanTriShelfPage({ params }: PageProps<"/quan-tri/[shelf]">) {
  // KHÔNG gọi readShelf() ở đây: nó chạy phía server bằng khóa anon nên vĩnh viễn
  // không thấy kệ nháp — mà kệ nháp mới là thứ admin cần sửa. BookAdmin tự đọc phía
  // client, nơi phiên đăng nhập tồn tại.
  const [{ shelf }, shelves] = await Promise.all([params, readShelfList()]);

  return (
    <>
      <Header activeHref="/quan-tri" shelves={shelves} />
      <main className="flex-1">
        <AdminGate>
          <AdminShell title={`Sách trong kệ "${shelf}"`} crumbs={[{ href: "/quan-tri", label: "Kệ sách" }]}>
            <BookAdmin shelfSlug={shelf} />
          </AdminShell>
        </AdminGate>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Chạy cổng**

Run: `npm run check`
Kỳ vọng: xanh, route `/quan-tri/[shelf]` xuất hiện.

- [ ] **Step 5: Kiểm bằng tay**

1. Vào `/quan-tri/lich-su-viet-nam` → thấy 5 quyển thật **và** quyển mồi nhử `__nhap-khong-bao-gio-xuat-ban`. Thấy được quyển nháp chính là bằng chứng `is_admin()` đang chạy đúng.
2. Bấm ▼ ở quyển 1 → thứ tự đổi, không lỗi. Đây là phép kiểm RPC Task 1 qua đường thật.
3. Mở `/lich-su-viet-nam` ở tab khác → thứ tự trên kệ đổi theo, **và chuỗi mở khóa vẫn liền** (quyển 1 mới vẫn mở sẵn).
4. Trả thứ tự về như cũ.
5. Đổi phần thưởng của quyển 1 sang "Không thưởng gì" → dòng chuỗi mở khóa của quyển 2 đổi thành "Mở sẵn — quyển … không thưởng vật phẩm nào." Trả lại như cũ.
6. Tạo quyển mới → thử bấm Xuất bản ngay → bị chặn vì 0 trang.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/books.ts components/admin/BookAdmin.tsx "app/quan-tri/[shelf]/page.tsx"
git commit -m "feat(admin): man /quan-tri/[shelf] — sach trong ke, doi thu tu qua RPC, chuoi mo khoa doc-thoi"
```

---

### Task 9: Soạn trang — `/quan-tri/[shelf]/[book]`

Màn cuối và là lý do cả chặng tồn tại. Xem trước dùng **đúng** `BookPage` học sinh thấy, không phải bản mô phỏng — bản mô phỏng sẽ lệch dần và admin sẽ tin vào thứ sai.

`BookPage` giả định nền giấy do `.face` trong `reader.module.scss` lo (`background: theme('colors.surface')` + viền trong). Khối xem trước phải tự dựng nền đó, nếu không chữ sẽ nằm trên nền trang admin.

**Files:**
- Create: `lib/admin/pages.ts`, `components/admin/PageAdmin.tsx`, `app/quan-tri/[shelf]/[book]/page.tsx`

**Interfaces:**
- Consumes: `BookPage` từ `components/reader/BookPage.tsx`; `ImageField`/`imageFieldError`; `RowActions`; hằng controls.
- Produces:
  - `AdminPage = { id: string; position: number; heading: string; body: string; caption: string | null; summary: string[]; image: ImageValue }`
  - `listPages(bookSlug)`, `createPage(bookSlug)`, `updatePage(id, patch)`, `deletePage(id)`, `reorderPages(bookSlug, idsInOrder)`

- [ ] **Step 1: Viết `lib/admin/pages.ts`**

```ts
import { insforge } from "@/lib/insforge/client";
import { fail } from "./fail";
import type { ImageValue } from "@/lib/insforge/storage";

export interface AdminPage {
  id: string;
  position: number;
  heading: string;
  body: string;
  caption: string | null;
  summary: string[];
  image: ImageValue;
}

export async function listPages(bookSlug: string): Promise<AdminPage[]> {
  const { data, error } = await insforge.database
    .from("pages")
    .select("id, position, heading, body, caption, summary, image_url, image_source, image_credit")
    .eq("book_slug", bookSlug)
    .order("position");
  if (error) fail(error, "Không đọc được danh sách trang");

  type Row = {
    id: string;
    position: number;
    heading: string;
    body: string;
    caption: string | null;
    summary: string[] | null;
    image_url: string | null;
    image_source: string | null;
    image_credit: string | null;
  };

  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    position: row.position,
    heading: row.heading,
    body: row.body,
    caption: row.caption,
    summary: row.summary ?? [],
    image: { url: row.image_url, source: row.image_source, credit: row.image_credit },
  }));
}

export async function createPage(bookSlug: string): Promise<void> {
  // `pages.position` có CHECK (position >= 1) nên trang đầu là 1, không phải 0.
  // ponytail: đọc-rồi-ghi, cùng đánh đổi với createShelf/createBook.
  const existing = await listPages(bookSlug);
  const position = existing.reduce((max, p) => Math.max(max, p.position), 0) + 1;

  const { error } = await insforge.database.from("pages").insert([
    { book_slug: bookSlug, position, heading: `Trang ${position}`, body: "" },
  ]);
  if (error) fail(error, "Không thêm được trang");
}

export async function updatePage(
  id: string,
  patch: { heading: string; body: string; caption: string | null; summary: string[]; image: ImageValue },
): Promise<void> {
  const { error } = await insforge.database
    .from("pages")
    .update({
      heading: patch.heading,
      body: patch.body,
      caption: patch.caption || null,
      // Mảng rỗng lưu thành NULL: `toPage` trong lib/content/read.ts chỉ gắn `summary`
      // vào ContentPage khi mảng có phần tử, nên NULL và [] cho ra cùng kết quả — chọn
      // NULL để "chưa điền" và "điền rồi xóa hết" không phân biệt được ở tầng dữ liệu.
      summary: patch.summary.length > 0 ? patch.summary : null,
      image_url: patch.image.url,
      image_source: patch.image.source,
      image_credit: patch.image.credit,
    })
    .eq("id", id);
  if (error) fail(error, "Không lưu được trang");
}

export async function deletePage(id: string): Promise<void> {
  const { error } = await insforge.database.from("pages").delete().eq("id", id);
  if (error) fail(error, "Không xóa được trang");
}

/** Cùng lý do với `reorderBooks` — xem chú thích ở lib/admin/books.ts. */
export async function reorderPages(bookSlug: string, idsInOrder: string[]): Promise<void> {
  const { error } = await insforge.database.rpc("reorder_pages", {
    p_book_slug: bookSlug,
    p_ids: idsInOrder,
  });
  if (error) fail(error as { message?: string }, "Không đổi được thứ tự trang");
}
```

- [ ] **Step 2: Viết `components/admin/PageAdmin.tsx`**

Bố cục hai cột trên màn rộng: trái là form của trang đang chọn, phải là xem trước. Trên màn hẹp thì xếp dọc (`grid gap-lg lg:grid-cols-2`).

Trạng thái: `pages`, `selectedId`, `draft` (bản nháp của trang đang sửa), `busy`, `error`, `dirty`.

Ba điểm phải làm đúng:

**a. Xem trước dùng đúng `BookPage`, có nền giấy.** `BookPage` chỉ vẽ chữ; nền giấy là việc của `.face`:

```tsx
{/* Nền giấy dựng lại đúng như `.face` trong reader.module.scss: `bg-surface` + viền
    trong mảnh. Không có nó thì chữ nằm trên nền trang admin và xem trước nói dối. */}
<div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-sm bg-surface shadow-[inset_0_0_0_1px_theme(colors.primary-dark/12%)]">
  <BookPage
    page={{
      heading: draft.heading,
      body: draft.body,
      image: draft.image.url,
      imageSource: draft.image.source,
      imageCredit: draft.image.credit,
      caption: draft.caption,
      ...(draft.summary.length > 0 ? { summary: draft.summary } : {}),
    }}
    pageNumber={draft.position}
    gutter="left"
    bookTitle={bookTitle}
  />
</div>
```

`shadow-[…]` là một chỗ Tailwind arbitrary value có `theme()` — nếu nó không biên dịch được thì thay bằng `ring-1 ring-primary-dark/10`, đừng viết hex.

**b. `summary` nhập bằng textarea, mỗi dòng một ý.** Chỉ trang cuối mới nên có (content.md 4.3), nên hiện gợi ý chứ không cấm:

```tsx
<label className={LABEL} htmlFor="page-summary">
  Tóm tắt — mỗi dòng một ý, 3–5 ý. Chỉ điền ở trang cuối.
</label>
<textarea
  id="page-summary"
  className={`${FIELD} min-h-24`}
  value={draft.summary.join("\n")}
  onChange={(event) =>
    setDraft({
      ...draft,
      summary: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
    })
  }
/>
{draft.summary.length > 0 && draft.position !== pages.length && (
  <p className="font-body text-caption text-secondary">
    Trang này không phải trang cuối. Tóm tắt vẫn lưu được, nhưng người đọc thường chỉ
    mong thấy nó ở cuối quyển.
  </p>
)}
```

**c. Chặn lưu khi ảnh thiếu nguồn/tác giả** — gọi `imageFieldError(draft.image)` trước `updatePage`, y hệt Task 7.

Đổi thứ tự dùng `RowActions` + `reorderPages(bookSlug, next.map((p) => p.id))`.

Xóa trang phải cảnh báo khi quyển đang xuất bản và chỉ còn một trang:

```tsx
if (published && pages.length === 1) {
  setError(
    "Đây là trang cuối cùng của một quyển đang xuất bản. Xóa nó thì học sinh mở ra sẽ " +
      "thấy quyển rỗng và không hoàn thành được. Gỡ xuất bản quyển trước, hoặc thêm trang khác.",
  );
  return;
}
```

- [ ] **Step 3: Viết `app/quan-tri/[shelf]/[book]/page.tsx`**

Khuôn giống `app/quan-tri/[shelf]/page.tsx`, dùng `PageProps<"/quan-tri/[shelf]/[book]">`, breadcrumb hai cấp:

```tsx
crumbs={[
  { href: "/quan-tri", label: "Kệ sách" },
  { href: `/quan-tri/${shelf}`, label: shelf },
]}
```

và render `<PageAdmin shelfSlug={shelf} bookSlug={book} />`. `PageAdmin` tự đọc tiêu đề quyển phía client (`listBooks(shelfSlug)` rồi lọc) để truyền `bookTitle` vào xem trước — không đọc phía server, vì quyển nháp thì server không thấy.

- [ ] **Step 4: Chạy cổng**

Run: `npm run check`
Kỳ vọng: xanh, route `/quan-tri/[shelf]/[book]` xuất hiện.

- [ ] **Step 5: Kiểm bằng tay**

1. Vào một quyển thật → thấy đủ trang, chọn trang nào thì form và xem trước đổi theo.
2. Sửa tiêu đề trang → xem trước đổi ngay khi gõ; bấm Lưu; tải lại `/lich-su-viet-nam`, mở quyển đó → thấy tiêu đề mới.
3. Thêm ảnh có nguồn + tác giả → xem trước hiện dòng "Ảnh: …" và học sinh cũng thấy đúng dòng đó trong reader.
4. Bấm ▲/▼ đổi thứ tự hai trang → thứ tự đổi cả trong reader.
5. Nhập 4 dòng tóm tắt ở trang cuối → reader hiện đủ 4 gạch đầu dòng.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/pages.ts components/admin/PageAdmin.tsx "app/quan-tri/[shelf]/[book]/page.tsx"
git commit -m "feat(admin): man soan trang, xem truoc bang dung BookPage hoc sinh thay"
```

---

### Task 10: Nghiệm thu đầu-cuối và cập nhật `CLAUDE.md`

Chặng C xong khi một admin dựng được **một quyển từ số không** và học sinh đọc hết nó, nhận vật phẩm, thấy quyển sau mở ra. Task này chạy đúng kịch bản đó rồi ghi lại sự thật mới vào `CLAUDE.md`.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Chạy kịch bản đầu-cuối bằng tay**

Trên `npm run dev`, tài khoản admin:
1. `/quan-tri/vat-pham` → tạo vật phẩm "Bản đồ cổ" (`ban-do-co`), có ảnh + nguồn + tác giả.
2. `/quan-tri` → tạo kệ "Thử nghiệm chặng C", **chưa** xuất bản.
3. `/quan-tri/thu-nghiem-chang-c` → tạo quyển "Quyển thử", niên đại "Năm 2026", phần thưởng "Bản đồ cổ".
4. Soạn 2 trang có nội dung thật; trang 2 có 3 dòng tóm tắt.
5. Tạo quyển thứ hai "Quyển thử 2", không phần thưởng. Xác nhận dòng chuỗi mở khóa của nó ghi `Mở bằng: Bản đồ cổ — thưởng của quyển 1 ("Quyển thử")`.
6. Xuất bản cả hai quyển, rồi xuất bản kệ.
7. Đăng xuất. Mở `/thu-nghiem-chang-c` khi **chưa đăng nhập** → thấy hai quyển, quyển 1 mở, quyển 2 khóa và ghi cần "Bản đồ cổ".
8. Đăng nhập bằng tài khoản **thường**, đọc hết quyển 1 → nhận "Bản đồ cổ" kèm ảnh và dòng credit → quyển 2 mở ra.

Kịch bản này chạm cả `complete_book`, `resolveState`, RLS đọc, RLS ghi và storage trong một lượt. Bước nào hỏng thì quay lại đúng task sinh ra nó.

- [ ] **Step 2: Dọn dữ liệu thử**

Xóa quyển thử, kệ thử và vật phẩm "Bản đồ cổ" **bằng chính giao diện quản trị** — đó cũng là phép kiểm đường xóa. Lưu ý thứ tự: phải gỡ phần thưởng của "Quyển thử" trước rồi mới xóa được vật phẩm (FK `ON DELETE RESTRICT`).

**Đừng đụng vào** hai dòng mồi nhử: quyển `__nhap-khong-bao-gio-xuat-ban` và dòng vai trò admin của `22222222-2222-2222-2222-222222222222`. Xóa chúng thì hai phép của `npm run db:check` im lặng mất hết ý nghĩa.

- [ ] **Step 3: Chạy cả hai cổng**

Run: `npm run check`
Kỳ vọng: xanh.

Run: `npm run db:check`
Kỳ vọng: tất cả các phép đạt, **và** phép ghi khi đã đăng nhập phải đạt vì message báo RLS chặn (`new row violates row-level security policy`), không phải `permission denied for table`. Đọc từng dòng output, đừng chỉ nhìn dòng tổng kết.

- [ ] **Step 4: Sửa `CLAUDE.md`**

Trong mục "Nội dung nằm trong database", thay đoạn mở đầu (từ "**`/quan-tri` CHƯA được xây**…" đến hết câu về `run-raw-sql`) bằng:

```markdown
Nội dung bài học (kệ, sách, trang, vật phẩm) nằm ở 4 bảng `shelves`, `items`, `books`,
`pages`, và sửa được bằng giao diện `/quan-tri` (chặng C, xong 2026-08-26). Bốn màn:
`/quan-tri` (kệ), `/quan-tri/vat-pham`, `/quan-tri/[shelf]` (sách trong kệ),
`/quan-tri/[shelf]/[book]` (soạn trang). Toàn bộ chạy **phía client** — bắt buộc chứ
không phải tiện tay: bản nháp chỉ hiện với admin, quyền admin đến từ JWT, mà phiên
InsForge nằm ở trình duyệt, nên server component dùng khóa anon vĩnh viễn không thấy
nháp và không ghi được gì. `AdminGate` chỉ là cổng giao diện; hàng rào thật vẫn là RLS.

Đổi thứ tự sách/trang **phải** đi qua RPC `reorder_books`/`reorder_pages`
(`db/schema/2026-08-26-reorder-rpc.sql`): ràng buộc `UNIQUE` là `DEFERRABLE INITIALLY
DEFERRED` nên trạng thái trung gian trùng vị trí chỉ hợp lệ trong MỘT transaction, mà
PostgREST cho mỗi request một transaction riêng. Hai hàm đó cố ý **không** phải
`SECURITY DEFINER` — chạy bằng quyền người gọi thì policy `admin write` vẫn áp.

Chưa có trong `/quan-tri`, để dành chặng D: ảnh bìa kệ và bìa sách (bảng `shelves`
không có cột `cover_source`/`cover_credit`, và `books.cover_url` hiện không component
nào render), và chọn quốc gia bằng cách bấm trên bản đồ (giờ là ô nhập mã ISO numeric).
```

Trong bảng "Agent harness — cái gì nằm ở đâu", không cần thêm dòng nào.

Trong mục "Test — cố tình rất ít", thêm một dòng vào bảng rủi ro:

```markdown
| Slug tiếng Việt sinh sai | `npm test` — `lib/admin/slug.test.ts` |
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md ghi nhan /quan-tri da xay xong (chang C)"
```

---

## Xong chặng C khi

- [ ] `npm run check` xanh.
- [ ] `npm run db:check` tất cả các phép đạt, và phép ghi-khi-đã-đăng-nhập đạt vì **message** báo RLS chặn chứ không phải thiếu GRANT.
- [ ] Admin tạo được một kệ + một quyển + các trang của nó từ số không, xuất bản, và một người **chưa đăng nhập** đọc được quyển đó — không viết một dòng SQL nào.
- [ ] Người đăng nhập nhưng **không** phải admin mở `/quan-tri` thấy màn từ chối, và (đã kiểm ở tầng DB) không ghi được gì kể cả khi lách qua giao diện.
- [ ] Ảnh nào có mặt trên giao diện học sinh thì đều kèm nguồn + tác giả; form không cho lưu ảnh thiếu hai thứ đó.
- [ ] Không có ô nhập "vật phẩm cần để mở" ở bất kỳ đâu; chuỗi mở khóa chỉ hiện dạng chữ đọc-thôi.
- [ ] Xuất bản một quyển 0 trang bị chặn ở giao diện, khớp với `RAISE EXCEPTION 'Book has no pages'` trong RPC.
- [ ] `grep -rn "required_item_slug" --include="*.ts" --include="*.tsx" .` không ra kết quả nào.

## Chưa làm, để chặng D

| Việc | Vì sao hoãn |
|---|---|
| Kéo-thả đổi thứ tự | ▲/▼ làm đúng việc đó với 0 dependency và dùng được bằng bàn phím. Nâng cấp bằng cách gắn `@dnd-kit/sortable` vào chỗ đang gọi `reorder*`. |
| Upload ảnh bìa kệ / bìa sách | `shelves` thiếu cột `cover_source`/`cover_credit`, và `books.cover_url` chưa component nào render — upload bây giờ là tạo ảnh không có chỗ ghi giấy phép. |
| Chọn quốc gia trên bản đồ | Bản đồ thế giới là chặng D. Ô nhập mã ISO numeric dùng được ngay và chặng D gắn thêm chỗ chọn chứ không viết lại. |
| Focus trap cho modal quản trị | Chặng C không có modal — tất cả là form trên trang. |
