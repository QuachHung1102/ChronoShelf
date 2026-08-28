-- Khẳng định CẤU TRÚC. Chạy được trên database rỗng — không cần dữ liệu seed.
-- Mỗi khẳng định ở đây tương ứng một cách hàng rào có thể bị nới ra mà không ai thấy.
--
-- Nguyên tắc rút ra từ hai lần bị lừa (xem CLAUDE.md, mục "Bẫy đã gặp"):
-- KHÔNG liệt kê những trạng thái bị coi là hỏng — danh sách đó không bao giờ đủ. Liệt
-- kê CHÍNH XÁC trạng thái được coi là "hàng rào còn nguyên", rồi coi mọi thứ khác là
-- rò rỉ. Cụ thể: so khớp biểu thức policy bằng `=` chứ không `LIKE`, vì
-- `USING (is_admin() OR true)` vẫn CHỨA chuỗi con `is_admin()` mà mở toang cửa.

-- === A. Role, tài khoản, vai trò ===
DO $$
DECLARE t text;
BEGIN
  IF (SELECT rolinherit FROM pg_roles WHERE rolname = 'chronoshelf_app') THEN
    RAISE EXCEPTION 'chronoshelf_app đang INHERIT — nó tự có quyền của cả hai role con, hàng rào GRANT biến mất';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname LIKE 'chronoshelf%' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'một role chronoshelf_* là superuser hoặc BYPASSRLS — mọi policy ngừng tác dụng trong im lặng';
  END IF;

  -- Role kết nối phải trống rỗng: mọi quyền chỉ đến sau khi SET LOCAL ROLE.
  FOREACH t IN ARRAY ARRAY['users','login_codes','user_roles','shelves','items','books','pages',
                           'user_book_progress','user_items'] LOOP
    IF has_table_privilege('chronoshelf_app', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'chronoshelf_app đọc thẳng được % mà không cần SET ROLE', t;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users' AND rowsecurity)
  OR NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='login_codes' AND rowsecurity)
  OR NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_roles' AND rowsecurity) THEN
    RAISE EXCEPTION 'users / login_codes / user_roles chưa bật RLS';
  END IF;

  -- login_codes: RLS bật và KHÔNG có policy nào = không ai vào được bằng đường thường.
  -- Thêm một policy vào đây là mở một cửa mà thiết kế không có.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='login_codes') THEN
    RAISE EXCEPTION 'login_codes có policy — nó phải chỉ vào được qua hàm SECURITY DEFINER';
  END IF;

  FOREACH t IN ARRAY ARRAY['users','login_codes','user_roles'] LOOP
    IF has_table_privilege('chronoshelf_anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'người chưa đăng nhập đọc được %', t;
    END IF;
  END LOOP;

  IF has_table_privilege('chronoshelf_auth', 'public.user_roles', 'INSERT')
  OR has_table_privilege('chronoshelf_auth', 'public.user_roles', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.user_roles', 'DELETE') THEN
    RAISE EXCEPTION 'người đã đăng nhập ghi được user_roles — tự phong admin được';
  END IF;
  IF NOT has_table_privilege('chronoshelf_auth', 'public.user_roles', 'SELECT') THEN
    RAISE EXCEPTION 'người đã đăng nhập không đọc được vai trò của chính mình';
  END IF;

  -- has_table_privilege chỉ trả lời "role này được phép SELECT không", KHÔNG trả lời
  -- "RLS cho nó thấy DÒNG NÀO". Policy bị sửa thành USING (true) thì mọi khẳng định
  -- phía trên vẫn xanh trong khi vai trò của mọi người lộ cho mọi người đã đăng nhập.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='user_roles'
                    AND policyname='own role select'
                    AND qual = '(app.current_user_id() = user_id)') THEN
    RAISE EXCEPTION 'policy "own role select" không còn đúng là (app.current_user_id() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='users'
                    AND policyname='own user select'
                    AND qual = '(app.current_user_id() = id)') THEN
    RAISE EXCEPTION 'policy "own user select" không còn đúng là (app.current_user_id() = id)';
  END IF;

  IF NOT has_function_privilege('chronoshelf_anon', 'public.is_admin()', 'EXECUTE')
  OR NOT has_function_privilege('chronoshelf_auth', 'public.is_admin()', 'EXECUTE') THEN
    RAISE EXCEPTION 'is_admin() thiếu EXECUTE — policy SELECT của bảng nội dung sẽ vỡ cho role đó';
  END IF;

  IF has_function_privilege('chronoshelf_auth', 'app.issue_login_code(text, text, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'người đã đăng nhập gọi được issue_login_code — bề mặt thừa';
  END IF;

  RAISE NOTICE 'A. role + tài khoản OK';
END $$;

-- === B. Bốn bảng nội dung ===
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shelves','items','books','pages'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t AND rowsecurity) THEN
      RAISE EXCEPTION 'bảng % chưa bật RLS', t;
    END IF;
    IF NOT has_table_privilege('chronoshelf_anon', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'người chưa đăng nhập không đọc được % — kệ sẽ trắng', t;
    END IF;
    IF has_table_privilege('chronoshelf_anon', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'người chưa đăng nhập ghi được %', t;
    END IF;
    -- PHẢI có GRANT ghi cho người đã đăng nhập; hàng rào thật là policy "admin write".
    -- Thiếu GRANT thì admin thật cũng ghi hỏng, và phép "người thường không ghi được"
    -- sẽ đạt vì lý do sai — không chứng minh được gì.
    IF NOT has_table_privilege('chronoshelf_auth', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'thiếu GRANT INSERT trên % — admin thật cũng ghi hỏng', t;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename=t AND policyname='admin write'
                      AND qual='is_admin()' AND with_check='is_admin()' AND cmd='ALL') THEN
      RAISE EXCEPTION 'policy "admin write" trên % thiếu, hoặc không còn là is_admin() ở CẢ USING lẫn WITH CHECK', t;
    END IF;
  END LOOP;

  -- Phải kiểm CẢ HAI cột. `condeferrable` chỉ nói "hoãn được", `condeferred` mới nói
  -- "mặc định hoãn". Hạ xuống DEFERRABLE INITIALLY IMMEDIATE thì condeferrable vẫn
  -- true — khẳng định vẫn xanh — trong khi đổi chỗ hai quyển lại vỡ đúng như cũ.
  FOREACH t IN ARRAY ARRAY['shelves_position_key','books_shelf_position_key','pages_book_position_key'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=t AND condeferrable AND condeferred) THEN
      RAISE EXCEPTION '% không phải DEFERRABLE INITIALLY DEFERRED', t;
    END IF;
  END LOOP;

  -- Quyển published trên kệ CHƯA published không được lọt ra.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='books' AND policyname='read published'
                    AND qual LIKE '%shelves%' AND qual LIKE '%published%') THEN
    RAISE EXCEPTION 'policy "read published" trên books không còn đòi kệ cha published';
  END IF;

  RAISE NOTICE 'B. bảng nội dung OK';
END $$;

-- === C. complete_book và reorder ===
DO $$
BEGIN
  IF has_function_privilege('chronoshelf_anon', 'public._complete_book_for(uuid, text)', 'EXECUTE')
  OR has_function_privilege('chronoshelf_auth', 'public._complete_book_for(uuid, text)', 'EXECUTE')
  OR has_function_privilege('chronoshelf_app',  'public._complete_book_for(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '_complete_book_for lộ EXECUTE — tự trao vật phẩm cho user bất kỳ được';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.complete_book(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được complete_book';
  END IF;
  IF NOT has_function_privilege('chronoshelf_auth', 'public.complete_book(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'người đã đăng nhập không gọi được complete_book';
  END IF;

  -- reorder_* phải là SECURITY INVOKER: chạy bằng quyền người gọi thì policy
  -- "admin write" mới áp lên UPDATE bên trong.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='reorder_books' AND NOT p.prosecdef) THEN
    RAISE EXCEPTION 'reorder_books thiếu, hoặc là SECURITY DEFINER — RLS "admin write" bị bỏ qua';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='reorder_pages' AND NOT p.prosecdef) THEN
    RAISE EXCEPTION 'reorder_pages thiếu, hoặc là SECURITY DEFINER — RLS "admin write" bị bỏ qua';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.reorder_books(text, text[])', 'EXECUTE')
  OR has_function_privilege('chronoshelf_anon', 'public.reorder_pages(text, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được RPC đổi thứ tự';
  END IF;
  IF NOT has_function_privilege('chronoshelf_auth', 'public.reorder_books(text, text[])', 'EXECUTE')
  OR NOT has_function_privilege('chronoshelf_auth', 'public.reorder_pages(text, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'người đã đăng nhập không gọi được RPC đổi thứ tự — admin thật cũng không đổi được';
  END IF;

  RAISE NOTICE 'C. complete_book + reorder OK';
END $$;
