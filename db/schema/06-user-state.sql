-- Trạng thái người dùng: đọc tới đâu, đang có vật phẩm gì.
--
-- Client chỉ ghi được `current_page`. Cột `completed` và toàn bộ bảng `user_items` do
-- hàm SECURITY DEFINER quyết định — đó là ranh giới chống gian lận của cả dự án.

CREATE TABLE IF NOT EXISTS public.user_book_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  book_slug    text NOT NULL REFERENCES public.books(slug) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1 CHECK (current_page >= 1),
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE (user_id, book_slug)
);

CREATE TABLE IF NOT EXISTS public.user_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_slug   text NOT NULL REFERENCES public.items(slug) ON DELETE RESTRICT,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_slug)
);

ALTER TABLE public.user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own progress select" ON public.user_book_progress;
DROP POLICY IF EXISTS "own progress insert" ON public.user_book_progress;
DROP POLICY IF EXISTS "own progress update" ON public.user_book_progress;
DROP POLICY IF EXISTS "own items select"    ON public.user_items;

CREATE POLICY "own progress select" ON public.user_book_progress
  FOR SELECT USING (app.current_user_id() = user_id);
CREATE POLICY "own progress insert" ON public.user_book_progress
  FOR INSERT WITH CHECK (app.current_user_id() = user_id);
CREATE POLICY "own progress update" ON public.user_book_progress
  FOR UPDATE USING (app.current_user_id() = user_id) WITH CHECK (app.current_user_id() = user_id);
CREATE POLICY "own items select"    ON public.user_items
  FOR SELECT USING (app.current_user_id() = user_id);

-- Người chưa đăng nhập không chạm được gì ở đây: kệ sách vẫn xem được (bảng nội dung),
-- chỉ tiến độ và vật phẩm là không.
REVOKE ALL ON public.user_book_progress FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT, INSERT           ON public.user_book_progress TO chronoshelf_auth;
GRANT UPDATE (current_page)    ON public.user_book_progress TO chronoshelf_auth;

-- KHÔNG role nào ghi được user_items. Chỉ hàm SECURITY DEFINER trao vật phẩm.
REVOKE ALL ON public.user_items FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.user_items TO chronoshelf_auth;
