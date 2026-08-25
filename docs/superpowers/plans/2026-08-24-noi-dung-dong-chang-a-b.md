# Nội dung động — Chặng A + B (nền tảng)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển nội dung bài học từ JSON-trong-bundle sang database, kèm vai trò `admin`/`user`, mà giao diện người dùng cuối **không đổi một pixel nào**.

**Architecture:** 4 bảng nội dung mới (`shelves`, `items`, `books`, `pages`) + `user_roles` + hàm `is_admin()`. RLS cho đọc công khai phần đã xuất bản và ghi chỉ dành cho admin. `book_unlocks` bị xóa, `_complete_book_for` đọc thẳng `books`/`pages`. Phía ứng dụng, server component đọc nội dung bằng khóa anon qua **một** truy vấn lồng ba tầng rồi truyền xuống `ShelfPageClient` — ranh giới "nội dung ở server, trạng thái người dùng ở client" giữ nguyên.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2.8, TypeScript, Tailwind 3.4.17, `@insforge/sdk`, PostgreSQL qua InsForge, `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md`

**Phạm vi:** Chặng A (mục 3 của spec) + chặng B (mục 4). Chặng C (`/quan-tri`) và chặng D (bản đồ + ảnh) có plan riêng, viết sau khi plan này chạy xong — chi tiết giao diện của C phụ thuộc vào hình dạng thật của tầng dữ liệu mà B để lại.

## Global Constraints

- **Tailwind CSS 3.4.17, không nâng lên v4.** InsForge yêu cầu, version pin cứng trong `package.json`.
- **Không hardcode mã hex trong component.** Dùng class Tailwind sinh từ token trong `DESIGN.md`. Trong SCSS lấy màu bằng `theme('colors.tertiary / 55%')`.
- **Không dùng emoji làm icon.** Dùng `lucide-react`.
- **Logic mở khóa và trao vật phẩm chỉ ở phía server**, trong hàm Postgres `SECURITY DEFINER`. Không bao giờ cấp INSERT/UPDATE trực tiếp lên `user_items` hay cột `user_book_progress.completed` cho `authenticated`.
- **Không cài test framework.** Chỉ `node --test` của Node 24, test nằm ở `lib/**/*.test.ts`, và **chỉ** cho module thuần import tương đối — alias `@/` không resolve dưới test runner của Node. Rủi ro tầng DB do `npm run db:check` bắt, rủi ro kiểu do `npm run build` bắt.
- **`npm run check` là cổng duy nhất.** Nó cũng chạy ở pre-commit qua `.githooks/pre-commit`.
- **Bí mật không vào git.** Khóa InsForge ở `.env.local` và `.mcp.json`, cả hai đã gitignore.
- **Comment và tài liệu trong repo viết bằng tiếng Việt** — đây là quy ước sẵn có của repo này.
- **`.pen` chỉ mở bằng Pencil MCP.** Plan này không đụng tới `pen.dev/`.
- SQL chạy qua MCP `run-raw-sql`; file trong `db/schema/` là nguồn sự thật vì backend không tự version.

## Cấu trúc file

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` | Toàn bộ DDL của chặng A. Nguồn sự thật cho schema. |
| `scripts/seed-content.mjs` | Sinh SQL đổ JSON vào bảng nội dung. Bootstrap một chiều, chạy một lần. |
| `lib/content/read.ts` | Đọc nội dung từ DB. Điểm duy nhất trong code biết nội dung nằm ở đâu. |
| `lib/content/find.ts` | `findBook` / `findItem` — hàm thuần tra cứu trong một `ContentShelf` đã tải. |
| `app/[shelf]/page.tsx` | Route động cho mọi kệ. |

**Sửa**

| File | Thay đổi |
|---|---|
| `lib/content/types.ts` | Bỏ `ContentBook.requiredItem`; thêm `ContentShelf.countryCode`. |
| `lib/insforge/unlock.ts` | Đổi tên tham số `requiredItem` → `prevRewardItem` + ghi chú `ponytail:`. |
| `lib/insforge/unlock.test.ts` | Cập nhật theo tên mới, thêm ca kiểm cho quyển giữa kệ. |
| `lib/insforge/shelf.ts` | `buildShelfView` nhận `ContentShelf` thay vì tra slug. |
| `components/shelf/ShelfPageClient.tsx` | Nhận `shelf: ContentShelf` qua prop. |
| `components/reader/BookReaderModal.tsx` | Nhận `shelf` thay cho `shelfSlug`. |
| `components/reader/ItemDropOverlay.tsx` | Nhận `shelf` thay cho `shelfSlug`. |
| `components/Header.tsx` | Nav đọc danh sách kệ từ DB thay vì hardcode. |
| `app/page.tsx` | Link vào kệ dựng từ DB (bản đồ thay chỗ ở chặng D). |
| `scripts/db-check.mjs` | 6 phép → 11 phép. |
| `package.json` | Bỏ `content:check` / `content:sync` khỏi `check`. |
| `CLAUDE.md` | Sửa mục kiến trúc nội dung — nó đang mô tả mô hình cũ. |

**Xóa**

`lib/content/shelves.ts`, `scripts/content-sync.mjs`, `app/lich-su-viet-nam/page.tsx`, bảng `public.book_unlocks`. `content/shelves/` chuyển sang `db/seed/`.

---

### Task 1: Vai trò `user_roles` + hàm `is_admin()`

**Files:**
- Create: `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql`

**Interfaces:**
- Consumes: bảng `auth.users` sẵn có.
- Produces: bảng `public.user_roles(user_id uuid, role text, granted_at timestamptz)`; hàm `public.is_admin() RETURNS boolean` — mọi policy ghi ở Task 2 dùng nó.

- [ ] **Step 1: Viết khối tự kiểm (đây là "test" của tầng DB)**

Tạo file `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` với **chỉ phần kiểm tra trước**, đặt ở cuối file dưới tiêu đề `-- === TỰ KIỂM TASK 1 ===`:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables
                  WHERE schemaname = 'public' AND tablename = 'user_roles' AND rowsecurity) THEN
    RAISE EXCEPTION 'user_roles chưa tồn tại hoặc chưa bật RLS';
  END IF;

  IF has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
  OR has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
  OR has_table_privilege('authenticated', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated ghi được user_roles — người dùng tự phong admin được';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.user_roles', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated không đọc được vai trò của chính mình';
  END IF;

  IF has_table_privilege('anon', 'public.user_roles', 'SELECT') THEN
    RAISE EXCEPTION 'anon đọc được user_roles';
  END IF;

  -- `has_table_privilege` chỉ trả lời "role này có được phép SELECT không", KHÔNG trả
  -- lời "RLS cho nó thấy những dòng nào". Nếu policy bị sửa thành USING (true) hay mất
  -- mệnh đề USING, thì MỌI khẳng định phía trên vẫn xanh — `rowsecurity` vẫn true,
  -- grant vẫn nguyên — trong khi vai trò của mọi người lộ ra cho mọi người đã đăng nhập.
  -- Vì vậy phải soi thẳng vào biểu thức của policy, không suy ra từ quyền.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'user_roles'
       AND policyname = 'own role select'
       AND qual LIKE '%auth.uid()%'
       -- `_` là ký tự đại diện của LIKE; không ESCAPE thì pattern khớp cả `user2id`.
       AND qual LIKE '%user\_id%' ESCAPE '\'
  ) THEN
    RAISE EXCEPTION 'policy "own role select" không còn giới hạn theo auth.uid() = user_id';
  END IF;

  IF NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon không gọi được is_admin() — policy SELECT của bảng nội dung sẽ vỡ';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated không gọi được is_admin()';
  END IF;

  RAISE NOTICE 'Task 1 OK';
END $$;
```

- [ ] **Step 2: Chạy khối tự kiểm qua MCP `run-raw-sql` để thấy nó HỎNG**

Kỳ vọng: `ERROR: user_roles chưa tồn tại hoặc chưa bật RLS`.

Nếu nó pass ngay, nghĩa là schema đã bị chạy sẵn ở đâu đó — dừng lại và đọc `db/schema/` trước khi đi tiếp.

- [ ] **Step 3: Viết DDL vào đầu file, phía trên khối tự kiểm**

```sql
-- Nội dung động + Quản trị — schema.
-- Chạy qua MCP `run-raw-sql`. File này là nguồn sự thật, backend không tự version.
-- Spec: docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md
--
-- KIẾN TRÚC: nội dung bài học nằm TRONG DATABASE (đổi so với mô hình JSON cũ), vì
-- admin phải tạo được sách lúc chạy mà không cần build lại. Xem spec §2.1.

-- ---------------------------------------------------------------------------
-- Vai trò. KHÔNG có dòng nghĩa là 'user' — chỉ admin mới có dòng.
-- `authenticated` chỉ SELECT dòng của chính mình; không có INSERT/UPDATE/DELETE
-- nên bề mặt tự phong admin bằng 0. Cấp admin bằng SQL qua MCP (xem Task 3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','admin')),
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own role select" ON public.user_roles;
CREATE POLICY "own role select" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.user_roles FROM anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- SECURITY DEFINER là bắt buộc, không phải tiện tay: policy "own role select" chặn
-- người dùng thường đọc dòng của người khác, nhưng hàm này cần đọc dòng của chính
-- người gọi từ bên trong policy của MỘT BẢNG KHÁC.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  )
$fn$;

-- Phải cấp cho CẢ anon: hàm này nằm trong policy SELECT của bảng nội dung, và quyền
-- EXECUTE bị kiểm TRƯỚC khi toán tử OR kịp ngắn mạch (đã kiểm bằng thực nghiệm
-- 2026-08-24: bảng thử với mọi dòng `flag = true` vẫn trả 42501 cho anon).
-- Không rò rỉ gì: với anon thì auth.uid() là NULL nên hàm luôn trả false, và hàm
-- chỉ nói về chính người gọi.
REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
```

- [ ] **Step 4: Chạy lại cả file qua MCP `run-raw-sql`**

Kỳ vọng: không có EXCEPTION, có `NOTICE: Task 1 OK`.

- [ ] **Step 5: Commit**

```bash
git add -- db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
git commit -m "feat(db): vai tro admin/user va ham is_admin()" -- db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
```

---

### Task 2: Bốn bảng nội dung + RLS + quyền

**Files:**
- Modify: `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql`

**Interfaces:**
- Consumes: `public.is_admin()` từ Task 1.
- Produces: `public.shelves(slug, name, position, country_code, blurb, cover_url, published)`, `public.items(slug, name, description, image_url, image_source, image_credit)`, `public.books(slug, shelf_slug, position, title, era, cover_url, cover_source, cover_credit, reward_item_slug, published, created_at, updated_at)`, `public.pages(id, book_slug, position, heading, body, image_url, image_source, image_credit, caption, summary)`.

- [ ] **Step 1: Thêm khối tự kiểm Task 2 vào cuối file**

```sql
-- === TỰ KIỂM TASK 2 ===
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shelves','items','books','pages'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables
                    WHERE schemaname = 'public' AND tablename = t AND rowsecurity) THEN
      RAISE EXCEPTION 'bảng % chưa tồn tại hoặc chưa bật RLS', t;
    END IF;

    IF NOT has_table_privilege('anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'anon không đọc được % — kệ sẽ trắng khi chưa đăng nhập', t;
    END IF;

    IF has_table_privilege('anon', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'anon ghi được %', t;
    END IF;

    -- authenticated PHẢI có GRANT ghi; hàng rào thật là policy "admin write",
    -- không phải GRANT. Thiếu GRANT thì chính admin cũng không ghi được.
    IF NOT has_table_privilege('authenticated', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'authenticated thiếu GRANT INSERT trên % — admin thật cũng ghi hỏng', t;
    END IF;

    -- Chỉ kiểm TÊN policy là chưa đủ: một policy vẫn mang tên 'admin write' nhưng
    -- USING (true) sẽ cho mọi người đã đăng nhập sửa nội dung, mà khẳng định
    -- chỉ-kiểm-tên vẫn xanh. `db:check` phép 10 chỉ thử live trên `books`, nên
    -- `shelves`/`items`/`pages` không có hàng rào nào khác ngoài khẳng định này.
    -- Soi cả hai vế: USING (sửa/xóa được dòng nào) và WITH CHECK (ghi vào được gì).
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = 'admin write'
         -- So khớp CHÍNH XÁC chứ không LIKE: `USING (is_admin() OR true)` vẫn chứa
         -- chuỗi con `is_admin()` nhưng mở toang cửa cho mọi người đã đăng nhập.
         -- Giá trị thật trong pg_policies đúng là `is_admin()` (đã kiểm ngày
         -- 2026-08-24). Sửa biểu thức policy thì khẳng định này nổ to — đúng ý muốn:
         -- mọi thay đổi lên hàng rào ghi nội dung đều phải có người xem lại.
         AND qual       = 'is_admin()'
         AND with_check = 'is_admin()'
         AND cmd        = 'ALL'
    ) THEN
      RAISE EXCEPTION
        'policy "admin write" trên bảng % thiếu, hoặc không còn gọi is_admin() ở cả USING lẫn WITH CHECK', t;
    END IF;
  END LOOP;

  -- Ràng buộc thứ tự phải DEFERRABLE INITIALLY DEFERRED, nếu không admin đổi chỗ hai
  -- quyển sẽ vỡ unique.
  --
  -- Phải kiểm CẢ HAI cột catalog. `condeferrable` chỉ nói "có thể hoãn được", còn
  -- `condeferred` mới nói "mặc định hoãn". Hạ xuống `DEFERRABLE INITIALLY IMMEDIATE`
  -- thì condeferrable vẫn true — khẳng định vẫn xanh — trong khi một transaction đổi
  -- chỗ hai quyển mà không tự gọi `SET CONSTRAINTS ... DEFERRED` lại vỡ đúng như cũ.
  FOREACH t IN ARRAY ARRAY['shelves_position_key',
                           'books_shelf_position_key',
                           'pages_book_position_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = t AND condeferrable AND condeferred) THEN
      RAISE EXCEPTION '% không phải DEFERRABLE INITIALLY DEFERRED', t;
    END IF;
  END LOOP;

  RAISE NOTICE 'Task 2 OK';
END $$;
```

- [ ] **Step 2: Chạy file qua MCP để thấy khối mới HỎNG**

Kỳ vọng: `ERROR: bảng shelves chưa tồn tại hoặc chưa bật RLS`. Khối Task 1 vẫn phải in `Task 1 OK` trước đó.

- [ ] **Step 3: Thêm DDL vào file, phía trên các khối tự kiểm**

```sql
-- ---------------------------------------------------------------------------
-- Nội dung. `required_item_slug` CỐ Ý KHÔNG TỒN TẠI: nó suy ra được 100% từ vị trí
-- (quyển i mở bằng vật phẩm thưởng của quyển i-1), nên không lưu thì chuỗi mở khóa
-- không thể đứt. Xem spec §2.2.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shelves (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  position     integer NOT NULL,
  country_code text UNIQUE,      -- id số ISO-3166-1 của world-atlas; '704' = Việt Nam
  blurb        text NOT NULL DEFAULT '',
  cover_url    text,
  published    boolean NOT NULL DEFAULT false,
  CONSTRAINT shelves_position_key UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.items (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  image_url    text,
  image_source text,             -- URL trang gốc (Wikimedia Commons…)
  image_credit text              -- tác giả + giấy phép; điều kiện của CC BY-SA
);

CREATE TABLE IF NOT EXISTS public.books (
  slug             text PRIMARY KEY,
  shelf_slug       text NOT NULL REFERENCES public.shelves(slug) ON DELETE CASCADE,
  position         integer NOT NULL,
  title            text NOT NULL,
  era              text NOT NULL,
  cover_url        text,
  cover_source     text,
  cover_credit     text,
  -- RESTRICT chứ không SET NULL: SET NULL sẽ âm thầm mở toang quyển kế tiếp khi ai đó
  -- xóa một vật phẩm. RESTRICT bắt admin gỡ liên kết trước.
  reward_item_slug text REFERENCES public.items(slug) ON DELETE RESTRICT,
  published        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT books_shelf_position_key UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_slug    text NOT NULL REFERENCES public.books(slug) ON DELETE CASCADE,
  position     integer NOT NULL CHECK (position >= 1),
  heading      text NOT NULL,
  body         text NOT NULL,
  image_url    text,
  image_source text,
  image_credit text,
  caption      text,
  summary      text[],           -- chỉ trang cuối, 3-5 ý (content.md 4.3)
  CONSTRAINT pages_book_position_key UNIQUE (book_slug, position) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read published" ON public.shelves;
DROP POLICY IF EXISTS "read published" ON public.books;
DROP POLICY IF EXISTS "read items"     ON public.items;
DROP POLICY IF EXISTS "read pages"     ON public.pages;
DROP POLICY IF EXISTS "admin write"    ON public.shelves;
DROP POLICY IF EXISTS "admin write"    ON public.items;
DROP POLICY IF EXISTS "admin write"    ON public.books;
DROP POLICY IF EXISTS "admin write"    ON public.pages;

CREATE POLICY "read published" ON public.shelves FOR SELECT USING (published OR public.is_admin());
CREATE POLICY "read published" ON public.books   FOR SELECT USING (published OR public.is_admin());
-- items chỉ là tên/mô tả/ảnh, không có gì để giấu — và trang kệ cần tên vật phẩm để
-- hiện "Cần Trống đồng để mở" cho quyển đang khóa.
CREATE POLICY "read items"     ON public.items   FOR SELECT USING (true);
CREATE POLICY "read pages"     ON public.pages   FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.books b
           WHERE b.slug = pages.book_slug AND (b.published OR public.is_admin()))
);

CREATE POLICY "admin write" ON public.shelves FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin write" ON public.items   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin write" ON public.books   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin write" ON public.pages   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS chỉ LỌC DÒNG, nó không cấp quyền bảng. GRANT dưới đây là cần thiết để admin
-- thật ghi được; người đã đăng nhập nhưng không phải admin đi qua GRANT rồi bị
-- policy "admin write" chặn lại. Đó chính là phép 10 của `npm run db:check`.
REVOKE ALL ON public.shelves, public.items, public.books, public.pages FROM anon, authenticated;
GRANT SELECT                 ON public.shelves, public.items, public.books, public.pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.shelves, public.items, public.books, public.pages TO authenticated;
```

- [ ] **Step 4: Chạy lại cả file qua MCP**

Kỳ vọng: `NOTICE: Task 1 OK` và `NOTICE: Task 2 OK`, không EXCEPTION.

- [ ] **Step 5: Commit**

```bash
git add -- db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
git commit -m "feat(db): bang noi dung shelves/items/books/pages + RLS" -- db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
```

---

### Task 3: Seed nội dung từ JSON

**Files:**
- Create: `scripts/seed-content.mjs`
- Read: `content/shelves/lich-su-viet-nam.json` (chưa di chuyển ở task này — `npm run content:check` vẫn cần nó ở chỗ cũ cho tới Task 10)

**Interfaces:**
- Consumes: 4 bảng từ Task 2.
- Produces: 1 dòng `shelves`, 5 dòng `items`, 5 dòng `books`, 20 dòng `pages`. `books.position` và `pages.position` đánh số **từ 1**.

- [ ] **Step 1: Viết `scripts/seed-content.mjs`**

```js
#!/usr/bin/env node
/**
 * Bootstrap MỘT CHIỀU: đổ nội dung từ content/shelves/*.json vào các bảng nội dung.
 *
 * Sau khi chạy, DATABASE LÀ NGUỒN SỰ THẬT. Sửa JSON KHÔNG làm đổi nội dung đang chạy —
 * muốn sửa nội dung thì vào /quan-tri. File JSON chỉ còn để dựng lại một DB dev từ số
 * không, đó là lý do nó chuyển sang db/seed/ ở cuối chặng này.
 *
 * In ra SQL để chạy qua MCP `run-raw-sql`:
 *   node scripts/seed-content.mjs
 *
 * Idempotent: chạy lại nhiều lần cho cùng một kết quả.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "content", "shelves");

/** Mã ISO-3166-1 numeric mà world-atlas dùng làm id quốc gia (chặng D cần). */
const COUNTRY_CODE = { "lich-su-viet-nam": "704" };

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const qArray = (a) => (a?.length ? `ARRAY[${a.map(q).join(", ")}]::text[]` : "NULL");

const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("Không tìm thấy file nội dung nào trong " + dir);
  process.exit(1);
}

const shelves = [];
for (const file of files) shelves.push(JSON.parse(await readFile(join(dir, file), "utf8")));

// KHÔNG phát `BEGIN;`/`COMMIT;`: MCP `run-raw-sql` từ chối lệnh điều khiển transaction
// tường minh, và nó không cần — proxy đã tự bọc cả batch trong một transaction. Đã kiểm
// bằng thực nghiệm ngày 2026-08-24: một batch có `CREATE TABLE` rồi một `INSERT` trùng
// khóa làm cả batch roll back, bảng vừa tạo cũng biến mất. Thêm `BEGIN;` vào chỉ khiến
// output không dán thẳng vào MCP được, đúng lỗi đã vấp lần đầu.
const out = [];

for (const shelf of shelves) {
  out.push(
    `INSERT INTO public.shelves (slug, name, position, country_code, blurb, published) VALUES\n` +
      `  (${q(shelf.slug)}, ${q(shelf.name)}, ${shelf.order}, ` +
      `${q(COUNTRY_CODE[shelf.slug] ?? null)}, '', true)\n` +
      `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position,\n` +
      `  country_code = EXCLUDED.country_code, published = EXCLUDED.published;`,
  );

  // items trước books: books.reward_item_slug tham chiếu tới nó.
  for (const item of shelf.items) {
    out.push(
      `INSERT INTO public.items (slug, name, description, image_url) VALUES\n` +
        `  (${q(item.slug)}, ${q(item.name)}, ${q(item.description)}, ${q(item.image)})\n` +
        `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,\n` +
        `  description = EXCLUDED.description, image_url = EXCLUDED.image_url;`,
    );
  }

  shelf.books.forEach((book, i) => {
    // book.requiredItem trong JSON bị BỎ QUA có chủ đích — chuỗi mở khóa nay suy ra
    // từ vị trí chứ không lưu (spec §2.2).
    out.push(
      `INSERT INTO public.books\n` +
        `  (slug, shelf_slug, position, title, era, cover_url, reward_item_slug, published) VALUES\n` +
        `  (${q(book.slug)}, ${q(shelf.slug)}, ${i + 1}, ${q(book.title)}, ${q(book.era)}, ` +
        `${q(book.cover)}, ${q(book.rewardItem)}, true)\n` +
        `ON CONFLICT (slug) DO UPDATE SET shelf_slug = EXCLUDED.shelf_slug,\n` +
        `  position = EXCLUDED.position, title = EXCLUDED.title, era = EXCLUDED.era,\n` +
        `  cover_url = EXCLUDED.cover_url, reward_item_slug = EXCLUDED.reward_item_slug,\n` +
        `  published = EXCLUDED.published, updated_at = now();`,
    );

    // pages không có khóa tự nhiên nào ngoài (book_slug, position); xóa sạch rồi chèn
    // lại là cách duy nhất giữ seed idempotent mà không phải đoán id.
    out.push(`DELETE FROM public.pages WHERE book_slug = ${q(book.slug)};`);

    book.pages.forEach((page, p) => {
      out.push(
        `INSERT INTO public.pages\n` +
          `  (book_slug, position, heading, body, image_url, caption, summary) VALUES\n` +
          `  (${q(book.slug)}, ${p + 1}, ${q(page.heading)}, ${q(page.body)}, ` +
          `${q(page.image)}, ${q(page.caption)}, ${qArray(page.summary)});`,
      );
    });
  });
}

console.log(out.join("\n\n"));
```

- [ ] **Step 2: Sinh SQL và kiểm mắt thường**

```bash
node scripts/seed-content.mjs | head -40
```

Kỳ vọng: bắt đầu thẳng bằng `INSERT INTO public.shelves` — **không** có `BEGIN;`. Kiểm thêm: `summary` của trang cuối mỗi quyển ra `ARRAY[...]::text[]`, các trang khác ra `NULL`.

Output phải dán thẳng vào MCP `run-raw-sql` được, không phải sửa tay dòng nào.

- [ ] **Step 3: Chạy toàn bộ SQL đó qua MCP `run-raw-sql`**

- [ ] **Step 4: Khẳng định số dòng bằng SQL, không bằng mắt**

```sql
DO $$
DECLARE n_shelf int; n_item int; n_book int; n_page int; n_bad int;
BEGIN
  SELECT count(*) INTO n_shelf FROM public.shelves;
  SELECT count(*) INTO n_item  FROM public.items;
  SELECT count(*) INTO n_book  FROM public.books;
  SELECT count(*) INTO n_page  FROM public.pages;
  IF (n_shelf, n_item, n_book, n_page) IS DISTINCT FROM (1, 5, 5, 20) THEN
    RAISE EXCEPTION 'seed sai: % kệ, % vật phẩm, % sách, % trang (chờ 1/5/5/20)',
      n_shelf, n_item, n_book, n_page;
  END IF;

  -- Mỗi quyển phải đủ 4 trang đánh số 1..4 liên tục.
  SELECT count(*) INTO n_bad FROM (
    SELECT book_slug FROM public.pages
     GROUP BY book_slug
    HAVING min(position) <> 1 OR max(position) <> count(*)
  ) x;
  IF n_bad > 0 THEN
    RAISE EXCEPTION '% quyển có số trang không liên tục từ 1', n_bad;
  END IF;

  IF EXISTS (SELECT 1 FROM public.books WHERE position = 1 AND slug <> 'khoi-nguon-bo-coi') THEN
    RAISE EXCEPTION 'quyển đầu kệ không phải khoi-nguon-bo-coi';
  END IF;

  IF (SELECT reward_item_slug FROM public.books WHERE slug = 'khoi-nguon-bo-coi')
     IS DISTINCT FROM 'trong-dong' THEN
    RAISE EXCEPTION 'quyển 1 không thưởng trong-dong';
  END IF;

  RAISE NOTICE 'Task 3 OK';
END $$;
```

- [ ] **Step 5: Cấp quyền admin cho tài khoản của bạn**

Chưa có user nào thì bỏ qua bước này và quay lại sau khi đăng nhập lần đầu qua `/dang-nhap`.

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = '<email của bạn>'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

- [ ] **Step 6: Commit**

```bash
git add -- scripts/seed-content.mjs
git commit -m "feat(db): script seed noi dung tu JSON vao bang" -- scripts/seed-content.mjs
```

---

### Task 4: `_complete_book_for` đọc `books`/`pages`

**Files:**
- Modify: `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql`

**Interfaces:**
- Consumes: `public.books`, `public.pages` đã seed từ Task 3.
- Produces: `public._complete_book_for(uuid, text) RETURNS jsonb` và `public.complete_book(text) RETURNS jsonb` — hình dạng JSON trả về **không đổi**: `{alreadyCompleted: boolean, grantedItemSlug: text|null, nextBook: {slug, unlocked}|null}`. `lib/insforge/types.ts:CompleteBookResult` giữ nguyên.

Bảng `book_unlocks` **chưa xóa ở task này** — Task 5 xóa nó, sau khi `db-check.mjs` thôi tham chiếu. Nhờ vậy mọi ranh giới task đều để lại một cây chạy được.

- [ ] **Step 1: Thêm khối tự kiểm Task 4 vào cuối file schema**

Bẫy đã gặp và phải né: **exception block trong `DO $$` roll back luôn dữ liệu mà hàm vừa insert.** Fixture phải tạo trước khối `BEGIN…EXCEPTION` thì mới sống qua savepoint.

```sql
-- === TỰ KIỂM TASK 4 ===
DO $$
DECLARE
  v_user uuid := '11111111-1111-1111-1111-111111111111';
  v_res  jsonb;
  v_msg  text;
  v_items int;
BEGIN
  -- Fixture: user giả + tiến độ đã đọc hết 4 trang của quyển 1.
  INSERT INTO auth.users (id, email, email_verified, is_project_admin, is_anonymous)
       VALUES (v_user, '__selfcheck@example.invalid', true, false, false)
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM public.user_items         WHERE user_id = v_user;
  DELETE FROM public.user_book_progress WHERE user_id = v_user;
  INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
       VALUES (v_user, 'khoi-nguon-bo-coi', 4);

  -- 1. Đọc xong quyển 1 -> nhận trống đồng, mở khóa quyển 2.
  v_res := public._complete_book_for(v_user, 'khoi-nguon-bo-coi');
  IF (v_res->>'alreadyCompleted')::boolean THEN
    RAISE EXCEPTION 'lần đầu mà đã báo alreadyCompleted';
  END IF;
  IF v_res->>'grantedItemSlug' IS DISTINCT FROM 'trong-dong' THEN
    RAISE EXCEPTION 'vật phẩm sai: %', v_res->>'grantedItemSlug';
  END IF;
  IF v_res->'nextBook'->>'slug' IS DISTINCT FROM 'tran-chien-bach-dang-938' THEN
    RAISE EXCEPTION 'quyển kế tiếp sai: %', v_res->'nextBook'->>'slug';
  END IF;
  IF NOT (v_res->'nextBook'->>'unlocked')::boolean THEN
    RAISE EXCEPTION 'quyển 2 chưa mở dù đã có trống đồng';
  END IF;

  -- 2. Gọi lại phải idempotent, không nhân đôi vật phẩm.
  v_res := public._complete_book_for(v_user, 'khoi-nguon-bo-coi');
  IF NOT (v_res->>'alreadyCompleted')::boolean THEN
    RAISE EXCEPTION 'lần hai không báo alreadyCompleted';
  END IF;
  SELECT count(*) INTO v_items FROM public.user_items WHERE user_id = v_user;
  IF v_items <> 1 THEN
    RAISE EXCEPTION 'có % dòng user_items, chờ đúng 1', v_items;
  END IF;

  -- 3. Chưa đọc hết thì không được hoàn thành.
  INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
       VALUES (v_user, 'tran-chien-bach-dang-938', 2);
  BEGIN
    v_res := public._complete_book_for(v_user, 'tran-chien-bach-dang-938');
    RAISE EXCEPTION 'hoàn thành được quyển mới đọc 2/4 trang';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE 'Book not finished yet%' THEN RAISE; END IF;
  END;

  -- 4. Quyển chưa xuất bản không được hoàn thành (hàm chạy SECURITY DEFINER nên
  --    nó KHÔNG chịu RLS — thiếu `AND published` là sách nháp phát vật phẩm thật).
  UPDATE public.books SET published = false WHERE slug = 'hao-khi-dong-a';
  INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
       VALUES (v_user, 'hao-khi-dong-a', 4);
  BEGIN
    v_res := public._complete_book_for(v_user, 'hao-khi-dong-a');
    RAISE EXCEPTION 'hoàn thành được quyển chưa xuất bản';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE 'Book not found%' THEN RAISE; END IF;
  END;
  UPDATE public.books SET published = true WHERE slug = 'hao-khi-dong-a';

  -- 5. Quyển 0 trang không được thành máy phát vật phẩm.
  INSERT INTO public.books (slug, shelf_slug, position, title, era, published)
       VALUES ('__selfcheck-rong', 'lich-su-viet-nam', 99, 'Rỗng', '—', true);
  INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
       VALUES (v_user, '__selfcheck-rong', 1);
  BEGIN
    v_res := public._complete_book_for(v_user, '__selfcheck-rong');
    RAISE EXCEPTION 'hoàn thành được quyển 0 trang';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg NOT LIKE 'Book has no pages%' THEN RAISE; END IF;
  END;

  -- 6. Quyền: _complete_book_for phải kín, complete_book chỉ mở cho authenticated.
  IF has_function_privilege('anon', 'public._complete_book_for(uuid, text)', 'EXECUTE')
  OR has_function_privilege('authenticated', 'public._complete_book_for(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '_complete_book_for lộ EXECUTE — tự trao vật phẩm cho user bất kỳ được';
  END IF;
  IF has_function_privilege('anon', 'public.complete_book(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon gọi được complete_book';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.complete_book(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated không gọi được complete_book';
  END IF;

  -- Dọn fixture. auth.users ON DELETE CASCADE kéo theo progress và items.
  DELETE FROM public.books WHERE slug = '__selfcheck-rong';
  DELETE FROM auth.users   WHERE id = v_user;

  RAISE NOTICE 'Task 4 OK';
END $$;
```

- [ ] **Step 2: Chạy file qua MCP để thấy khối mới HỎNG**

Kỳ vọng: hỏng ở ca 4 hoặc 5 (`hoàn thành được quyển chưa xuất bản` / `quyển 0 trang`) vì hàm cũ còn đọc `book_unlocks` — nó không biết `published` và lấy `page_count` từ bảng xương.

- [ ] **Step 3: Thay thân hàm trong file schema**

```sql
-- ---------------------------------------------------------------------------
-- RPC. Vẫn tách hai hàm vì SQL proxy của InsForge chặn set_config('request.jwt.claims',…)
-- nên auth.uid() không giả lập được và hàm một-mảnh sẽ không test được.
-- BẢO MẬT: _complete_book_for KHÔNG ĐƯỢC cấp EXECUTE cho anon/authenticated.
-- Đổi so với bản cũ: đọc books/pages thay cho book_unlocks; lọc `published`; và
-- "quyển kế tiếp đã mở" tính từ vật phẩm thưởng của CHÍNH quyển vừa xong (spec §2.2).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._complete_book_for(p_user_id uuid, p_book_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_book              RECORD;
  v_page_count        integer;
  v_progress          RECORD;
  v_already_completed boolean := false;
  v_next              RECORD;
  v_has_next          boolean := false;
  v_next_unlocked     boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_book FROM public.books WHERE slug = p_book_slug AND published;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  SELECT count(*) INTO v_page_count FROM public.pages WHERE book_slug = p_book_slug;
  IF v_page_count = 0 THEN
    -- Không có dòng này thì current_page >= 0 luôn đúng và quyển rỗng thành máy phát
    -- vật phẩm.
    RAISE EXCEPTION 'Book has no pages';
  END IF;

  SELECT * INTO v_progress
    FROM public.user_book_progress
   WHERE user_id = p_user_id AND book_slug = p_book_slug
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
         VALUES (p_user_id, p_book_slug, 1)
      RETURNING * INTO v_progress;
  END IF;

  IF v_progress.completed THEN
    v_already_completed := true;
  ELSE
    IF v_progress.current_page < v_page_count THEN
      RAISE EXCEPTION 'Book not finished yet (page % of %)', v_progress.current_page, v_page_count;
    END IF;

    UPDATE public.user_book_progress
       SET completed = true, completed_at = now()
     WHERE user_id = p_user_id AND book_slug = p_book_slug;

    IF v_book.reward_item_slug IS NOT NULL THEN
      INSERT INTO public.user_items (user_id, item_slug)
           VALUES (p_user_id, v_book.reward_item_slug)
      ON CONFLICT (user_id, item_slug) DO NOTHING;
    END IF;
  END IF;

  SELECT * INTO v_next
    FROM public.books
   WHERE shelf_slug = v_book.shelf_slug AND position > v_book.position AND published
   ORDER BY position ASC LIMIT 1;
  v_has_next := FOUND;

  IF v_has_next THEN
    -- Quyển kế tiếp mở ⟺ người dùng có vật phẩm thưởng của quyển này. Không tra cột
    -- required_item_slug nào cả — nó không tồn tại, nên chuỗi không thể đứt.
    v_next_unlocked := v_book.reward_item_slug IS NULL
      OR EXISTS (SELECT 1 FROM public.user_items
                  WHERE user_id = p_user_id AND item_slug = v_book.reward_item_slug);
  END IF;

  RETURN jsonb_build_object(
    'alreadyCompleted', v_already_completed,
    'grantedItemSlug',  v_book.reward_item_slug,
    'nextBook',
      CASE WHEN v_has_next
           THEN jsonb_build_object('slug', v_next.slug, 'unlocked', v_next_unlocked)
           ELSE null END
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.complete_book(p_book_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $w$ SELECT public._complete_book_for(auth.uid(), p_book_slug) $w$;

REVOKE ALL ON FUNCTION public._complete_book_for(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_book(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_book(text) TO authenticated;

-- FK của tiến độ đọc chuyển từ bảng xương sang bảng nội dung thật.
ALTER TABLE public.user_book_progress DROP CONSTRAINT IF EXISTS user_book_progress_book_slug_fkey;
ALTER TABLE public.user_book_progress
  ADD CONSTRAINT user_book_progress_book_slug_fkey
  FOREIGN KEY (book_slug) REFERENCES public.books(slug) ON DELETE CASCADE;
```

- [ ] **Step 4: Chạy lại cả file qua MCP**

Kỳ vọng: `Task 1 OK`, `Task 2 OK`, `Task 4 OK`.

Khối tự kiểm của Task 3 **cố ý không nằm trong file schema**: nó khẳng định *dữ liệu* (1 kệ, 5 sách, 20 trang), còn file này mô tả *cấu trúc*. Trộn hai thứ vào một file thì mỗi lần chạy lại schema trên một DB trống sẽ hỏng vì chưa seed.

- [ ] **Step 5: Xác nhận `book_unlocks` vẫn còn và ứng dụng chưa vỡ**

```bash
npm run db:check
```

Kỳ vọng: vẫn 6/6. Nếu phép 1 hỏng thì bảng `book_unlocks` đã bị xóa sớm — Task 5 mới xóa nó.

- [ ] **Step 6: Commit**

```bash
git add -- db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
git commit -m "feat(db): complete_book doc books/pages, loc published, bo chuoi mo khoa luu san" -- db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
```

---

### Task 5: `db:check` lên 11 phép, rồi xóa `book_unlocks`

**Files:**
- Modify: `scripts/db-check.mjs`
- Modify: `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` (thêm `DROP TABLE book_unlocks` ở cuối)

**Interfaces:**
- Consumes: bảng nội dung + policy từ Task 2, RPC từ Task 4.
- Produces: `npm run db:check` khẳng định 11 ranh giới. Đọc hai biến tùy chọn `DB_CHECK_USER_EMAIL` / `DB_CHECK_USER_PASSWORD` từ `.env.local`.

- [ ] **Step 1: Tạo tài khoản test cho phép 10 và 11**

Luồng đăng nhập thật là OTP qua email nên không tự động hóa được. Dùng đường mật khẩu, đúng cách bản bàn giao đã ghi:

```bash
node --env-file-if-exists=.env.local --input-type=module -e "
import { createClient } from '@insforge/sdk';
const c = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
console.log(JSON.stringify(await c.auth.signUp({ email: 'dbcheck@example.com', password: 'dbcheck-mat-khau-dai' })));
"
```

Rồi mở khóa xác minh email qua MCP `run-raw-sql`:

```sql
UPDATE auth.users SET email_verified = true WHERE email = 'dbcheck@example.com';
```

Tài khoản này **không** được cấp `user_roles` — nó phải là người dùng thường thì phép 10 và 11 mới có nghĩa.

- [ ] **Step 1b: Tạo quyển nháp làm mồi nhử cho phép 7**

Không có nó thì phép 7 rỗng nghĩa: mọi sách thật đều `published = true`, nên truy vấn "sách nháp" trả 0 dòng kể cả khi RLS hỏng. Quyển này vĩnh viễn không xuất bản nên người dùng không bao giờ thấy. Chạy qua MCP `run-raw-sql`:

```sql
INSERT INTO public.books (slug, shelf_slug, position, title, era, published)
VALUES ('__nhap-khong-bao-gio-xuat-ban', 'lich-su-viet-nam', 900,
        'Mồi nhử cho db:check — đừng xuất bản', '—', false)
ON CONFLICT (slug) DO UPDATE SET published = false;
```

Thêm ghi chú vào cuối `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` để lần sau không ai dọn nhầm:

```sql
-- Quyển nháp cố định làm mồi nhử cho `npm run db:check` phép 7. Xóa nó đi thì phép
-- đó thành rỗng nghĩa: mọi sách thật đều đã xuất bản nên truy vấn sẽ trả 0 dòng dù
-- RLS có hỏng hay không. position = 900 để không đụng thứ tự sách thật.
INSERT INTO public.books (slug, shelf_slug, position, title, era, published)
VALUES ('__nhap-khong-bao-gio-xuat-ban', 'lich-su-viet-nam', 900,
        'Mồi nhử cho db:check — đừng xuất bản', '—', false)
ON CONFLICT (slug) DO UPDATE SET published = false;
```

- [ ] **Step 1c: Tạo dòng vai trò "của người khác" làm mồi nhử cho phép 11**

Vế thứ hai của phép 11 — "không đọc trộm được vai trò của người khác" — chỉ có nghĩa khi trong bảng thật sự tồn tại một dòng **không** thuộc tài khoản test. Task 3 Step 5 để việc cấp admin là tùy chọn, nên không được dựa vào nó.

Tài khoản mồi nhử này không có mật khẩu nên không đăng nhập được; nó chỉ tồn tại để làm dòng dữ liệu mà tài khoản test **phải không** nhìn thấy. Chạy qua MCP `run-raw-sql`:

```sql
INSERT INTO auth.users (id, email, email_verified, is_project_admin, is_anonymous)
VALUES ('22222222-2222-2222-2222-222222222222',
        '__moi-nhu-vai-tro@example.invalid', false, false, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('22222222-2222-2222-2222-222222222222', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

Thêm cùng hai câu đó vào cuối `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` kèm ghi chú vì sao — cùng lý do với quyển nháp mồi nhử ở Step 1b: xóa nó đi thì phép 11 im lặng thành rỗng nghĩa.

- [ ] **Step 2: Thêm hai biến vào `.env.local`** (file đã gitignore)

```
DB_CHECK_USER_EMAIL=dbcheck@example.com
DB_CHECK_USER_PASSWORD=dbcheck-mat-khau-dai
```

- [ ] **Step 3: Sửa `scripts/db-check.mjs`**

Đổi phép 1 sang bảng mới, rồi thêm 4 phép. Chèn ngay sau phép cuối cùng đang có (phép `anon đọc user_items ra rỗng`):

```js
// --- Phép 1 đổi bảng: book_unlocks không còn, kệ nay đọc từ `books` ------------
// (thay thế nguyên khối check "anon ĐỌC ĐƯỢC book_unlocks")
await check(
  "anon ĐỌC ĐƯỢC books đã xuất bản (kệ phải hiện ra khi chưa đăng nhập)",
  () => anon.database.from("books").select("slug, published"),
  ({ data, error }) =>
    error
      ? `bị chặn: ${errorLabel(error)}`
      : (data ?? []).length > 0
        ? null
        : "không đọc được quyển nào",
);

// --- Phép 7 -------------------------------------------------------------------
// Mồi nhử: một quyển CỐ Ý để nháp vĩnh viễn, tạo ở Step 1. Không có nó thì phép này
// rỗng nghĩa — mọi sách thật đều đã xuất bản nên truy vấn trả 0 dòng kể cả khi RLS
// hỏng hoàn toàn.
const DRAFT_BAIT = "__nhap-khong-bao-gio-xuat-ban";

await check(
  "anon KHÔNG đọc được sách nháp (RLS: published OR is_admin())",
  () => anon.database.from("books").select("slug, published").eq("slug", DRAFT_BAIT),
  ({ data, error }) =>
    error
      ? `lỗi bất thường: ${errorLabel(error)}`
      : (data ?? []).length === 0
        ? null
        : `lộ quyển nháp ${DRAFT_BAIT} — RLS "read published" hỏng`,
);

// --- Phép 8 -------------------------------------------------------------------
await check(
  "anon KHÔNG ghi được user_roles (không ai tự phong admin được)",
  () => anon.database.from("user_roles").insert([{ user_id: FAKE_UUID, role: "admin" }]),
  ({ error }) => (error ? null : "GHI ĐƯỢC — bất kỳ ai cũng thành admin"),
);

// --- Phép 9 -------------------------------------------------------------------
await check(
  "anon KHÔNG ghi được books (nội dung chỉ admin sửa)",
  () =>
    anon.database
      .from("books")
      .insert([{ slug: SENTINEL, shelf_slug: "lich-su-viet-nam", position: 999, title: "x", era: "x" }]),
  ({ error }) =>
    error ? null : "GHI ĐƯỢC — xóa dòng rác " + SENTINEL,
);

// --- Phép 10: phép quan trọng nhất của đợt này --------------------------------
// Đi đúng đường của kẻ tấn công CÓ TÀI KHOẢN. Phải thất bại vì POLICY chặn, chứ
// không phải vì thiếu GRANT — thiếu GRANT thì admin thật cũng ghi hỏng.
//
// CẢNH BÁO: không phân biệt được hai trường hợp đó bằng sqlstate. Postgres trả
// CHUNG mã 42501 cho cả hai, chỉ khác message ("permission denied for table" vs
// "new row violates row-level security policy"). Bắt buộc soi message.
//
// Kiểm hai thứ trong một phiên: không sửa được nội dung, và không tự phong admin.
//
// Khối này BẮT BUỘC nằm CUỐI file: nó tạo một client đã đăng nhập, và đặt nó
// trước các phép dùng `anon` sẽ mở đường cho việc phiên rò sang client kia.
const SENTINEL_AUTH = SENTINEL + "_authed";
const testEmail = process.env.DB_CHECK_USER_EMAIL;
const testPassword = process.env.DB_CHECK_USER_PASSWORD;

if (!testEmail || !testPassword) {
  console.warn(
    "\n!!  BỎ QUA phép 10 và 11 — thiếu DB_CHECK_USER_EMAIL / DB_CHECK_USER_PASSWORD trong .env.local.\n" +
      "!!  Đây là hàng rào QUAN TRỌNG NHẤT của tầng nội dung: người dùng thường không được\n" +
      "!!  sửa sách. Nó đang KHÔNG được kiểm.\n",
  );
} else {
  const user = createClient({ baseUrl, anonKey });
  const signIn = await user.auth.signInWithPassword({ email: testEmail, password: testPassword });

  await check(
    "authenticated (không phải admin) KHÔNG ghi được books",
    async () => {
      if (signIn.error) return { signInError: signIn.error };
      // `published: true` KHÔNG phải trang trí — nó là thứ làm phép kiểm này có nghĩa.
      // Nếu thiếu, cột mặc định `false`, và policy đọc `published OR is_admin()` khiến
      // chính phiên non-admin này KHÔNG thấy dòng nó vừa ghi. Khi đó một policy ghi bị
      // hở sẽ cho INSERT thành công không lỗi, đọc lại ra 0 dòng, và phép kiểm báo ĐẠT
      // đúng vào lúc hàng rào bị phá. Đặt `published: true` khiến mọi cú ghi lọt qua
      // đều hiện ra ở bước đọc lại. Ở trạng thái đúng thì `WITH CHECK` chặn trước khi
      // giá trị này kịp có ý nghĩa, nên nó vô hại.
      const insert = await user.database
        .from("books")
        .insert([
          {
            slug: SENTINEL_AUTH,
            shelf_slug: "lich-su-viet-nam",
            position: 998,
            title: "x",
            era: "x",
            published: true,
          },
        ]);
      const readBack = await user.database.from("books").select("slug").eq("slug", SENTINEL_AUTH);
      return { insert, rows: readBack.data ?? [], readError: readBack.error };
    },
    ({ signInError, insert, rows, readError, error }) => {
      // `error` là ngoại lệ do chính `check` bắt, khác với lỗi trong {data,error} của SDK.
      if (error) return `lỗi bất thường: ${errorLabel(error)}`;
      if (signInError) return `không đăng nhập được tài khoản test: ${errorLabel(signInError)}`;
      if ((rows ?? []).length > 0) return "GHI ĐƯỢC — xóa dòng rác " + SENTINEL_AUTH;
      // Đọc lại mà lỗi thì "0 dòng" không chứng minh được gì — đừng coi là đạt.
      if (readError) return `không đọc lại được để kiểm chứng: ${errorLabel(readError)}`;
      // Tới đây `insert` không lỗi VÀ đọc lại thành công ra 0 dòng. Với `published: true`
      // ở payload, một cú ghi lọt qua chắc chắn đã hiện ra ở nhánh trên, nên trường hợp
      // này là policy chặn mà driver không báo lỗi.
      if (!insert?.error) return null;
      const code = insert.error.code ?? insert.error.error ?? "";
      const message = insert.error.message ?? "";
      // Postgres dùng CHUNG sqlstate 42501 cho cả "thiếu GRANT" (message "permission
      // denied for table") lẫn "RLS WITH CHECK chặn" (message "new row violates
      // row-level security policy") — đã kiểm thực nghiệm 2026-08-24 ngay trên backend
      // này: anon (thật sự 0 GRANT) và authenticated (có GRANT, bị policy admin write
      // chặn) đều trả về đúng code "42501", chỉ khác ở message. Không thể phân biệt
      // hai trường hợp bằng code, bắt buộc phải soi message.
      const isRlsCheckFailure = /row-level security/i.test(message);
      return code === "42501" && !isRlsCheckFailure
        ? `bị chặn bằng 42501 không phải RLS (${message}) — nghi thiếu GRANT, admin thật cũng ghi hỏng`
        : null;
    },
  );

  // Phép này bắt HAI thứ trong một truy vấn đọc lại:
  //   a) không tự ghi được dòng admin cho chính mình;
  //   b) không đọc trộm được dòng của NGƯỜI KHÁC — chủ dự án đã có một dòng
  //      role='admin' từ Task 3, và tài khoản test phải thấy ĐÚNG 0 dòng.
  // Vế (b) là thứ duy nhất chứng minh policy "own role select" thật sự lọc theo
  // auth.uid(); `has_table_privilege` trong khối tự kiểm SQL không với tới được.
  await check(
    "authenticated KHÔNG tự phong admin, cũng KHÔNG đọc được vai trò người khác",
    async () => {
      if (signIn.error) return { signInError: signIn.error };
      const me = await user.auth.getCurrentUser();
      const insert = await user.database
        .from("user_roles")
        .insert([{ user_id: me.data?.user?.id, role: "admin" }]);
      const readBack = await user.database.from("user_roles").select("user_id, role");
      return {
        insert,
        rows: readBack.data ?? [],
        readError: readBack.error,
        myId: me.data?.user?.id,
      };
    },
    ({ signInError, insert, rows, readError, myId, error }) => {
      if (error) return `lỗi bất thường: ${errorLabel(error)}`;
      if (signInError) return `không đăng nhập được tài khoản test: ${errorLabel(signInError)}`;
      if (readError) return `không đọc lại được để kiểm chứng: ${errorLabel(readError)}`;
      const seen = rows ?? [];
      if (seen.some((r) => r.user_id === myId)) {
        return "TỰ PHONG ADMIN ĐƯỢC — xóa dòng trong user_roles ngay";
      }
      if (seen.length > 0) {
        return `đọc được ${seen.length} dòng vai trò của người khác — policy "own role select" không lọc theo auth.uid()`;
      }
      return insert?.error ? null : "insert không báo lỗi mà cũng không thấy dòng — kiểm tay";
    },
  );

  if (!signIn.error) await user.auth.signOut();
}
```

- [ ] **Step 3b: Đóng ba chỗ "lỗi cũng tính là đạt" và làm dòng tổng kết không nói dối**

Ba việc nhỏ, cùng một họ với lỗi ở Step 3: một khẳng định coi *lỗi truy vấn* và *0 dòng* là như nhau thì nó đạt cả khi hàng rào còn nguyên lẫn khi truy vấn hỏng vì lý do chẳng liên quan gì.

1. **Phép 6 (`anon đọc user_items ra rỗng`)** đang viết `error || (data?.length ?? 0) === 0 ? null : …` — mọi lỗi đều thành "đạt".

Nhưng **đừng tách thành "lỗi là hỏng"**: `user_items` đã bị `REVOKE ALL` khỏi `anon` từ `2026-08-12-ke-sach-doc-sach.sql`, nên đường an toàn ở đây **luôn** là một lỗi `42501`, không bao giờ là "0 dòng". Coi mọi lỗi là hỏng thì phép này đỏ vĩnh viễn. Phải thu hẹp đúng vào hình dạng lỗi mong đợi:

```js
  ({ data, error }) => {
    if (!error) return (data?.length ?? 0) === 0 ? null : `đọc ra ${data.length} dòng của người khác`;
    // user_items REVOKE ALL khỏi anon ngay từ 2026-08-12-ke-sach-doc-sach.sql — anon
    // không có cả SELECT, nên đường an toàn LUÔN lỗi 42501 "permission denied for
    // table" (đã kiểm thực nghiệm 2026-08-24), không bao giờ chạy tới nhánh RLS lọc
    // rỗng ở trên. Một lỗi khác (đổi tên bảng, mất mạng, …) không chứng minh được gì
    // nên vẫn phải coi là hỏng — không tự động biến MỌI lỗi thành "đạt".
    const code = error.code ?? error.error ?? "";
    return code === "42501" ? null : `lỗi bất thường: ${errorLabel(error)}`;
  },
```

Đổi luôn tên phép cho đúng sự thật — bản cũ ghi `(RLS auth.uid() = user_id, anon không có uid)`, nhưng thứ thật sự chặn là REVOKE chứ không phải RLS:

```
"anon đọc user_items ra rỗng (REVOKE ALL khỏi anon; đổi grant thì RLS auth.uid() = user_id vẫn lọc rỗng)"
```

Đây là phép có từ trước đợt này, nhưng để nguyên thì `db:check` vẫn còn đúng một khẳng định không thể fail — mà cả task này tồn tại là để `db:check` đáng tin.

2. **Dòng tổng kết phải nói ra việc bỏ qua.** Hiện tại khi thiếu hai biến môi trường, script in `OK — 9/9 ranh giới còn nguyên.` và thoát 0 — nhìn y hệt một lần chạy đầy đủ. Ai chỉ đọc dòng cuối trong log CI sẽ tưởng mọi thứ ổn. Đếm số phép bị bỏ qua và đưa vào chính dòng đó:

```js
console.log(
  failed === 0
    ? `\nOK — ${results.length}/${results.length} ranh giới còn nguyên.` +
        (skipped > 0 ? ` (${skipped} PHÉP BỊ BỎ QUA — xem cảnh báo phía trên.)` : "")
    : `\n${failed}/${results.length} KIỂM TRA HỎNG. Đừng deploy cho tới khi sửa xong.`,
);
```

Đặt `let skipped = 0;` cạnh `const results = []`, và `skipped = 2;` trong nhánh thiếu biến môi trường.

3. **Sửa hai comment đang nói sai.** Comment mở đầu phép 10 vẫn viết theo lối "phải thất bại theo kiểu policy, KHÔNG phải 42501", trong khi comment cách đó 40 dòng chứng minh `42501` xuất hiện ở *cả hai* trường hợp — người đọc lướt sẽ tin cái sai vì nó nằm trước. Và comment ở phép 11 nói "chủ dự án đã có một dòng role='admin' từ Task 3" như một sự thật, trong khi chính Task 3 ghi rõ bước cấp admin đó là tùy chọn; thứ làm phép 11 có nghĩa là dòng mồi nhử ở Step 1c, không phải dòng của chủ dự án.

- [ ] **Step 4: Chạy và đọc kỹ từng dòng**

```bash
npm run db:check
```

Kỳ vọng: `OK — 11/11 ranh giới còn nguyên`, không có phần "BỊ BỎ QUA". Phép 10 phải đạt vì **message** báo RLS chặn, không phải vì mã lỗi — cả hai trường hợp đều là `42501`.

Rồi tạm đổi tên `DB_CHECK_USER_EMAIL` trong `.env.local` thành `DB_CHECK_USER_EMAIL_X` và chạy lại: phải ra `OK — 9/9 … (2 PHÉP BỊ BỎ QUA — xem cảnh báo phía trên.)` và thoát mã 0. Đổi tên lại rồi chạy lại lần nữa.

- [ ] **Step 5: Xóa bảng xương cũ qua MCP**

```sql
DROP TABLE IF EXISTS public.book_unlocks;
```

Thêm đúng dòng đó vào cuối `db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql` kèm ghi chú:

```sql
-- book_unlocks là bản chiếu của mô hình JSON cũ. Nội dung nay nằm thẳng trong `books`
-- và `pages`, `_complete_book_for` đọc trực tiếp từ đó, nên bảng này không còn ai dùng.
DROP TABLE IF EXISTS public.book_unlocks;
```

- [ ] **Step 6: Chạy lại `npm run db:check` sau khi xóa**

Kỳ vọng: vẫn 11/11 (không phép nào còn nhắc `book_unlocks`).

- [ ] **Step 7: Commit**

```bash
git add -- scripts/db-check.mjs db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
git commit -m "test(db): db:check len 11 phep, bo bang book_unlocks" -- scripts/db-check.mjs db/schema/2026-08-24-noi-dung-dong-va-quan-tri.sql
```

---

### Task 6: `resolveState` đổi sang vật phẩm của quyển trước

**Files:**
- Modify: `lib/insforge/unlock.ts`
- Test: `lib/insforge/unlock.test.ts`

**Interfaces:**
- Produces: `resolveState(prevRewardItem: string | null, isFirstBook: boolean, completed: boolean, owned: Set<string>): BookState` — Task 8 gọi nó.

Đây là task duy nhất trong plan có test JS thật, vì `unlock.ts` là module thuần import tương đối duy nhất bị đụng tới.

`lib/insforge/unlock.test.ts` đã có 6 test phủ đủ mọi nhánh của `resolveState`, và chữ ký hàm không đổi thứ tự tham số — nên **không thêm test trùng lặp**. Đúng một ca còn thiếu, và một tiêu đề test dùng từ vựng cũ.

- [ ] **Step 1: Viết ca còn thiếu và sửa tiêu đề cũ**

Trong `lib/insforge/unlock.test.ts`, đổi tiêu đề test cuối cùng (đang viết `requiredItem null ở giữa kệ…`) sang từ vựng mới:

```ts
test("quyển trước không thưởng gì thì quyển sau không có cổng", () => {
  assert.equal(resolveState(null, false, false, none), "unlocked");
});
```

Rồi thêm **một** ca thật sự chưa được phủ — quyển đầu kệ phải mở kể cả khi có ai đó truyền nhầm một vật phẩm vào:

```ts
test("quyển đầu kệ mở bất kể tham số vật phẩm — không có 'quyển trước' để mà đòi", () => {
  assert.equal(resolveState("trong-dong", true, false, none), "unlocked");
});
```

Ca này chặn một refactor tương lai bỏ mất nhánh tắt `isFirstBook`, thứ mà 6 test hiện có không bắt được vì chúng luôn truyền `null` cùng với `isFirstBook = true`.

- [ ] **Step 2: Chạy test để thấy ca mới hỏng**

```bash
npm test
```

Ca mới phải FAIL nếu bạn tạm bỏ nhánh `isFirstBook` khỏi `resolveState` — thử một lần cho chắc nó không phải là test rỗng nghĩa, rồi khôi phục. Với thân hàm nguyên vẹn thì cả 7 test đều xanh ngay, vì đây là đổi tên tham số chứ không đổi hành vi.

- [ ] **Step 3: Sửa `lib/insforge/unlock.ts`**

Thân hàm **không đổi**; chỉ tên tham số và phần chú thích:

```ts
import type { BookState } from "./types";

/**
 * Quy tắc mở khóa của cả sản phẩm, tách riêng ra khỏi `shelf.ts` vì đúng một lý do:
 * file này không import gì ngoài kiểu, nên `node --test` chạy thẳng được. Mọi module
 * đi qua alias `@/` đều không resolve dưới test runner của Node (đã thử), và quy tắc
 * này quá quan trọng để chỉ dựa vào việc bấm thử trên giao diện.
 *
 * Đây là bản chiếu phía client, dùng để vẽ kệ. Quyết định thật nằm ở RPC
 * `complete_book` trong Postgres — client không bao giờ được tự trao vật phẩm.
 *
 * `prevRewardItem` là vật phẩm thưởng của quyển NGAY TRƯỚC trong kệ. Không có cột
 * "vật phẩm cần để mở" nào trong database: nó suy ra được 100% từ vị trí, nên không
 * lưu thì chuỗi mở khóa không thể đứt.
 *
 * ponytail: khóa cứng chuỗi tuyến tính một-kệ. Muốn mở khóa chéo kệ hay phân nhánh
 * thì thêm lại cột `books.required_item_slug` nullable, null nghĩa là "vật phẩm của
 * quyển trước", rồi truyền nó vào đây thay cho `prevRewardItem`.
 */
export function resolveState(
  prevRewardItem: string | null,
  isFirstBook: boolean,
  completed: boolean,
  owned: Set<string>,
): BookState {
  if (completed) return "completed";
  // Quyển đầu mỗi kệ luôn mở sẵn để người học có điểm bắt đầu (content.md 4.1).
  if (isFirstBook || prevRewardItem === null) return "unlocked";
  return owned.has(prevRewardItem) ? "unlocked" : "locked";
}
```

- [ ] **Step 4: Chạy test để thấy nó xanh**

```bash
npm test
```

Kỳ vọng: PASS toàn bộ 7 test.

- [ ] **Step 5: Commit**

```bash
git add -- lib/insforge/unlock.ts lib/insforge/unlock.test.ts
git commit -m "refactor(unlock): mo khoa tinh tu vat pham quyen truoc thay vi cot luu san" -- lib/insforge/unlock.ts lib/insforge/unlock.test.ts
```

---

### Task 7: Đọc nội dung từ database

> **Task 7, 8 và 9 là MỘT thay đổi nguyên khối.** Đổi kiểu `ContentShelf` làm vỡ mọi consumer
> cùng lúc, nên không có ranh giới nào ở giữa để lại cây build được. `npm run check` sẽ đỏ từ
> Task 7 tới hết Task 8 — đó là **dự kiến**, không phải hỏng. Chỉ commit ở **cuối Task 9**.
> Nếu cần một mốc quay lui giữa chừng, dùng `git stash` chứ đừng commit cây đỏ.

**Files:**
- Create: `lib/content/read.ts`
- Create: `lib/content/find.ts`
- Modify: `lib/content/types.ts`
- Delete: `lib/content/shelves.ts`

**Interfaces:**
- Consumes: bảng nội dung (Task 2), dữ liệu đã seed (Task 3).
- Produces:
  - `readShelf(slug: string): Promise<ContentShelf | null>`
  - `readShelfList(): Promise<ShelfSummary[]>` với `interface ShelfSummary { slug: string; name: string; countryCode: string | null }`
  - `findBook(shelf: ContentShelf, bookSlug: string): ContentBook | null`
  - `findItem(shelf: ContentShelf, itemSlug: string): ContentItem | null`
  - `ContentBook` mất trường `requiredItem`; `ContentShelf` thêm `countryCode: string | null`.

- [ ] **Step 1: Sửa `lib/content/types.ts`**

```ts
export interface ContentItem {
  slug: string;
  name: string;
  image: string | null;
  description: string;
}

export interface ContentPage {
  heading: string;
  image: string | null;
  caption: string | null;
  body: string;
  /** Chỉ có ở trang cuối — 3-5 ý chính (content.md 4.3). */
  summary?: string[];
}

export interface ContentBook {
  slug: string;
  title: string;
  /** Niên đại dập trên bìa sách — chuỗi ngắn, ví dụ "Năm 938". */
  era: string;
  cover: string | null;
  /**
   * Vật phẩm nhận được khi đọc xong. Đây cũng là thứ mở khóa quyển kế tiếp —
   * không có trường `requiredItem`, xem lib/insforge/unlock.ts.
   */
  rewardItem: string | null;
  pages: ContentPage[];
}

export interface ContentShelf {
  slug: string;
  name: string;
  order: number;
  /** Mã ISO-3166-1 numeric để nối với bản đồ thế giới; null nghĩa là chưa gắn. */
  countryCode: string | null;
  items: ContentItem[];
  books: ContentBook[];
}
```

- [ ] **Step 2: Viết `lib/content/read.ts`**

```ts
import { insforge } from "@/lib/insforge/client";
import type { ContentBook, ContentItem, ContentPage, ContentShelf } from "./types";

/**
 * Nội dung bài học nằm TRONG DATABASE (spec 2026-08-24 §2.1) — admin sửa xong là
 * thấy ngay, không cần build lại.
 *
 * Dữ liệu này public nên server component đọc được bằng khóa anon; RLS tự lọc bản
 * nháp cho ai không phải admin. Chỉ TRẠNG THÁI NGƯỜI DÙNG mới bắt buộc chạy phía
 * client, vì phiên InsForge nằm ở trình duyệt — ranh giới đó giữ nguyên như cũ.
 *
 * Một truy vấn lồng ba tầng shelves → books → pages. PostgREST làm được (đã kiểm
 * bằng request thật ngày 2026-08-24), nên trang kệ chỉ tốn một round-trip.
 */
const SHELF_SELECT =
  "slug, name, position, country_code, " +
  "books(slug, title, era, cover_url, position, reward_item_slug, " +
  "pages(position, heading, body, image_url, caption, summary))";

interface PageRow {
  position: number;
  heading: string;
  body: string;
  image_url: string | null;
  caption: string | null;
  summary: string[] | null;
}

interface BookRow {
  slug: string;
  title: string;
  era: string;
  cover_url: string | null;
  position: number;
  reward_item_slug: string | null;
  pages: PageRow[];
}

interface ShelfRow {
  slug: string;
  name: string;
  position: number;
  country_code: string | null;
  books: BookRow[];
}

interface ItemRow {
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
}

export interface ShelfSummary {
  slug: string;
  name: string;
  countryCode: string | null;
}

const byPosition = <T extends { position: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.position - b.position);

function toPage(row: PageRow): ContentPage {
  return {
    heading: row.heading,
    body: row.body,
    image: row.image_url,
    caption: row.caption,
    ...(row.summary?.length ? { summary: row.summary } : {}),
  };
}

function toBook(row: BookRow): ContentBook {
  return {
    slug: row.slug,
    title: row.title,
    era: row.era,
    cover: row.cover_url,
    rewardItem: row.reward_item_slug,
    pages: byPosition(row.pages ?? []).map(toPage),
  };
}

function toItem(row: ItemRow): ContentItem {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.image_url,
  };
}

/** Trả về null khi không có kệ nào mang slug đó, hoặc kệ đó chưa xuất bản. */
export async function readShelf(slug: string): Promise<ContentShelf | null> {
  // Vật phẩm là bảng dùng chung cho mọi kệ nên không lồng được vào truy vấn trên;
  // hai request này độc lập, chạy song song.
  const [shelfRes, itemsRes] = await Promise.all([
    insforge.database.from("shelves").select(SHELF_SELECT).eq("slug", slug).maybeSingle(),
    insforge.database.from("items").select("slug, name, description, image_url"),
  ]);

  if (shelfRes.error || !shelfRes.data) return null;
  const row = shelfRes.data as ShelfRow;

  return {
    slug: row.slug,
    name: row.name,
    order: row.position,
    countryCode: row.country_code,
    items: ((itemsRes.data ?? []) as ItemRow[]).map(toItem),
    books: byPosition(row.books ?? []).map(toBook),
  };
}

/** Danh sách kệ đã xuất bản, cho thanh điều hướng và bản đồ. */
export async function readShelfList(): Promise<ShelfSummary[]> {
  const { data, error } = await insforge.database
    .from("shelves")
    .select("slug, name, position, country_code")
    .order("position");
  if (error) return [];
  // Kiểu riêng, KHÔNG dùng lại ShelfRow: truy vấn này không lấy `books`.
  type ShelfListRow = Omit<ShelfRow, "books">;
  return ((data ?? []) as ShelfListRow[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    countryCode: row.country_code,
  }));
}
```

- [ ] **Step 3: Viết `lib/content/find.ts`**

```ts
import type { ContentBook, ContentItem, ContentShelf } from "./types";

/** Tra cứu trong một kệ ĐÃ TẢI. Không chạm database — nội dung đi xuống qua prop. */
export function findBook(shelf: ContentShelf, bookSlug: string): ContentBook | null {
  return shelf.books.find((b) => b.slug === bookSlug) ?? null;
}

export function findItem(shelf: ContentShelf, itemSlug: string): ContentItem | null {
  return shelf.items.find((i) => i.slug === itemSlug) ?? null;
}
```

- [ ] **Step 4: Xóa `lib/content/shelves.ts`**

```bash
git rm lib/content/shelves.ts
```

Build đỏ từ đây tới hết Task 8 — đúng như banner đầu task đã nói. Commit ở cuối Task 9.

- [ ] **Step 5: Kiểm nhanh rằng `readShelf` đọc được thật**

```bash
node --env-file-if-exists=.env.local --input-type=module -e "
import { createClient } from '@insforge/sdk';
const c = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
const r = await c.database.from('shelves')
  .select('slug, name, position, country_code, books(slug, position, reward_item_slug, pages(position, heading))')
  .eq('slug','lich-su-viet-nam').maybeSingle();
const s = r.data;
console.log('kệ:', s?.name, '| sách:', s?.books.length, '| trang quyển 1:', s?.books.find(b=>b.position===1)?.pages.length, '| err:', JSON.stringify(r.error));
"
```

Kỳ vọng: `kệ: Lịch sử Việt Nam | sách: 5 | trang quyển 1: 4 | err: null`.

---

### Task 8: Truyền nội dung xuống qua prop

**Files:**
- Modify: `lib/insforge/shelf.ts`
- Modify: `components/shelf/ShelfPageClient.tsx`
- Modify: `components/reader/BookReaderModal.tsx:113-125`
- Modify: `components/reader/ItemDropOverlay.tsx:1-21`

**Interfaces:**
- Consumes: `findBook` / `findItem` (Task 7), `resolveState` (Task 6).
- Produces: `buildShelfView(shelf: ContentShelf, state: UserShelfState): ShelfView`. `ShelfPageClient` nhận prop `{ shelf: ContentShelf }`. `BookReaderModal` và `ItemDropOverlay` nhận prop `shelf: ContentShelf` thay cho `shelfSlug: string`.

`BookShelf`, `BookCover`, `BookPage` **không đổi một dòng nào** — chúng vốn thuần prop. `BookView.requiredItem` trong `lib/insforge/types.ts` cũng giữ nguyên; chỉ nguồn của nó đổi.

- [ ] **Step 1: Sửa `buildShelfView` trong `lib/insforge/shelf.ts`**

Thay import và toàn bộ hàm:

```ts
import { findItem } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
```

```ts
/** Ghép nội dung (đã tải từ server component) với trạng thái người dùng. */
export function buildShelfView(shelf: ContentShelf, state: UserShelfState): ShelfView {
  return {
    slug: shelf.slug,
    name: shelf.name,
    books: shelf.books.map((book, index): BookView => {
      const progress = state.progressByBook.get(book.slug);
      // Vật phẩm mở quyển này = vật phẩm thưởng của quyển ngay trước (spec §2.2).
      const prevRewardItem = index === 0 ? null : shelf.books[index - 1].rewardItem;
      const bookState = resolveState(
        prevRewardItem,
        index === 0,
        progress?.completed ?? false,
        state.ownedItemSlugs,
      );
      return {
        book,
        state: bookState,
        currentPage: progress?.currentPage ?? 1,
        requiredItem:
          bookState === "locked" && prevRewardItem ? findItem(shelf, prevRewardItem) : null,
      };
    }),
  };
}
```

Bỏ import `getItem, getShelf` từ `@/lib/content/shelves` (file đã xóa ở Task 7).

- [ ] **Step 2: Sửa `components/shelf/ShelfPageClient.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { BookReaderModal } from "@/components/reader/BookReaderModal";
import { findBook } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
import { onAuthChange } from "@/lib/insforge/auth";
import { buildShelfView, getUserShelfState } from "@/lib/insforge/shelf";
import type { UserShelfState } from "@/lib/insforge/types";
import { BookShelf } from "./BookShelf";

/** Chưa đăng nhập: kệ vẫn xem được, chỉ quyển đầu mở và tiến độ không lưu. */
const SIGNED_OUT: UserShelfState = { ownedItemSlugs: new Set(), progressByBook: new Map() };

/**
 * Nội dung tới từ server component qua prop; chỉ trạng thái người dùng (vật phẩm,
 * tiến độ) mới phải hỏi backend — và phiên đăng nhập của InsForge nằm ở trình duyệt,
 * nên phần đó bắt buộc chạy phía client.
 */
export function ShelfPageClient({ shelf }: { shelf: ContentShelf }) {
  const [userState, setUserState] = useState<UserShelfState>(SIGNED_OUT);
  const [openBookSlug, setOpenBookSlug] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getUserShelfState()
      .then(setUserState)
      .catch(() => setUserState(SIGNED_OUT));
  }, []);

  // Đăng nhập/đăng xuất ở header không đổi route, nên kệ phải tự nghe sự kiện phiên
  // thì mới mở/khóa lại đúng mà người dùng không cần tải lại trang.
  useEffect(() => {
    refresh();
    return onAuthChange(refresh);
  }, [refresh]);

  const view = buildShelfView(shelf, userState);
  const openBook = view.books.find((b) => b.book.slug === openBookSlug);

  return (
    <>
      <BookShelf shelf={view} onOpenBook={setOpenBookSlug} />
      {openBook && findBook(shelf, openBook.book.slug) && (
        <BookReaderModal
          shelf={shelf}
          bookSlug={openBook.book.slug}
          startPage={openBook.currentPage}
          onClose={() => {
            setOpenBookSlug(null);
            // Đọc xong có thể vừa nhận vật phẩm — lấy lại trạng thái để kệ mở khóa quyển sau.
            refresh();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Sửa `components/reader/BookReaderModal.tsx`**

Đổi import dòng 7:

```ts
import { findBook } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
```

Đổi chữ ký (khoảng dòng 113-125):

```tsx
export function BookReaderModal({
  shelf,
  bookSlug,
  startPage,
  onClose,
}: {
  shelf: ContentShelf;
  bookSlug: string;
  startPage: number;
  onClose: () => void;
}) {
  const book = findBook(shelf, bookSlug);
  if (!book) throw new Error(`Không có quyển "${bookSlug}" trong kệ "${shelf.slug}".`);
```

Trong JSX, đổi hai chỗ dùng `shelfSlug`:

```tsx
<ItemDropOverlay result={result} shelf={shelf} onClose={close} />
```

```tsx
href={`/dang-nhap?next=${encodeURIComponent(`/${shelf.slug}`)}`}
```

- [ ] **Step 4: Sửa `components/reader/ItemDropOverlay.tsx`**

Đổi dòng 2 và chữ ký:

```tsx
import { findBook, findItem } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
```

```tsx
export function ItemDropOverlay({
  result,
  shelf,
  onClose,
}: {
  result: CompleteBookResult;
  shelf: ContentShelf;
  onClose: () => void;
}) {
  const item = result.grantedItemSlug ? findItem(shelf, result.grantedItemSlug) : null;
  const nextBook = result.nextBook ? findBook(shelf, result.nextBook.slug) : null;
```

- [ ] **Step 5: Kiểm kiểu — build vẫn đỏ vì route cũ, đó là dự kiến**

```bash
npm run typecheck
```

Kỳ vọng: chỉ còn lỗi ở `app/lich-su-viet-nam/page.tsx` (import `getShelf` đã xóa). Task 9 dọn nốt. Nếu có lỗi ở file khác, sửa trước khi đi tiếp.

---

### Task 9: Route động `/[shelf]` + nav đọc từ DB

**Files:**
- Create: `app/[shelf]/page.tsx`
- Delete: `app/lich-su-viet-nam/page.tsx`
- Modify: `app/page.tsx`
- Modify: `components/Header.tsx`

**Interfaces:**
- Consumes: `readShelf`, `readShelfList`, `ShelfSummary` (Task 7); `ShelfPageClient` prop mới (Task 8).
- Produces: route `/[shelf]`; `Header` nhận prop `shelves: ShelfSummary[]`.

Next.js ưu tiên segment tĩnh hơn segment động, nên `/dang-nhap` (và `/quan-tri` ở chặng C) **không** bị `/[shelf]` nuốt.

- [ ] **Step 1: Tạo `app/[shelf]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ShelfPageClient } from "@/components/shelf/ShelfPageClient";
import { readShelf, readShelfList } from "@/lib/content/read";

export async function generateMetadata({ params }: PageProps<"/[shelf]">): Promise<Metadata> {
  const shelf = await readShelf((await params).shelf);
  return { title: shelf ? `${shelf.name} — Cửa Sổ Lịch Sử` : "Không tìm thấy kệ sách" };
}

export default async function ShelfPage({ params }: PageProps<"/[shelf]">) {
  const slug = (await params).shelf;
  const [shelf, shelves] = await Promise.all([readShelf(slug), readShelfList()]);
  if (!shelf) notFound();

  return (
    <>
      <Header activeHref={`/${shelf.slug}`} shelves={shelves} />
      {/* flex-col để căn phòng (Room) kéo giãn hết chiều cao còn lại của khung nhìn. */}
      <main className="flex flex-1 flex-col">
        <ShelfPageClient shelf={shelf} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Xóa route hardcode**

```bash
git rm app/lich-su-viet-nam/page.tsx
```

- [ ] **Step 3: Sửa `components/Header.tsx` — nav từ DB**

Thay hằng `NAV_ITEMS` bằng prop. Ba link cũ `/lich-su-the-gioi`, `/lich-su-quanh-cuoc-song`, `/bai-giang-slide` **bị bỏ**: chúng trỏ tới route không tồn tại, và nay `/[shelf]` sẽ biến chúng thành 404 thật thay vì lỗi 404 mặc định của Next.

```tsx
import Link from "next/link";
import { Backpack, Flame } from "lucide-react";
import { AuthMenu } from "@/components/auth/AuthMenu";
import type { ShelfSummary } from "@/lib/content/read";

const focusOnDark =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

/**
 * `shelves` do server component truyền xuống — danh sách kệ nay là dữ liệu động
 * (admin tạo thêm được), không còn là hằng trong mã nguồn.
 */
export function Header({
  activeHref,
  shelves = [],
}: {
  activeHref: string;
  shelves?: ShelfSummary[];
}) {
  const navItems = [
    { href: "/", label: "Trang chủ" },
    ...shelves.map((s) => ({ href: `/${s.slug}`, label: s.name })),
  ];

  return (
    <header className="flex h-header-height items-center justify-between bg-primary px-8">
      <Link href="/" className={`font-heading text-headline-sm text-on-primary ${focusOnDark}`}>
        CỬA SỔ LỊCH SỬ
      </Link>

      <nav className="flex items-center gap-lg" aria-label="Điều hướng chính">
        {navItems.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`font-body text-label-md transition-colors duration-200 ease-out ${focusOnDark} ${
                isActive ? "text-tertiary-light" : "text-on-primary hover:text-tertiary-light"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Streak và túi hành trang thuộc subsystem khác — số liệu ở đây là placeholder. */}
        <span className="flex items-center gap-xs text-on-primary" title="Chuỗi ngày học liên tục">
          <Flame aria-hidden className="h-5 w-5 text-tertiary-light" />
          <span className="font-body text-label-md">12</span>
          <span className="sr-only">ngày streak</span>
        </span>
        <span className="flex items-center gap-xs text-on-primary" title="Túi hành trang">
          <Backpack aria-hidden className="h-5 w-5" />
          <span className="font-body text-label-md">7</span>
          <span className="sr-only">vật phẩm đã sưu tầm</span>
        </span>

        <AuthMenu />
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Sửa `app/page.tsx` — link vào kệ dựng từ DB**

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { readShelfList } from "@/lib/content/read";

// Bản đồ thế giới thay chỗ trang này ở chặng D. Tạm thời: lối vào các kệ đang có.
export default async function Home() {
  const shelves = await readShelfList();

  return (
    <>
      <Header activeHref="/" shelves={shelves} />
      <main className="flex-1 px-page-margin py-xl">
        <p className="font-body text-label-caps uppercase text-tertiary-deep">Cửa sổ lịch sử</p>
        <h1 className="mt-sm max-w-2xl font-heading text-headline-lg text-primary-dark">
          Mỗi bài học là một quyển sách. Đọc xong một quyển, bạn nhận được vật phẩm mở khóa
          quyển tiếp theo.
        </h1>
        <div className="mt-lg flex flex-wrap gap-md">
          {shelves.map((shelf) => (
            <Link
              key={shelf.slug}
              href={`/${shelf.slug}`}
              className="inline-flex items-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
            >
              Vào kệ {shelf.name}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          ))}
        </div>
        {shelves.length === 0 && (
          <p className="mt-lg font-body text-body-md text-secondary">
            Chưa có kệ sách nào được xuất bản.
          </p>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Cập nhật `app/dang-nhap/page.tsx`**

`shelves` có mặc định `[]` nên trang này build được mà không sửa. Vẫn phải sửa: nếu không, thanh nav ở trang đăng nhập trống trơn còn mọi trang khác thì đầy đủ — người dùng thấy nav nhấp nháy khi chuyển trang.

```tsx
import { readShelfList } from "@/lib/content/read";
```

```tsx
export default async function DangNhapPage({ searchParams }: PageProps<"/dang-nhap">) {
  const [params, shelves] = await Promise.all([searchParams, readShelfList()]);
  const next = safeNext(params.next);

  return (
    <>
      <Header activeHref="/dang-nhap" shelves={shelves} />
```

Phần còn lại của file giữ nguyên.

- [ ] **Step 6: Chạy cổng đầy đủ**

```bash
npm run check
```

Kỳ vọng: xanh hết. Route in ra phải có `/[shelf]`, `/`, `/dang-nhap`, và **không** còn `/lich-su-viet-nam`.

- [ ] **Step 7: Kiểm bằng tay trên dev server**

```bash
npm run dev
```

Bốn thứ phải đúng: `/` hiện link vào kệ; `/lich-su-viet-nam` hiện đủ 5 bìa với quyển 1 mở và 4 quyển khóa; mở quyển 1 lật được 4 trang; `/khong-co-that` ra trang 404.

- [ ] **Step 8: Commit**

Cây làm việc có sẵn một đống thay đổi **không thuộc** plan này, **và index đã có sẵn một rename được stage từ trước** (`components/reader/PageSpread.tsx` → `BookPage.tsx`). Vì vậy `git add` thôi là chưa đủ: `git commit` sẽ cuốn luôn cái rename đó vào. Công thức đúng là `git add` rồi `git commit -- <đúng những path đó>` — pathspec ở `commit` bỏ qua mọi thứ khác đang nằm trong index.

Đặt danh sách path vào một biến để không phải gõ hai lần và không lệch giữa hai lệnh:

```bash
PATHS='app/[shelf]/page.tsx
lib/content/types.ts
lib/content/read.ts
lib/content/find.ts
lib/content/shelves.ts
lib/insforge/shelf.ts
components/Header.tsx
components/shelf/ShelfPageClient.tsx
components/reader/BookReaderModal.tsx
components/reader/ItemDropOverlay.tsx
app/page.tsx
app/dang-nhap/page.tsx
app/lich-su-viet-nam/page.tsx'

echo "$PATHS" | xargs -d '\n' git add --
echo "$PATHS" | xargs -d '\n' git commit -m "feat(content): doc noi dung tu database, route dong /[shelf]" --
git show --stat HEAD   # xác nhận KHÔNG có PageSpread.tsx/BookPage.tsx trong commit
```

`lib/content/shelves.ts` và `app/lich-su-viet-nam/page.tsx` nằm trong danh sách dù đã bị `git rm`: pathspec phải kể cả path bị xóa thì commit mới ghi nhận việc xóa.

---

### Task 10: Dọn dấu vết mô hình JSON

**Files:**
- Move: `content/shelves/` → `db/seed/`
- Modify: `scripts/seed-content.mjs` (đổi đường dẫn)
- Delete: `scripts/content-sync.mjs`
- Modify: `package.json`
- Modify: `CLAUDE.md`

**Interfaces:** không sinh ra interface mới; task này chỉ xóa và cập nhật tài liệu.

- [ ] **Step 1: Chuyển thư mục nội dung**

```bash
git mv content/shelves db/seed
rmdir content 2>/dev/null || true
```

- [ ] **Step 2: Sửa đường dẫn trong `scripts/seed-content.mjs`**

```js
const dir = join(root, "db", "seed");
```

- [ ] **Step 3: Xóa script chiếu cũ**

```bash
git rm scripts/content-sync.mjs
```

- [ ] **Step 4: Sửa `package.json`**

Bỏ `content:check` và `content:sync`, và bỏ `content:check` khỏi `check`:

```json
    "check": "npm run design:lint && npm test && npm run lint && npm run build",
    "seed:content": "node scripts/seed-content.mjs",
```

- [ ] **Step 5: Sửa `CLAUDE.md`**

Thay nguyên mục **"Nội dung ở JSON, database chỉ giữ trạng thái người dùng"** bằng:

```markdown
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
```

Trong mục **Bẫy đã gặp** (hoặc tạo mục đó nếu chưa có), thêm ba điều đã xác minh ngày 2026-08-24:

```markdown
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
```

Trong mục **Lệnh**, bỏ hai dòng `content:check` / `content:sync`, thêm:

```bash
npm run seed:content   # sinh SQL bootstrap db/seed/*.json -> bảng nội dung
```

Trong bảng **Test — cố tình rất ít**, đổi hàng `Chuỗi mở khóa trong JSON đứt gãy | content:check` thành:

```markdown
| Chuỗi mở khóa đứt gãy | Không xảy ra được — không có cột nào lưu nó |
| Người dùng thường sửa được nội dung | `npm run db:check` (phép 10) |
```

Trong bảng **Agent harness**, đổi dòng `scripts/db-check.mjs` thành `Self-check 11 ranh giới bảo mật tầng DB (npm run db:check)`.

- [ ] **Step 6: Chạy cổng đầy đủ**

```bash
npm run check && npm run db:check
```

Kỳ vọng: `check` xanh, `db:check` 11/11.

- [ ] **Step 7: Commit**

Vẫn **không** `git add -A`, và vẫn phải dùng pathspec ở `git commit` để cái rename `PageSpread.tsx` → `BookPage.tsx` đang stage sẵn trong index không bị cuốn theo.

**`git add` chỉ nhận path còn tồn tại trên đĩa.** `content/shelves` và `scripts/content-sync.mjs` đã bị `git mv` / `git rm` ở Step 1 và Step 3 nên không còn ở đó nữa; đưa chúng vào `git add` sẽ làm cả lệnh hỏng với `did not match any files`. Nhưng chúng **phải** có trong pathspec của `git commit`, nếu không commit bỏ sót phần xóa.

Hai lệnh, hai danh sách khác nhau — đây là chỗ đã làm hỏng một lần rồi:

```bash
# add: chỉ những path còn trên đĩa
git add -- scripts/seed-content.mjs package.json CLAUDE.md db/seed

# commit: pathspec kể CẢ những path đã bị xóa/di chuyển
git commit -m "chore: bo mo hinh noi dung JSON, cap nhat CLAUDE.md" \
  -- scripts/seed-content.mjs package.json CLAUDE.md db/seed content/shelves scripts/content-sync.mjs

git show --stat HEAD
```

`git show --stat` phải liệt kê: `scripts/seed-content.mjs`, `package.json`, `CLAUDE.md`, các file dưới `db/seed/`, phần xóa `content/shelves/`, phần xóa `scripts/content-sync.mjs` — và **không có** `PageSpread.tsx`/`BookPage.tsx`.

---

## Xong chặng A + B khi

- [ ] `npm run check` xanh.
- [ ] `npm run db:check` 11/11, phép 10 đạt vì message báo RLS chặn (không phải "permission denied for table").
- [ ] `/` và `/lich-su-viet-nam` trông y hệt trước khi bắt đầu.
- [ ] Đổi một tiêu đề sách bằng `UPDATE public.books SET title = …` rồi tải lại trang → đổi ngay, không build lại.
- [ ] `grep -r "book_unlocks\|content-sync\|lib/content/shelves" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" .` không ra kết quả nào ngoài `db/schema/` và tài liệu.

Sau đó viết plan cho chặng C (`/quan-tri`) và chặng D (bản đồ + ảnh thật), cùng spec.
