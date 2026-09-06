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
  FOREACH t IN ARRAY ARRAY['users','user_roles','shelves','items','books','pages',
                           'user_book_progress','user_items','user_activity',
                           'community_posts','community_comments','documents','lessons'] LOOP
    IF has_table_privilege('chronoshelf_app', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION 'chronoshelf_app đọc thẳng được % mà không cần SET ROLE', t;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users' AND rowsecurity)
  OR NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_roles' AND rowsecurity) THEN
    RAISE EXCEPTION 'users / user_roles chưa bật RLS';
  END IF;

  -- Bảng `login_codes` của luồng OTP phải BIẾN MẤT, không phải "còn đó nhưng không dùng".
  -- Một bảng chứa bí mật đăng nhập mà không ai đọc nữa là thứ sẽ bị ai đó bật lại.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='login_codes') THEN
    RAISE EXCEPTION 'login_codes vẫn còn — luồng OTP lẽ ra đã bị gỡ hẳn';
  END IF;

  FOREACH t IN ARRAY ARRAY['users','user_roles'] LOOP
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

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'app' AND p.proname IN ('issue_login_code','consume_login_code')) THEN
    RAISE EXCEPTION 'hàm OTP vẫn còn — luồng đăng nhập bằng mã email lẽ ra đã bị gỡ hẳn';
  END IF;

  -- Sáu hàm đăng nhập/khôi phục: chỉ người CHƯA đăng nhập cần chúng. Cấp cho
  -- chronoshelf_auth là bề mặt thừa; thiếu cấp cho chronoshelf_anon là không ai vào được.
  FOREACH t IN ARRAY ARRAY['app.dang_ky(text, text, text, text, text, text)',
                           'app.bat_dau_dang_nhap(text)',
                           'app.ket_thuc_dang_nhap(text, text)',
                           'app.cau_hoi_khoi_phuc(text)',
                           'app.bat_dau_khoi_phuc(text)',
                           'app.ket_thuc_khoi_phuc(text, text, text, text)'] LOOP
    IF NOT has_function_privilege('chronoshelf_anon', t, 'EXECUTE') THEN
      RAISE EXCEPTION 'người chưa đăng nhập không gọi được % — không ai đăng nhập được', t;
    END IF;
    IF has_function_privilege('chronoshelf_auth', t, 'EXECUTE') THEN
      RAISE EXCEPTION 'người đã đăng nhập gọi được % — bề mặt thừa', t;
    END IF;
  END LOOP;

  -- Cả sáu PHẢI là SECURITY DEFINER: chúng đọc/ghi `users`, mà không role nào của ứng
  -- dụng có quyền ghi bảng đó. Hạ xuống INVOKER là cả luồng đăng nhập chết.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'app'
                AND p.proname IN ('dang_ky','bat_dau_dang_nhap','ket_thuc_dang_nhap',
                                  'cau_hoi_khoi_phuc','bat_dau_khoi_phuc','ket_thuc_khoi_phuc')
                AND NOT p.prosecdef) THEN
    RAISE EXCEPTION 'một hàm đăng nhập không còn là SECURITY DEFINER';
  END IF;

  -- Không role nào được GHI thẳng vào `users`: đó là thứ giữ cho bộ đếm lần thử sai và
  -- `password_hash` chỉ đổi được qua sáu hàm trên. Có GRANT UPDATE ở đây thì người dùng
  -- tự xóa lệnh khóa của mình được.
  IF has_table_privilege('chronoshelf_auth', 'public.users', 'INSERT')
  OR has_table_privilege('chronoshelf_auth', 'public.users', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.users', 'DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_auth ghi được users — tự gỡ khóa hoặc tự đổi mật khẩu người khác được';
  END IF;

  -- Hai ràng buộc của `15-mat-khau.sql`, so khớp CHÍNH XÁC chứ không đi tìm chuỗi con.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.users'::regclass
                    AND conname = 'users_credentials_ck') THEN
    RAISE EXCEPTION 'users_credentials_ck thiếu — tài khoản không mật khẩu chèn vào được';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.users'::regclass
                    AND conname = 'users_security_question_ck'
                    AND pg_get_constraintdef(oid) =
                        'CHECK ((security_question = ANY (ARRAY[''truong-tieu-hoc''::text, ''ban-than-lop-mot''::text, ''ten-thu-cung''::text, ''giao-vien-lop-mot''::text, ''mon-an-ghet''::text, ''bai-hat-thuoc-dau''::text])))') THEN
    RAISE EXCEPTION 'allowlist câu hỏi bảo mật không còn đúng sáu mã của lib/auth/cau-hoi-bao-mat.ts';
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

-- === B2. book_questions — bảng nội dung thứ năm, hàng rào là GRANT THEO CỘT ===
--
-- Tách khỏi vòng lặp ở B một cách CÓ CHỦ Ý: bốn bảng kia có GRANT SELECT cả bảng, bảng
-- này thì không và không được có. `has_table_privilege(…, 'SELECT')` trả FALSE khi chỉ
-- có quyền theo cột, nên gộp vào vòng lặp trên là khẳng định sai câu hỏi.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables
                  WHERE schemaname='public' AND tablename='book_questions' AND rowsecurity) THEN
    RAISE EXCEPTION 'book_questions chưa tồn tại hoặc chưa bật RLS';
  END IF;

  -- Đây là khẳng định QUAN TRỌNG NHẤT của cả bài trắc nghiệm: đáp án không được rời khỏi
  -- database. Cấp SELECT cả bảng (hoặc cấp riêng cột này) là một `SELECT *` vô ý trong
  -- readShelf() đủ để in đáp án ra HTML.
  IF has_column_privilege('chronoshelf_anon', 'public.book_questions', 'correct_index', 'SELECT')
  OR has_column_privilege('chronoshelf_auth', 'public.book_questions', 'correct_index', 'SELECT') THEN
    RAISE EXCEPTION 'correct_index ĐỌC ĐƯỢC từ role ứng dụng — bài trắc nghiệm chỉ còn là trang trí';
  END IF;

  -- Đối chứng bắt buộc: một lần REVOKE quá tay cũng làm phép trên xanh, trong khi trình
  -- đọc không hiện được câu hỏi nào.
  IF NOT has_column_privilege('chronoshelf_anon', 'public.book_questions', 'prompt', 'SELECT')
  OR NOT has_column_privilege('chronoshelf_anon', 'public.book_questions', 'choices', 'SELECT')
  OR NOT has_column_privilege('chronoshelf_auth', 'public.book_questions', 'prompt', 'SELECT') THEN
    RAISE EXCEPTION 'không đọc được câu hỏi — trình đọc sẽ không hiện được bài trắc nghiệm nào';
  END IF;

  IF has_table_privilege('chronoshelf_anon', 'public.book_questions', 'INSERT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập ghi được book_questions';
  END IF;
  IF NOT has_table_privilege('chronoshelf_auth', 'public.book_questions', 'INSERT') THEN
    RAISE EXCEPTION 'thiếu GRANT INSERT trên book_questions — admin thật cũng soạn câu hỏi hỏng';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='book_questions' AND policyname='admin write'
                    AND qual='is_admin()' AND with_check='is_admin()' AND cmd='ALL') THEN
    RAISE EXCEPTION 'policy "admin write" trên book_questions thiếu, hoặc không còn là is_admin() ở CẢ USING lẫn WITH CHECK';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname='book_questions_book_position_key' AND condeferrable AND condeferred) THEN
    RAISE EXCEPTION 'book_questions_book_position_key không phải DEFERRABLE INITIALLY DEFERRED';
  END IF;

  -- Policy ĐỌC, cùng khuôn với `pages` và `lessons`. Thiếu khẳng định này thì một lần nới
  -- thành USING (true) sẽ lọt qua MỌI cổng, trong khi khách chưa đăng nhập đọc được cả bài
  -- trắc nghiệm của quyển chưa xuất bản. (Bổ sung 2026-09-07 sau một đợt review đối kháng —
  -- khối B2 bản đầu chỉ canh GRANT và policy GHI.)
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='book_questions'
                    AND policyname='read published' AND cmd='SELECT'
                    AND qual LIKE '%books%' AND qual LIKE '%published%' AND qual LIKE '%is_admin()%') THEN
    RAISE EXCEPTION 'policy "read published" trên book_questions thiếu, hoặc không còn soi quyển cha đã published';
  END IF;
  -- Đếm policy SELECT, không chỉ so khớp cái đang có: policy cũ vẫn nguyên vẹn khi ai đó
  -- THÊM một policy USING (true) bên cạnh, và Postgres OR các policy PERMISSIVE lại với
  -- nhau. Đúng cái đã bắt được ở `user_items`.
  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='book_questions' AND cmd='SELECT') <> 1 THEN
    RAISE EXCEPTION 'book_questions có nhiều hơn một policy SELECT — policy thừa được OR vào và có thể mở toang';
  END IF;

  -- Cửa duy nhất cho admin đọc đáp án. Nó SECURITY DEFINER nên tự bỏ qua RLS — mất
  -- `is_admin()` bên trong là ai đăng nhập cũng đọc được đáp án của mọi quyển.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='admin_book_questions' AND p.prosecdef) THEN
    RAISE EXCEPTION 'admin_book_questions thiếu, hoặc không còn là SECURITY DEFINER';
  END IF;
  IF pg_get_functiondef('public.admin_book_questions(text)'::regprocedure) NOT LIKE '%is_admin()%' THEN
    RAISE EXCEPTION 'admin_book_questions không còn tự kiểm is_admin() — ai đăng nhập cũng đọc được đáp án';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.admin_book_questions(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được admin_book_questions';
  END IF;

  RAISE NOTICE 'B2. book_questions: đáp án không rời database OK';
END $$;

-- === C. complete_book và reorder ===
DO $$
BEGIN
  IF has_function_privilege('chronoshelf_anon', 'public._complete_book_for(uuid, text, smallint[])', 'EXECUTE')
  OR has_function_privilege('chronoshelf_auth', 'public._complete_book_for(uuid, text, smallint[])', 'EXECUTE')
  OR has_function_privilege('chronoshelf_app',  'public._complete_book_for(uuid, text, smallint[])', 'EXECUTE') THEN
    RAISE EXCEPTION '_complete_book_for lộ EXECUTE — tự trao vật phẩm cho user bất kỳ được';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.complete_book(text, smallint[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được complete_book';
  END IF;
  IF NOT has_function_privilege('chronoshelf_auth', 'public.complete_book(text, smallint[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'người đã đăng nhập không gọi được complete_book';
  END IF;

  -- Chữ ký MỘT-THAM-SỐ không được sống lại. Nó là một cửa thứ hai trao vật phẩm mà bỏ
  -- qua bài trắc nghiệm — và vì `CREATE OR REPLACE` với chữ ký mới chỉ NẠP CHỒNG chứ
  -- không thay thế, một lần quên `DROP FUNCTION` là đủ để nó quay lại trong im lặng.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
              WHERE n.nspname='public' AND p.proname IN ('complete_book','_complete_book_for')
                AND p.pronargs < CASE p.proname WHEN 'complete_book' THEN 2 ELSE 3 END) THEN
    RAISE EXCEPTION 'còn bản nạp chồng cũ của complete_book — trao vật phẩm mà KHÔNG chấm bài';
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
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname='reorder_shelves' AND NOT p.prosecdef) THEN
    RAISE EXCEPTION 'reorder_shelves thiếu, hoặc là SECURITY DEFINER — RLS "admin write" bị bỏ qua';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.reorder_books(text, text[])', 'EXECUTE')
  OR has_function_privilege('chronoshelf_anon', 'public.reorder_pages(text, uuid[])', 'EXECUTE')
  OR has_function_privilege('chronoshelf_anon', 'public.reorder_shelves(text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được RPC đổi thứ tự';
  END IF;
  IF NOT has_function_privilege('chronoshelf_auth', 'public.reorder_books(text, text[])', 'EXECUTE')
  OR NOT has_function_privilege('chronoshelf_auth', 'public.reorder_pages(text, uuid[])', 'EXECUTE')
  OR NOT has_function_privilege('chronoshelf_auth', 'public.reorder_shelves(text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'người đã đăng nhập không gọi được RPC đổi thứ tự — admin thật cũng không đổi được';
  END IF;

  RAISE NOTICE 'C. complete_book + reorder OK';
END $$;

-- === D. Kho ảnh ===
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='media' AND rowsecurity) THEN
    RAISE EXCEPTION 'media chưa tồn tại hoặc chưa bật RLS';
  END IF;

  -- Ảnh phải đọc được khi CHƯA đăng nhập, nếu không sách sẽ mất hình với đúng đối tượng
  -- chính của sản phẩm.
  IF NOT has_table_privilege('chronoshelf_anon', 'public.media', 'SELECT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập không đọc được media — ảnh sẽ vỡ hết';
  END IF;
  IF has_table_privilege('chronoshelf_anon', 'public.media', 'INSERT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập ghi được media';
  END IF;

  -- Bảng CHỈ-GHI-THÊM. Đây là thứ khiến `Cache-Control: immutable` ở /media/[id] đúng
  -- theo cấu tạo: nội dung tại một sha256 không đổi được vì không ai sửa/xóa được dòng.
  -- Nới GRANT ở đây là biến header đó thành nói dối, nên khẳng định này phải nổ.
  IF has_table_privilege('chronoshelf_auth', 'public.media', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.media', 'DELETE') THEN
    RAISE EXCEPTION 'media không còn chỉ-ghi-thêm — Cache-Control immutable thành nói dối';
  END IF;
  IF NOT has_table_privilege('chronoshelf_auth', 'public.media', 'INSERT') THEN
    RAISE EXCEPTION 'thiếu GRANT INSERT trên media — admin thật cũng không tải ảnh lên được';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='media' AND policyname='admin write'
                    AND qual='is_admin()' AND with_check='is_admin()' AND cmd='ALL') THEN
    RAISE EXCEPTION 'policy "admin write" trên media thiếu hoặc không còn là is_admin()';
  END IF;

  -- SVG không được nằm trong allowlist mime. Nó là XML — phục vụ cùng origin thì script
  -- bên trong chạy thật, thành stored XSS.
  --
  -- Khẳng định neo vào trạng thái CÒN NGUYÊN, đúng nguyên tắc ở đầu file: so khớp CHÍNH
  -- XÁC định nghĩa ràng buộc. Bản trước đi TÌM chuỗi 'svg' trong pg_get_constraintdef và
  -- vì thế không thể kêu — một allowlist bị XÓA hẳn cũng không chứa chữ 'svg', nên
  -- `DROP CONSTRAINT media_mime_check` lọt qua trong im lặng rồi database nhận
  -- `image/svg+xml`. Đã đo trên DB thật.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.media'::regclass
                    AND conname = 'media_mime_check'
                    AND pg_get_constraintdef(oid) =
                        'CHECK ((mime = ANY (ARRAY[''image/png''::text, ''image/jpeg''::text, ''image/webp''::text, ''image/gif''::text])))') THEN
    RAISE EXCEPTION 'allowlist mime của media không còn đúng bốn kiểu ảnh raster — SVG có thể đã lọt vào, thẳng tới stored XSS';
  END IF;

  -- `byte_len` phải neo vào kích thước THẬT của blob. Thiếu ràng buộc này thì
  -- `byte_len <= 2097152` ở `09-media.sql` chỉ chặn một CON SỐ do người ghi tự khai: một
  -- INSERT gõ tay đặt `byte_len = 1` kèm 200 MB bytea vẫn lọt, rồi `/media/[id]` nạp cả
  -- 200 MB đó vào RAM kèm `Cache-Control: immutable`.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.media'::regclass
                    AND conname = 'media_byte_len_thuc_ck'
                    AND pg_get_constraintdef(oid) = 'CHECK ((byte_len = octet_length(bytes)))') THEN
    RAISE EXCEPTION 'media.byte_len không còn neo vào octet_length(bytes) — trần 2 MiB thành trần giả';
  END IF;

  -- Policy đọc ảnh phải là "ai cũng đọc được" (`qual = true`, chỉ cho SELECT). Phép
  -- `has_table_privilege` ở trên chỉ nói về GRANT; nếu policy này bị siết lại thì GRANT
  -- vẫn còn nguyên mà mọi ảnh biến mất — hai chuyện khác nhau, cần hai khẳng định.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='media' AND policyname='read media'
                    AND qual='true' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'policy "read media" thiếu, hoặc không còn là SELECT USING (true) — ảnh sẽ vỡ hết';
  END IF;

  -- Ba ràng buộc ảnh-phải-có-credit (điều kiện CC BY-SA, spec §6).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_image_credit_ck')
  OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_cover_credit_ck')
  OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pages_image_credit_ck')
  OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shelves_cover_credit_ck') THEN
    RAISE EXCEPTION 'thiếu ràng buộc ảnh-phải-có-nguồn-và-tác-giả trên items/books/pages/shelves';
  END IF;

  RAISE NOTICE 'D. kho ảnh OK';
END $$;

-- === E. Tiến độ đọc và túi vật phẩm ===
-- Hai bảng này giữ TOÀN BỘ lịch sử đọc và túi đồ của từng người. `GET /api/me/state` CỐ Ý
-- không có `where user_id = ...` (xem chú thích trong route: "policy lo lọc"), nên policy ở
-- đây là hàng rào DUY NHẤT. Trước mục này không cổng nào nhìn tới chúng — hai bảng chỉ xuất
-- hiện đúng một lần trong cả file, ở vòng lặp NOINHERIT của mục A.
DO $$
DECLARE t text; n int;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_book_progress','user_items'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t AND rowsecurity) THEN
      RAISE EXCEPTION 'bảng % chưa bật RLS', t;
    END IF;
    -- has_table_privilege KHÔNG thấy GRANT mức cột: nó trả false khi role chỉ được cấp
    -- vài cột. Muốn hỏi "có chạm được gì không" thì phải dùng has_any_column_privilege —
    -- nhưng hàm đó chỉ nhận bốn quyền cấp được theo cột (SELECT/INSERT/UPDATE/REFERENCES);
    -- hỏi nó về DELETE thì chính phép kiểm nổ với 22023, nên DELETE hỏi ở mức bảng.
    IF has_any_column_privilege('chronoshelf_anon','public.'||t,'SELECT')
    OR has_any_column_privilege('chronoshelf_anon','public.'||t,'INSERT')
    OR has_any_column_privilege('chronoshelf_anon','public.'||t,'UPDATE')
    OR has_any_column_privilege('chronoshelf_anon','public.'||t,'REFERENCES')
    OR has_table_privilege('chronoshelf_anon','public.'||t,'DELETE')
    OR has_table_privilege('chronoshelf_anon','public.'||t,'TRUNCATE') THEN
      RAISE EXCEPTION 'người chưa đăng nhập chạm được % — đây là dữ liệu riêng của từng người', t;
    END IF;
  END LOOP;

  -- user_items: hàng rào là CHÍNH GRANT, không phải policy — cửa duy nhất để có vật phẩm
  -- là complete_book (SECURITY DEFINER). Đúng khuôn đã ghi trong CLAUDE.md, và vì vậy
  -- khẳng định ở đây hỏi về GRANT chứ không hỏi về biểu thức policy.
  IF NOT has_table_privilege('chronoshelf_auth','public.user_items','SELECT') THEN
    RAISE EXCEPTION 'người đã đăng nhập không đọc được túi vật phẩm của chính mình';
  END IF;
  IF has_any_column_privilege('chronoshelf_auth','public.user_items','INSERT')
  OR has_any_column_privilege('chronoshelf_auth','public.user_items','UPDATE')
  OR has_table_privilege('chronoshelf_auth','public.user_items','DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_auth ghi được user_items — tự trao vật phẩm cho mình được';
  END IF;

  -- user_book_progress: ghi được, nhưng ĐÚNG BA CỘT, và `completed`/`completed_at` không
  -- nằm trong đó. Phải hỏi cả INSERT lẫn UPDATE: dòng tiến độ chưa tồn tại cho tới lần lưu
  -- đầu tiên, nên đường vào `completed` tự nhiên là INSERT chứ không phải UPDATE.
  IF NOT has_table_privilege('chronoshelf_auth','public.user_book_progress','SELECT') THEN
    RAISE EXCEPTION 'người đã đăng nhập không đọc được tiến độ của chính mình';
  END IF;
  IF has_table_privilege('chronoshelf_auth','public.user_book_progress','DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_auth xóa được tiến độ đọc';
  END IF;
  FOREACH t IN ARRAY ARRAY['user_id','book_slug','current_page'] LOOP
    IF NOT has_column_privilege('chronoshelf_auth','public.user_book_progress',t,'INSERT') THEN
      RAISE EXCEPTION 'thiếu GRANT INSERT (%) trên user_book_progress — lưu tiến độ lần đầu sẽ hỏng', t;
    END IF;
  END LOOP;
  IF NOT has_column_privilege('chronoshelf_auth','public.user_book_progress','current_page','UPDATE') THEN
    RAISE EXCEPTION 'mất GRANT UPDATE (current_page) — lưu trang đang đọc sẽ hỏng';
  END IF;
  FOREACH t IN ARRAY ARRAY['completed','completed_at'] LOOP
    IF has_column_privilege('chronoshelf_auth','public.user_book_progress',t,'INSERT')
    OR has_column_privilege('chronoshelf_auth','public.user_book_progress',t,'UPDATE') THEN
      RAISE EXCEPTION 'chronoshelf_auth ghi được cột % trên user_book_progress — tự đánh dấu đọc xong được', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['id','user_id','book_slug'] LOOP
    IF has_column_privilege('chronoshelf_auth','public.user_book_progress',t,'UPDATE') THEN
      RAISE EXCEPTION 'chronoshelf_auth sửa được cột % trên user_book_progress — dời tiến độ sang người khác được', t;
    END IF;
  END LOOP;

  -- Bốn policy, khớp ĐÚNG TỪNG BIỂU THỨC. Dùng IS NOT DISTINCT FROM chứ không `=`: policy
  -- FOR INSERT không có USING nên Postgres lưu qual = NULL, điều kiện nằm ở with_check —
  -- viết `qual = '...'` cho cả bốn sẽ BÁO ĐỘNG GIẢ ngay trên một schema hoàn toàn lành lặn.
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('user_book_progress','own progress select','SELECT','(app.current_user_id() = user_id)', NULL),
      ('user_book_progress','own progress insert','INSERT', NULL, '(app.current_user_id() = user_id)'),
      ('user_book_progress','own progress update','UPDATE','(app.current_user_id() = user_id)','(app.current_user_id() = user_id)'),
      ('user_items',        'own items select',   'SELECT','(app.current_user_id() = user_id)', NULL)
    ) AS want(tbl,pol,cmd,q,wc)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_policies p
       WHERE p.schemaname='public' AND p.tablename=want.tbl AND p.policyname=want.pol
         AND p.cmd        =                   want.cmd
         AND p.qual       IS NOT DISTINCT FROM want.q
         AND p.with_check IS NOT DISTINCT FROM want.wc)
  ) THEN
    RAISE EXCEPTION 'một trong bốn policy của user_book_progress/user_items không còn đúng biểu thức';
  END IF;

  -- Phép ĐẾM. Bốn khẳng định trên KHÔNG bắt được một policy THỨ NĂM `USING (true)` thêm vào
  -- bên cạnh — policy cũ vẫn nguyên vẹn nên khớp vẫn xanh, mà dữ liệu đã rò. Đã tái hiện
  -- thật trên bảng tạm: khớp qual = true, trong khi A đọc được cả dòng của B.
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname='public' AND tablename IN ('user_book_progress','user_items');
  IF n <> 4 THEN
    RAISE EXCEPTION 'có % policy trên user_book_progress/user_items, chờ đúng 4 — ai đó vừa thêm một cửa', n;
  END IF;

  RAISE NOTICE 'E. tiến độ đọc + túi vật phẩm OK';
END $$;

-- === F. Chuỗi giữ lửa ===
DO $$
DECLARE
  n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables
                  WHERE schemaname='public' AND tablename='user_activity' AND rowsecurity) THEN
    RAISE EXCEPTION 'user_activity chưa tồn tại hoặc chưa bật RLS';
  END IF;

  -- Hàng rào ở đây là chính GRANT, y như `user_items`: KHÔNG role nào ghi được, cửa duy
  -- nhất là `record_activity()` chạy SECURITY DEFINER. Nếu một ngày chỗ này đổi thành
  -- "bị policy chặn" thì nghĩa là ai đó vừa CẤP THÊM GRANT — đúng thứ phải nổ.
  IF has_table_privilege('chronoshelf_auth', 'public.user_activity', 'INSERT')
  OR has_table_privilege('chronoshelf_auth', 'public.user_activity', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.user_activity', 'DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_auth ghi được user_activity — tự bịa chuỗi giữ lửa được';
  END IF;
  IF NOT has_table_privilege('chronoshelf_auth', 'public.user_activity', 'SELECT') THEN
    RAISE EXCEPTION 'chronoshelf_auth không đọc được user_activity — ngọn lửa sẽ luôn tắt';
  END IF;
  IF has_table_privilege('chronoshelf_anon', 'public.user_activity', 'SELECT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập đọc được user_activity';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='user_activity'
                    AND policyname='own activity select'
                    AND qual='(app.current_user_id() = user_id)' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'policy "own activity select" thiếu, hoặc không còn đúng là (app.current_user_id() = user_id)';
  END IF;

  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public' AND tablename='user_activity';
  IF n <> 1 THEN
    RAISE EXCEPTION 'có % policy trên user_activity, chờ đúng 1 — ai đó vừa thêm một cửa', n;
  END IF;

  -- Hàm ghi phải là SECURITY DEFINER, nếu không nó chạy bằng quyền người gọi và INSERT
  -- sẽ hỏng đúng vì hàng rào GRANT ở trên — chuỗi im lặng không bao giờ tăng.
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
                  WHERE ns.nspname='public' AND p.proname='record_activity' AND p.prosecdef) THEN
    RAISE EXCEPTION 'record_activity thiếu, hoặc không còn là SECURITY DEFINER';
  END IF;
  -- Không nhận tham số: nhận user_id làm tham số là biến nó thành hàm ghi hộ người khác.
  IF (SELECT pronargs FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname='public' AND p.proname='record_activity') <> 0 THEN
    RAISE EXCEPTION 'record_activity nhận tham số — nó phải tự lấy danh tính từ app.current_user_id()';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.record_activity()', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được record_activity';
  END IF;

  RAISE NOTICE 'F. chuỗi giữ lửa OK';
END $$;

-- === G. Bảng tin cộng đồng ===
DO $$
DECLARE
  t text;
  c text;
  n integer;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_posts', 'community_comments'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables
                    WHERE schemaname='public' AND tablename=t AND rowsecurity) THEN
      RAISE EXCEPTION '% chưa tồn tại hoặc chưa bật RLS', t;
    END IF;
    IF NOT has_table_privilege('chronoshelf_anon', 'public.' || t, 'SELECT')
    OR NOT has_table_privilege('chronoshelf_auth', 'public.' || t, 'SELECT') THEN
      RAISE EXCEPTION '% không còn đọc công khai cho cả anon/auth', t;
    END IF;
    IF has_any_column_privilege('chronoshelf_anon', 'public.' || t, 'INSERT') THEN
      RAISE EXCEPTION 'người chưa đăng nhập ghi được %', t;
    END IF;
    IF has_any_column_privilege('chronoshelf_auth', 'public.' || t, 'UPDATE')
    OR has_table_privilege('chronoshelf_auth', 'public.' || t, 'DELETE') THEN
      RAISE EXCEPTION 'chronoshelf_auth sửa/xóa được % — bảng tin bản đầu chỉ-ghi-thêm', t;
    END IF;
    FOREACH c IN ARRAY ARRAY['id', 'created_at'] LOOP
      IF has_column_privilege('chronoshelf_auth', 'public.' || t, c, 'INSERT') THEN
        RAISE EXCEPTION 'chronoshelf_auth tự đặt được %.% — cột này phải do database sinh', t, c;
      END IF;
    END LOOP;
  END LOOP;

  FOREACH c IN ARRAY ARRAY['author_id', 'kind', 'body'] LOOP
    IF NOT has_column_privilege('chronoshelf_auth', 'public.community_posts', c, 'INSERT') THEN
      RAISE EXCEPTION 'thiếu GRANT INSERT (%) trên community_posts — đăng bài sẽ hỏng', c;
    END IF;
  END LOOP;
  FOREACH c IN ARRAY ARRAY['post_id', 'author_id', 'body'] LOOP
    IF NOT has_column_privilege('chronoshelf_auth', 'public.community_comments', c, 'INSERT') THEN
      RAISE EXCEPTION 'thiếu GRANT INSERT (%) trên community_comments — bình luận sẽ hỏng', c;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('community_posts',   'read community posts',          'SELECT', 'true', NULL),
      ('community_posts',   'own community post insert',     'INSERT', NULL, '(app.current_user_id() = author_id)'),
      ('community_comments','read community comments',       'SELECT', 'true', NULL),
      ('community_comments','own community comment insert',  'INSERT', NULL, '(app.current_user_id() = author_id)')
    ) AS want(tbl,pol,cmd,q,wc)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_policies p
       WHERE p.schemaname='public' AND p.tablename=want.tbl AND p.policyname=want.pol
         AND p.cmd        =                    want.cmd
         AND p.qual       IS NOT DISTINCT FROM want.q
         AND p.with_check IS NOT DISTINCT FROM want.wc)
  ) THEN
    RAISE EXCEPTION 'một policy bảng tin thiếu hoặc không còn đúng biểu thức';
  END IF;

  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname='public' AND tablename IN ('community_posts','community_comments');
  IF n <> 4 THEN
    RAISE EXCEPTION 'có % policy trên hai bảng cộng đồng, chờ đúng 4 — ai đó vừa thêm một cửa', n;
  END IF;

  -- Neo vào đúng bảng và đúng định nghĩa do PostgreSQL deparse. Chỉ kiểm tên sẽ để lọt
  -- `DROP CONSTRAINT ...; ADD CONSTRAINT cùng_tên CHECK (true)`.
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('community_posts',   'community_posts_kind_ck',
       'CHECK ((kind = ANY (ARRAY[''chia-se''::text, ''cau-hoi''::text])))'),
      ('community_posts',   'community_posts_body_ck',
       'CHECK (((body ~ ''[^[:space:]]''::text) AND (char_length(body) <= 1000)))'),
      ('community_comments','community_comments_body_ck',
       'CHECK (((body ~ ''[^[:space:]]''::text) AND (char_length(body) <= 500)))')
    ) AS want(tbl, con, def)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_constraint p
       WHERE p.conrelid = to_regclass('public.' || want.tbl)
         AND p.conname = want.con
         AND pg_get_constraintdef(p.oid) = want.def)
  ) THEN
    RAISE EXCEPTION 'một ràng buộc CHECK của bảng tin thiếu hoặc không còn đúng định nghĩa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('community_posts',   'community_posts_author_id_fkey',   'users'),
      ('community_comments','community_comments_post_id_fkey',  'community_posts'),
      ('community_comments','community_comments_author_id_fkey','users')
    ) AS want(tbl, con, parent)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_constraint p
       WHERE p.conrelid = to_regclass('public.' || want.tbl)
         AND p.conname = want.con
         AND p.confrelid = to_regclass('public.' || want.parent)
         AND p.confdeltype = 'c')
  ) THEN
    RAISE EXCEPTION 'một khóa ngoại bảng tin thiếu hoặc không còn ON DELETE CASCADE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tr
    JOIN pg_proc fn ON fn.oid=tr.tgfoid
    JOIN pg_namespace ns ON ns.oid=fn.pronamespace
     WHERE tr.tgrelid='public.community_posts'::regclass
       AND tr.tgname='community_post_records_activity'
       AND NOT tr.tgisinternal AND tr.tgenabled='O'
       AND ns.nspname='public' AND fn.proname='record_community_post_activity'
  ) THEN
    RAISE EXCEPTION 'trigger giữ lửa của bài cộng đồng thiếu, tắt hoặc trỏ sai hàm';
  END IF;

  RAISE NOTICE 'G. bảng tin cộng đồng OK';
END $$;

-- === H. Thư viện bài giảng ===
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='documents' AND rowsecurity) THEN
    RAISE EXCEPTION 'documents chưa tồn tại hoặc chưa bật RLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='lessons' AND rowsecurity) THEN
    RAISE EXCEPTION 'lessons chưa tồn tại hoặc chưa bật RLS';
  END IF;

  -- Bộ slide phải tải được khi CHƯA đăng nhập: content.md §7 nói "tải về miễn phí", và
  -- bắt đăng nhập mới tải được là đổi hẳn ý nghĩa đó.
  IF NOT has_table_privilege('chronoshelf_anon', 'public.documents', 'SELECT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập không tải được documents — slide thành thứ phải đăng nhập mới có';
  END IF;
  IF has_table_privilege('chronoshelf_anon', 'public.documents', 'INSERT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập ghi được documents';
  END IF;

  -- Bảng CHỈ-GHI-THÊM, cùng lý do như media: `Cache-Control: immutable` ở /tai-lieu/[id]
  -- đúng theo cấu tạo chỉ khi không ai sửa/xóa được dòng.
  IF has_table_privilege('chronoshelf_auth', 'public.documents', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.documents', 'DELETE') THEN
    RAISE EXCEPTION 'documents không còn chỉ-ghi-thêm — Cache-Control immutable thành nói dối';
  END IF;
  IF NOT has_table_privilege('chronoshelf_auth', 'public.documents', 'INSERT') THEN
    RAISE EXCEPTION 'thiếu GRANT INSERT trên documents — admin thật cũng không tải slide lên được';
  END IF;

  -- Allowlist mime: so khớp CHÍNH XÁC định nghĩa, không đi tìm chuỗi con. Bài học từ khối
  -- D: `DROP CONSTRAINT` lọt qua trong im lặng nếu khẳng định chỉ đi tìm cái phải VẮNG.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.documents'::regclass
                    AND conname = 'documents_mime_check'
                    AND pg_get_constraintdef(oid) =
                        'CHECK ((mime = ''application/vnd.openxmlformats-officedocument.presentationml.presentation''::text))') THEN
    RAISE EXCEPTION 'allowlist mime của documents không còn đúng một kiểu pptx — kho tài liệu nhận được thứ khác';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.documents'::regclass
                    AND conname = 'documents_byte_len_thuc_ck'
                    AND pg_get_constraintdef(oid) = 'CHECK ((byte_len = octet_length(bytes)))') THEN
    RAISE EXCEPTION 'documents.byte_len không còn neo vào octet_length(bytes) — trần 25 MiB thành trần giả';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='documents' AND policyname='read documents'
                    AND qual='true' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'policy "read documents" thiếu, hoặc không còn là SELECT USING (true) — mọi liên kết tải về sẽ chết';
  END IF;

  -- lessons: đọc thấy bản đã xuất bản (admin thấy cả nháp), ghi chỉ admin.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='lessons' AND policyname='read published'
                    AND qual='(published OR is_admin())' AND cmd='SELECT') THEN
    RAISE EXCEPTION 'policy "read published" trên lessons thiếu hoặc không còn là (published OR is_admin())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='lessons' AND policyname='admin write'
                    AND qual='is_admin()' AND with_check='is_admin()' AND cmd='ALL') THEN
    RAISE EXCEPTION 'policy "admin write" trên lessons thiếu hoặc không còn là is_admin() ở CẢ USING lẫn WITH CHECK';
  END IF;

  -- Ràng buộc ảnh-phải-có-credit cho hai ảnh của bài giảng (điều kiện BY của CC BY-SA).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_preview_credit_ck')
  OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lessons_mindmap_credit_ck') THEN
    RAISE EXCEPTION 'thiếu ràng buộc ảnh-phải-có-nguồn-và-tác-giả trên lessons';
  END IF;

  RAISE NOTICE 'H. thư viện bài giảng OK';
END $$;
