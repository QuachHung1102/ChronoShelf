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
