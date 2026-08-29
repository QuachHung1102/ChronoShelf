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
                           'user_book_progress','user_items','user_activity'] LOOP
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
