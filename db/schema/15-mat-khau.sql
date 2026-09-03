-- Đăng nhập bằng email + mật khẩu, khôi phục bằng câu hỏi bảo mật.
--
-- THAY HẲN luồng OTP qua email (`02-users.sql`). Lý do: dự án không có nhà cung cấp
-- mail và sẽ không gắn — không gửi được mail thì OTP không có đường tới người dùng.
--
-- BĂM Ở NODE, KHÔNG Ở POSTGRES. `crypto.scrypt` là stdlib; `pgcrypto` là extension phải
-- bật ở mọi nơi deploy, và bcrypt của nó cắt cụt mật khẩu ở 72 byte trong im lặng — với
-- tiếng Việt có dấu thì đó chỉ là 24 ký tự. Lý do đầy đủ + số đo tham số scrypt nằm ở
-- `lib/auth/mat-khau.ts`.
--
-- HỆ QUẢ: bản băm KHÔNG BAO GIỜ rời khỏi database. Node xin `*_params` (thuật toán +
-- salt), tự băm, rồi gửi bản băm xuống để SQL so. Hai lượt gọi ấy nằm trong CÙNG một
-- transaction của request, nên không có kẽ nào để thử mật khẩu mà không bị đếm.

-- ---------------------------------------------------------------------------
-- Cột mới trên `users`.
--
-- Viết theo lối ALTER, KHÔNG sửa thân `CREATE TABLE IF NOT EXISTS` ở `02-users.sql`:
-- trên database đã có bảng thì sửa thân CREATE là không-op — `db:migrate` báo xanh mà
-- cột không hề được thêm. Cùng lối với `10-image-credit.sql`.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_params  text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash    text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_question text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS answer_params    text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS answer_hash      text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_logins    smallint NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until     timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_recovery  smallint NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS recovery_locked_until timestamptz;

-- ---------------------------------------------------------------------------
-- XÓA tài khoản không có mật khẩu.
--
-- Người dùng đã chọn "xóa làm lại cho đơn giản": mọi tài khoản cũ đều tạo qua OTP và
-- không có mật khẩu, nên chúng không đăng nhập được nữa dù có giữ lại.
--
-- Câu này IDEMPOTENT theo đúng nghĩa quan trọng: sau lần chạy đầu, mọi tài khoản thật
-- đều có mật khẩu, nên nó khớp 0 dòng mãi mãi. Nó KHÔNG phải một quả bom hẹn giờ chờ
-- lần `db:migrate` sau.
--
-- Mọi bảng trỏ tới `users` đều ON DELETE CASCADE (tiến độ đọc, túi vật phẩm, chuỗi giữ
-- lửa, bảng tin, vai trò), nên một câu DELETE là dọn sạch — đã tra `pg_constraint`
-- trước khi viết, không đoán.
--
-- Tài khoản mồi nhử của `db:check` được `seed:content` cấp một bản băm KHÔNG AI BIẾT
-- mật khẩu, nên nó sống sót qua câu này. Chạy `db:migrate` mà chưa `seed:content` thì
-- mồi nhử biến mất và `db:check` sẽ KÊU — đúng thứ phải xảy ra.
-- ---------------------------------------------------------------------------
DELETE FROM public.users WHERE password_hash IS NULL;

-- Từ đây trở đi mọi tài khoản BẮT BUỘC có đủ mật khẩu và câu hỏi bảo mật. Người dùng
-- đã chốt: đặt câu hỏi ngay lúc đăng ký, không cho bỏ qua — nên ràng buộc này là
-- NOT NULL thật, không phải "có thì phải đủ".
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_credentials_ck;
ALTER TABLE public.users ADD  CONSTRAINT users_credentials_ck
  CHECK (password_params IS NOT NULL AND password_hash IS NOT NULL
         AND security_question IS NOT NULL
         AND answer_params IS NOT NULL AND answer_hash IS NOT NULL);

-- Allowlist câu hỏi. PHẢI khớp `CAU_HOI_BAO_MAT` trong `lib/auth/cau-hoi-bao-mat.ts`;
-- có một test đọc thẳng file này để bắt lệch giữa hai nơi.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_security_question_ck;
ALTER TABLE public.users ADD  CONSTRAINT users_security_question_ck
  CHECK (security_question IN (
    'truong-tieu-hoc',
    'ban-than-lop-mot',
    'ten-thu-cung',
    'giao-vien-lop-mot',
    'mon-an-ghet',
    'bai-hat-thuoc-dau'
  ));

-- `email_verified` mất hết ý nghĩa khi không còn mail để xác minh. Giữ cột (bỏ cột là
-- đụng vào `02-users.sql` và mọi thứ đọc nó) nhưng hạ nó xuống false cho rõ ràng.
UPDATE public.users SET email_verified = false WHERE email_verified;

-- ---------------------------------------------------------------------------
-- Dẹp luồng OTP.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app.issue_login_code(text, text, timestamptz);
DROP FUNCTION IF EXISTS app.consume_login_code(text, text);
DROP TABLE IF EXISTS public.login_codes;

-- `digest()` nằm trong pgcrypto mà ta cố ý không bật. `md5()` là hàm lõi và ở đây nó
-- KHÔNG dùng cho mục đích mật mã — chỉ để sinh một chuỗi salt mồi ổn định cho email
-- không tồn tại, thứ mà kẻ tấn công có biết cũng chẳng làm được gì.
CREATE OR REPLACE FUNCTION app.digest_placeholder(p_text text)
RETURNS bytea
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $fn$ SELECT decode(md5('chronoshelf-salt-moi:' || p_text), 'hex') $fn$;

-- ---------------------------------------------------------------------------
-- Đăng ký. NULL khi email đã có tài khoản — KHÔNG ném exception.
--
-- Không ném vì cùng lý do đã ghi dài trong `02-users.sql`: một RAISE không ai bắt sẽ
-- hủy CẢ transaction của request. Ở đây chưa có bộ đếm nào để mất, nhưng giữ cùng một
-- hợp đồng cho cả sáu hàm là cách để không ai phải nhớ hàm nào ném hàm nào không.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.dang_ky(
  p_email     text,
  p_pass_params text,
  p_pass_hash   text,
  p_question    text,
  p_ans_params  text,
  p_ans_hash    text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_id    uuid;
BEGIN
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.users
    (email, email_verified, password_params, password_hash,
     security_question, answer_params, answer_hash)
  VALUES
    (v_email, false, p_pass_params, p_pass_hash, p_question, p_ans_params, p_ans_hash)
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Bước 1 của đăng nhập: lấy tham số băm để Node băm mật khẩu người dùng vừa gõ.
--
-- Email KHÔNG TỒN TẠI vẫn trả về một chuỗi tham số (sinh từ chính email), để Node vẫn
-- tốn đúng một lượt scrypt và bước 2 vẫn trả NULL. Không có nhánh này thì thời gian
-- phản hồi tự khai báo email nào đã có tài khoản.
--
-- Đang bị khóa thì trả NULL — Node dừng luôn, không tốn scrypt cho kẻ đang dò.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.bat_dau_dang_nhap(p_email text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_row   RECORD;
BEGIN
  SELECT password_params, locked_until INTO v_row
    FROM public.users WHERE email = v_email;

  IF FOUND AND v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN NULL;
  END IF;
  IF FOUND THEN
    RETURN v_row.password_params;
  END IF;

  -- Tham số mồi cho email không tồn tại: ổn định theo email (thử lại vẫn ra đúng chuỗi
  -- đó, nên không lộ qua việc tham số đổi mỗi lần) và cùng khuôn với tham số thật.
  RETURN 'scrypt$N=32768,r=8,p=1,len=64$' ||
         translate(encode(app.digest_placeholder(v_email), 'base64'), '+/=', '-_');
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Bước 2 của đăng nhập: so bản băm, đếm lần thử, khóa khi quá 5 lần.
--
-- ĐẾM TRƯỚC KHI SO — và tuyệt đối không RAISE. Đây đúng là chỗ đã sập một lần với OTP:
-- `RAISE EXCEPTION` hủy cả transaction kéo theo chính câu UPDATE bộ đếm, làm giới hạn
-- thành vô nghĩa và mở đường dò cạn không gian mật khẩu. Mọi nhánh hỏng ở đây PHẢI là
-- `RETURN NULL`; tầng Node ném lỗi SAU khi transaction đã commit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.ket_thuc_dang_nhap(p_email text, p_pass_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_row   RECORD;
BEGIN
  SELECT id, password_hash, failed_logins, locked_until INTO v_row
    FROM public.users WHERE email = v_email FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > now() THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
     SET failed_logins = failed_logins + 1,
         locked_until = CASE WHEN failed_logins + 1 >= 5
                             THEN now() + interval '15 minutes' ELSE locked_until END
   WHERE id = v_row.id;

  IF v_row.password_hash <> p_pass_hash THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
     SET failed_logins = 0, locked_until = NULL
   WHERE id = v_row.id;

  RETURN v_row.id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Câu hỏi bảo mật của một email. LUÔN trả về một câu hỏi.
--
-- Email không tồn tại thì chọn một câu trong danh sách theo chính email đó — ổn định
-- qua các lần hỏi. Không có nhánh này thì trang "quên mật khẩu" thành máy dò: gõ email
-- vào, có câu hỏi nghĩa là tài khoản tồn tại.
--
-- KHÔNG đếm lần thử ở đây: người dùng thật cần đọc câu hỏi trước khi trả lời được.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.cau_hoi_khoi_phuc(p_email text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_q     text;
  v_ds    text[] := ARRAY['truong-tieu-hoc','ban-than-lop-mot','ten-thu-cung',
                          'giao-vien-lop-mot','mon-an-ghet','bai-hat-thuoc-dau'];
BEGIN
  SELECT security_question INTO v_q FROM public.users WHERE email = v_email;
  IF v_q IS NOT NULL THEN
    RETURN v_q;
  END IF;
  -- `bit(16)::int` luôn ra 0..65535. Dùng `bit(32)` thì kết quả CÓ DẤU, số âm làm
  -- phép `%` ra âm và chỉ số mảng thành không hợp lệ — hỏng đúng lúc gặp email xui.
  RETURN v_ds[1 + (('x' || substr(md5(v_email), 1, 4))::bit(16)::int)
                  % array_length(v_ds, 1)];
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Bước 1 của khôi phục: tham số băm của đáp án. Cùng khuôn `bat_dau_dang_nhap`.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.bat_dau_khoi_phuc(p_email text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_row   RECORD;
BEGIN
  SELECT answer_params, recovery_locked_until INTO v_row
    FROM public.users WHERE email = v_email;

  IF FOUND AND v_row.recovery_locked_until IS NOT NULL
     AND v_row.recovery_locked_until > now() THEN
    RETURN NULL;
  END IF;
  IF FOUND THEN
    RETURN v_row.answer_params;
  END IF;

  RETURN 'scrypt$N=32768,r=8,p=1,len=64$' ||
         translate(encode(app.digest_placeholder('dap-an:' || v_email), 'base64'), '+/=', '-_');
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Bước 2 của khôi phục: so đáp án, đặt mật khẩu mới.
--
-- Cùng luật đếm-trước-khi-so và cùng lệnh cấm RAISE như `ket_thuc_dang_nhap`.
-- Đổi mật khẩu thành công thì xóa CẢ HAI bộ đếm: người vừa chứng minh được danh tính
-- không có lý do gì phải chịu tiếp lệnh khóa do kẻ khác gây ra.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.ket_thuc_khoi_phuc(
  p_email        text,
  p_ans_hash     text,
  p_pass_params  text,
  p_pass_hash    text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_row   RECORD;
BEGIN
  SELECT id, answer_hash, failed_recovery, recovery_locked_until INTO v_row
    FROM public.users WHERE email = v_email FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.recovery_locked_until IS NOT NULL AND v_row.recovery_locked_until > now() THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
     SET failed_recovery = failed_recovery + 1,
         recovery_locked_until = CASE WHEN failed_recovery + 1 >= 5
                                      THEN now() + interval '15 minutes'
                                      ELSE recovery_locked_until END
   WHERE id = v_row.id;

  IF v_row.answer_hash <> p_ans_hash THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
     SET password_params = p_pass_params,
         password_hash   = p_pass_hash,
         failed_recovery = 0, recovery_locked_until = NULL,
         failed_logins   = 0, locked_until          = NULL
   WHERE id = v_row.id;

  RETURN v_row.id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Quyền.
--
-- Cả sáu hàm chỉ cấp cho `chronoshelf_anon`: chúng phục vụ người CHƯA đăng nhập. Người
-- đã đăng nhập gọi được cũng không nguy hiểm, nhưng không cấp thì bề mặt nhỏ hơn.
--
-- `chronoshelf_auth` vẫn KHÔNG có GRANT ghi nào lên `users`, nên không ai tự đổi
-- `failed_logins`, `locked_until` hay `password_hash` của mình bằng một câu UPDATE thẳng.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION app.dang_ky(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.bat_dau_dang_nhap(text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ket_thuc_dang_nhap(text, text)              FROM PUBLIC;
REVOKE ALL ON FUNCTION app.cau_hoi_khoi_phuc(text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION app.bat_dau_khoi_phuc(text)                     FROM PUBLIC;
REVOKE ALL ON FUNCTION app.ket_thuc_khoi_phuc(text, text, text, text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION app.digest_placeholder(text)                    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.dang_ky(text, text, text, text, text, text) TO chronoshelf_anon;
GRANT EXECUTE ON FUNCTION app.bat_dau_dang_nhap(text)                     TO chronoshelf_anon;
GRANT EXECUTE ON FUNCTION app.ket_thuc_dang_nhap(text, text)              TO chronoshelf_anon;
GRANT EXECUTE ON FUNCTION app.cau_hoi_khoi_phuc(text)                     TO chronoshelf_anon;
GRANT EXECUTE ON FUNCTION app.bat_dau_khoi_phuc(text)                     TO chronoshelf_anon;
GRANT EXECUTE ON FUNCTION app.ket_thuc_khoi_phuc(text, text, text, text)  TO chronoshelf_anon;

-- === TỰ KIỂM ===
DO $$
DECLARE v_name text;
BEGIN
  BEGIN
    INSERT INTO public.users (email, password_params, password_hash,
                              security_question, answer_params, answer_hash)
         VALUES ('kiem-thu-tam@example.invalid', 'p', 'h', 'khong-co-trong-danh-sach', 'p', 'h');
    RAISE EXCEPTION 'users_security_question_ck KHÔNG chặn — câu hỏi ngoài allowlist vào được';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_name = CONSTRAINT_NAME;
    IF v_name <> 'users_security_question_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc bắt được: %', v_name;
    END IF;
  END;

  BEGIN
    INSERT INTO public.users (email) VALUES ('kiem-thu-tam2@example.invalid');
    RAISE EXCEPTION 'users_credentials_ck KHÔNG chặn — tài khoản không mật khẩu vào được';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_name = CONSTRAINT_NAME;
    IF v_name <> 'users_credentials_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc bắt được: %', v_name;
    END IF;
  END;

  RAISE NOTICE 'I. mật khẩu + câu hỏi bảo mật OK';
END $$;
