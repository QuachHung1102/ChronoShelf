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

  IF NOT has_function_privilege('anon', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon không gọi được is_admin() — policy SELECT của bảng nội dung sẽ vỡ';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated không gọi được is_admin()';
  END IF;

  RAISE NOTICE 'Task 1 OK';
END $$;
