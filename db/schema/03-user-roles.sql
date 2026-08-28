-- Vai trò. KHÔNG có dòng nghĩa là 'user' — chỉ admin mới có dòng.
-- `chronoshelf_auth` chỉ SELECT dòng của chính mình; không có INSERT/UPDATE/DELETE
-- nên bề mặt tự phong admin bằng 0. Cấp admin bằng SQL chạy tay dưới quyền superuser.

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','admin')),
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own role select" ON public.user_roles;
CREATE POLICY "own role select" ON public.user_roles
  FOR SELECT USING (app.current_user_id() = user_id);

REVOKE ALL ON public.user_roles FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.user_roles TO chronoshelf_auth;

-- SECURITY DEFINER là bắt buộc, không phải tiện tay: policy "own role select" chặn
-- người dùng thường đọc dòng của người khác, nhưng hàm này cần đọc dòng của chính
-- người gọi từ bên trong policy của MỘT BẢNG KHÁC.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, app AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = app.current_user_id() AND role = 'admin'
  )
$fn$;

-- Phải cấp cho CẢ chronoshelf_anon: hàm này nằm trong policy SELECT của bảng nội
-- dung, và quyền EXECUTE bị kiểm TRƯỚC khi toán tử OR kịp ngắn mạch (đã kiểm bằng
-- thực nghiệm 2026-08-24: bảng thử với mọi dòng `flag = true` vẫn trả 42501 cho role
-- không có EXECUTE). Không rò rỉ gì: với người chưa đăng nhập thì
-- app.current_user_id() là NULL nên hàm luôn trả false, và hàm chỉ nói về chính
-- người gọi.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO chronoshelf_anon, chronoshelf_auth;
