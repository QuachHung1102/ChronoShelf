-- Bảng tin cộng đồng (content.md §6): bài chia sẻ/câu hỏi và bình luận văn bản thuần.
--
-- Ai cũng đọc được. Người đã đăng nhập chỉ INSERT dưới đúng danh tính của phiên; không
-- role ứng dụng nào sửa/xóa. Server Action vẫn tự xác thực và tự lấy user_id — RLS là
-- lớp phòng thủ chiều sâu nếu action đó một ngày bị viết sai.

CREATE TABLE IF NOT EXISTS public.community_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_kind_ck CHECK (kind IN ('chia-se', 'cau-hoi')),
  CONSTRAINT community_posts_body_ck
    CHECK (body ~ '[^[:space:]]' AND char_length(body) <= 1000)
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_comments_body_ck
    CHECK (body ~ '[^[:space:]]' AND char_length(body) <= 500)
);

CREATE INDEX IF NOT EXISTS community_posts_created_at_idx
  ON public.community_posts (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS community_comments_post_created_at_idx
  ON public.community_comments (post_id, created_at ASC, id ASC);

-- Gắn việc giữ lửa vào chính INSERT bài: mọi đường ghi đều có cùng invariant, và trigger
-- chạy trong transaction của câu INSERT nên bài/ngày hoạt động cùng thành công hoặc cùng rollback.
CREATE OR REPLACE FUNCTION public.record_community_post_activity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.record_activity();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_post_records_activity ON public.community_posts;
CREATE TRIGGER community_post_records_activity
  AFTER INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.record_community_post_activity();

REVOKE ALL ON FUNCTION public.record_community_post_activity()
  FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;

ALTER TABLE public.community_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read community posts"    ON public.community_posts;
DROP POLICY IF EXISTS "own community post insert" ON public.community_posts;
DROP POLICY IF EXISTS "read community comments" ON public.community_comments;
DROP POLICY IF EXISTS "own community comment insert" ON public.community_comments;

CREATE POLICY "read community posts" ON public.community_posts
  FOR SELECT USING (true);
CREATE POLICY "own community post insert" ON public.community_posts
  FOR INSERT WITH CHECK (app.current_user_id() = author_id);
CREATE POLICY "read community comments" ON public.community_comments
  FOR SELECT USING (true);
CREATE POLICY "own community comment insert" ON public.community_comments
  FOR INSERT WITH CHECK (app.current_user_id() = author_id);

REVOKE ALL ON public.community_posts, public.community_comments
  FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.community_posts, public.community_comments
  TO chronoshelf_anon, chronoshelf_auth;
GRANT INSERT (author_id, kind, body) ON public.community_posts TO chronoshelf_auth;
GRANT INSERT (post_id, author_id, body) ON public.community_comments TO chronoshelf_auth;

-- === TỰ KIỂM NHANH ===
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_posts', 'community_comments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables
                    WHERE schemaname = 'public' AND tablename = t AND rowsecurity) THEN
      RAISE EXCEPTION '% chưa bật RLS', t;
    END IF;
    IF NOT has_table_privilege('chronoshelf_anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'người chưa đăng nhập không đọc được %', t;
    END IF;
    IF has_any_column_privilege('chronoshelf_anon', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'người chưa đăng nhập ghi được %', t;
    END IF;
    IF has_table_privilege('chronoshelf_auth', 'public.' || t, 'UPDATE')
    OR has_table_privilege('chronoshelf_auth', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'chronoshelf_auth sửa/xóa được %', t;
    END IF;
  END LOOP;

  RAISE NOTICE 'G. bảng tin cộng đồng đọc-công-khai + ghi-đúng-danh-tính OK';
END $$;
