-- Kệ sách & đọc sách — schema.
-- Chạy qua MCP `run-raw-sql`. File này là nguồn sự thật, backend không tự version.
-- Đã chạy và xác minh trên backend ngày 2026-08-12 (9/9 self-check pass).
--
-- KIẾN TRÚC: nội dung bài học (tiêu đề, trang, vật phẩm) nằm ở content/shelves/*.json.
-- DB chỉ giữ (a) trạng thái người dùng và (b) `book_unlocks` — bản chiếu của chuỗi
-- mở khóa, sinh ra từ JSON bằng `npm run content:sync`.
--
-- Vì sao vẫn phải có xương trong DB: quyết định trao vật phẩm bắt buộc chạy phía
-- máy chủ (content.md §8), mà backend này KHÔNG có `service_role` — chỉ có `anon`
-- và `authenticated`. Route Next.js do đó không bao giờ đủ quyền ghi `user_items`.
-- Đường duy nhất còn lại là hàm Postgres SECURITY DEFINER, và hàm đó phải đọc
-- được chuỗi mở khóa từ trong DB.

CREATE TABLE IF NOT EXISTS public.book_unlocks (
  book_slug          text PRIMARY KEY,
  shelf_slug         text    NOT NULL,
  position           integer NOT NULL,
  page_count         integer NOT NULL CHECK (page_count > 0),
  required_item_slug text,
  reward_item_slug   text,
  UNIQUE (shelf_slug, position)
);

CREATE TABLE IF NOT EXISTS public.user_book_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_slug    text NOT NULL REFERENCES public.book_unlocks(book_slug) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1 CHECK (current_page >= 1),
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (user_id, book_slug)
);

CREATE TABLE IF NOT EXISTS public.user_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_slug   text NOT NULL,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_slug)
);

ALTER TABLE public.book_unlocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read unlocks" ON public.book_unlocks;
DROP POLICY IF EXISTS "own progress select" ON public.user_book_progress;
DROP POLICY IF EXISTS "own progress insert" ON public.user_book_progress;
DROP POLICY IF EXISTS "own progress update" ON public.user_book_progress;
DROP POLICY IF EXISTS "own items select"    ON public.user_items;

CREATE POLICY "public read unlocks" ON public.book_unlocks FOR SELECT USING (true);
CREATE POLICY "own progress select" ON public.user_book_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own progress insert" ON public.user_book_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.user_book_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items select"    ON public.user_items FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.book_unlocks FROM anon, authenticated;
GRANT SELECT ON public.book_unlocks TO anon, authenticated;

-- Client chỉ ghi được current_page. `completed` chỉ do RPC đặt.
REVOKE ALL ON public.user_book_progress FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_book_progress TO authenticated;
GRANT UPDATE (current_page) ON public.user_book_progress TO authenticated;

-- Không role nào được ghi user_items. Chỉ RPC (SECURITY DEFINER) trao vật phẩm.
REVOKE ALL ON public.user_items FROM anon, authenticated;
GRANT SELECT ON public.user_items TO authenticated;

-- ---------------------------------------------------------------------------
-- Tách hai hàm vì SQL proxy của InsForge chặn set_config('request.jwt.claims',…),
-- nên auth.uid() không giả lập được và hàm một-mảnh sẽ không test được.
-- BẢO MẬT: _complete_book_for KHÔNG ĐƯỢC cấp EXECUTE cho anon/authenticated —
-- ai gọi được nó với user_id tùy ý là tự phát vật phẩm cho mình.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._complete_book_for(p_user_id uuid, p_book_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
DECLARE
  v_book              RECORD;
  v_progress          RECORD;
  v_already_completed boolean := false;
  v_next              RECORD;
  v_has_next          boolean := false;
  v_next_unlocked     boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_book FROM public.book_unlocks WHERE book_slug = p_book_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found';
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
    IF v_progress.current_page < v_book.page_count THEN
      RAISE EXCEPTION 'Book not finished yet (page % of %)', v_progress.current_page, v_book.page_count;
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
    FROM public.book_unlocks
   WHERE shelf_slug = v_book.shelf_slug AND position > v_book.position
   ORDER BY position ASC LIMIT 1;
  v_has_next := FOUND;

  IF v_has_next THEN
    v_next_unlocked := v_next.required_item_slug IS NULL
      OR EXISTS (SELECT 1 FROM public.user_items
                  WHERE user_id = p_user_id AND item_slug = v_next.required_item_slug);
  END IF;

  RETURN jsonb_build_object(
    'alreadyCompleted', v_already_completed,
    'grantedItemSlug',  v_book.reward_item_slug,
    'nextBook',
      CASE WHEN v_has_next
           THEN jsonb_build_object('slug', v_next.book_slug, 'unlocked', v_next_unlocked)
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
