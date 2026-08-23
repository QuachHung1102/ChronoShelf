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

-- === TỰ KIỂM TASK 1 ===
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
