-- Kệ sách & đọc sách — schema, RLS, và RPC mở khóa.
-- Chạy qua MCP `run-raw-sql`. File này là nguồn sự thật, backend không tự version.
-- Đã chạy và xác minh trên backend ngày 2026-08-12.

CREATE TABLE IF NOT EXISTS public.shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  description text
);

CREATE TABLE IF NOT EXISTS public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id uuid NOT NULL REFERENCES public.shelves(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_image_url text,
  position integer NOT NULL DEFAULT 0,
  required_item_id uuid REFERENCES public.items(id),
  reward_item_id uuid REFERENCES public.items(id),
  UNIQUE (shelf_id, position)
);

CREATE TABLE IF NOT EXISTS public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  content text,
  image_url text,
  UNIQUE (book_id, page_number)
);

CREATE TABLE IF NOT EXISTS public.user_book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS public.user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

ALTER TABLE public.shelves            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read shelves" ON public.shelves;
DROP POLICY IF EXISTS "public read items"   ON public.items;
DROP POLICY IF EXISTS "public read books"   ON public.books;
DROP POLICY IF EXISTS "public read pages"   ON public.pages;
CREATE POLICY "public read shelves" ON public.shelves FOR SELECT USING (true);
CREATE POLICY "public read items"   ON public.items   FOR SELECT USING (true);
CREATE POLICY "public read books"   ON public.books   FOR SELECT USING (true);
CREATE POLICY "public read pages"   ON public.pages   FOR SELECT USING (true);

DROP POLICY IF EXISTS "own progress select" ON public.user_book_progress;
DROP POLICY IF EXISTS "own progress insert" ON public.user_book_progress;
DROP POLICY IF EXISTS "own progress update" ON public.user_book_progress;
CREATE POLICY "own progress select" ON public.user_book_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own progress insert" ON public.user_book_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.user_book_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own items select" ON public.user_items;
CREATE POLICY "own items select" ON public.user_items
  FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.shelves, public.items, public.books, public.pages FROM anon, authenticated;
GRANT SELECT ON public.shelves, public.items, public.books, public.pages TO anon, authenticated;

-- Client chỉ được ghi current_page. `completed`/`completed_at` chỉ do RPC đặt.
REVOKE ALL ON public.user_book_progress FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_book_progress TO authenticated;
GRANT UPDATE (current_page) ON public.user_book_progress TO authenticated;

-- Không cấp INSERT/UPDATE trên user_items cho role nào cả:
-- chỉ _complete_book_for() (SECURITY DEFINER, owner = postgres) mới trao được vật phẩm.
REVOKE ALL ON public.user_items FROM anon, authenticated;
GRANT SELECT ON public.user_items TO authenticated;

-- ---------------------------------------------------------------------------
-- Logic mở khóa.
--
-- Tách làm hai vì SQL proxy của InsForge chặn `set_config('request.jwt.claims',…)`,
-- nên không thể giả lập auth.uid() để test. Lõi nhận user_id qua tham số để test
-- được; vỏ mỏng lấy auth.uid() và là thứ duy nhất client gọi.
--
-- BẢO MẬT: _complete_book_for KHÔNG ĐƯỢC cấp EXECUTE cho anon/authenticated.
-- Nếu cấp, client truyền user_id tùy ý là tự phát vật phẩm cho mình.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._complete_book_for(p_user_id uuid, p_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_book              RECORD;
  v_progress          RECORD;
  v_total_pages       integer;
  v_already_completed boolean := false;
  v_granted_item      jsonb   := null;
  v_next_book         RECORD;
  v_has_next          boolean := false;
  v_next_unlocked     boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_book FROM public.books WHERE id = p_book_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  SELECT count(*) INTO v_total_pages FROM public.pages WHERE book_id = p_book_id;
  IF v_total_pages = 0 THEN
    RAISE EXCEPTION 'Book has no pages';
  END IF;

  -- Khóa dòng tiến độ: hai request đồng thời không cùng trao vật phẩm.
  SELECT * INTO v_progress
    FROM public.user_book_progress
   WHERE user_id = p_user_id AND book_id = p_book_id
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_book_progress (user_id, book_id, current_page)
         VALUES (p_user_id, p_book_id, 1)
      RETURNING * INTO v_progress;
  END IF;

  IF v_progress.completed THEN
    v_already_completed := true;
  ELSE
    IF v_progress.current_page < v_total_pages THEN
      RAISE EXCEPTION 'Book not finished yet (page % of %)', v_progress.current_page, v_total_pages;
    END IF;

    UPDATE public.user_book_progress
       SET completed = true, completed_at = now()
     WHERE user_id = p_user_id AND book_id = p_book_id;

    IF v_book.reward_item_id IS NOT NULL THEN
      INSERT INTO public.user_items (user_id, item_id)
           VALUES (p_user_id, v_book.reward_item_id)
      ON CONFLICT (user_id, item_id) DO NOTHING;
    END IF;
  END IF;

  IF v_book.reward_item_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', i.id, 'name', i.name,
                              'image_url', i.image_url, 'description', i.description)
      INTO v_granted_item
      FROM public.items i
     WHERE i.id = v_book.reward_item_id;
  END IF;

  SELECT * INTO v_next_book
    FROM public.books
   WHERE shelf_id = v_book.shelf_id AND position > v_book.position
   ORDER BY position ASC
   LIMIT 1;
  v_has_next := FOUND;

  IF v_has_next THEN
    v_next_unlocked := v_next_book.required_item_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_items
                  WHERE user_id = p_user_id AND item_id = v_next_book.required_item_id);
  END IF;

  RETURN jsonb_build_object(
    'alreadyCompleted', v_already_completed,
    'grantedItem',      v_granted_item,
    'nextBook',
      CASE WHEN v_has_next
           THEN jsonb_build_object('id', v_next_book.id,
                                   'title', v_next_book.title,
                                   'unlocked', v_next_unlocked)
           ELSE null END
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.complete_book(p_book_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $w$ SELECT public._complete_book_for(auth.uid(), p_book_id) $w$;

REVOKE ALL ON FUNCTION public._complete_book_for(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_book(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_book(uuid) TO authenticated;
