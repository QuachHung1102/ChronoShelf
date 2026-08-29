-- Tài khoản + đăng nhập bằng mã OTP.
--
-- Mã OTP KHÔNG bao giờ được lưu dạng thô. Node sinh mã bằng `crypto.randomInt` rồi
-- băm SHA-256; database chỉ thấy bản băm. Chọn băm ở Node chứ không ở Postgres để
-- khỏi phải bật extension `pgcrypto`, và để nguồn ngẫu nhiên là nguồn mã hóa thật
-- chứ không phải `random()` của SQL (không an toàn mật mã).
--
-- Sáu chữ số chỉ có 10^6 khả năng nên bản băm KHÔNG tự nó đủ mạnh: hàng rào thật là
-- hạn 10 phút cộng giới hạn số lần thử ngay trong `consume_login_code`.

CREATE TABLE IF NOT EXISTS public.users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Ép chữ thường ngay ở ràng buộc: nếu không, "An@x.vn" và "an@x.vn" thành hai tài
  -- khoản khác nhau và người dùng mất sạch tiến độ chỉ vì gõ hoa một chữ.
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

CREATE TABLE IF NOT EXISTS public.login_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  code_hash  text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_codes_email_lowercase CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS login_codes_email_idx ON public.login_codes (email, created_at DESC);

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own user select" ON public.users;
CREATE POLICY "own user select" ON public.users
  FOR SELECT USING (app.current_user_id() = id);

-- Không policy nào trên `login_codes`: RLS đang bật và không có policy nghĩa là
-- KHÔNG AI đọc/ghi được qua đường thường. Cửa duy nhất là hai hàm SECURITY DEFINER
-- bên dưới. Đây là chủ ý, không phải thiếu sót.

REVOKE ALL ON public.users       FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
REVOKE ALL ON public.login_codes FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.users TO chronoshelf_auth;

-- ---------------------------------------------------------------------------
-- Phát mã. Trả về id của bản ghi để phía gọi ghi log, không trả lại gì bí mật.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.issue_login_code(
  p_email      text,
  p_code_hash  text,
  p_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_id    uuid;
  v_recent integer;
BEGIN
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  -- Chống dội mã: tối đa 5 mã trong 15 phút cho một email. Không có vế này thì ai
  -- cũng biến hộp thư người khác thành thùng rác, và ta trả tiền gửi mail cho việc đó.
  SELECT count(*) INTO v_recent
    FROM public.login_codes
   WHERE email = v_email AND created_at > now() - interval '15 minutes';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Too many codes requested';
  END IF;

  -- Mã cũ chưa dùng hết hiệu lực ngay khi phát mã mới.
  UPDATE public.login_codes
     SET consumed_at = now()
   WHERE email = v_email AND consumed_at IS NULL;

  INSERT INTO public.login_codes (email, code_hash, expires_at)
       VALUES (v_email, p_code_hash, p_expires_at)
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- Đổi mã lấy tài khoản. Email chưa có tài khoản thì tài khoản được tạo tại đây —
-- Trả lời y hệt nhau dù email đã tồn tại hay chưa, để không ai dò được danh sách
-- người dùng.
--
-- HỢP ĐỒNG TRẢ VỀ: uuid khi mã đúng, NULL cho MỌI nhánh hỏng. Không ném exception —
-- xem chú thích dài trong thân hàm để biết vì sao đó là điều kiện sống còn của
-- giới hạn 5 lần thử.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.consume_login_code(
  p_email     text,
  p_code_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app
AS $fn$
DECLARE
  v_email text := lower(trim(p_email));
  v_row   RECORD;
  v_user  uuid;
BEGIN
  SELECT * INTO v_row
    FROM public.login_codes
   WHERE email = v_email AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Đếm lần thử TRƯỚC khi so sánh: thoát sớm ở nhánh nào cũng phải đã tính tiền.
  --
  -- MỌI nhánh hỏng bên dưới PHẢI là `RETURN NULL`, TUYỆT ĐỐI KHÔNG được
  -- `RAISE EXCEPTION`. Lý do: một RAISE không ai bắt sẽ hủy CẢ transaction của
  -- request, kéo theo chính câu UPDATE attempts ngay dưới đây — bộ đếm vĩnh viễn
  -- bằng 0, nhánh `v_row.attempts + 1 > 5` không bao giờ đúng, và giới hạn 5 lần
  -- thử thành vô nghĩa. Đã tái hiện 2026-08-29 trên database thật qua đúng role
  -- `chronoshelf_anon`: phát một mã, sai 8 lần, mã ĐÚNG ở lần thứ 9 vẫn được chấp
  -- nhận — tức là dò cạn không gian 10^6 là chiếm được tài khoản bất kỳ, kể cả admin.
  --
  -- Phía Node (`lib/auth/otp.ts`) đổi NULL thành lỗi cho người dùng, và nó throw
  -- Ở NGOÀI `withRole()` nên transaction đã COMMIT bộ đếm xong trước đó. Đừng
  -- "dọn dẹp" mấy dòng này ngược lại thành RAISE.
  UPDATE public.login_codes SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.attempts + 1 > 5 THEN
    UPDATE public.login_codes SET consumed_at = now() WHERE id = v_row.id;
    RETURN NULL;
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN NULL;
  END IF;

  -- Một câu trả lời duy nhất cho mọi nhánh hỏng ở trên: mã sai, mã hết hạn, thử quá
  -- số lần, email chưa từng xin mã — tất cả đều trả về NULL. Phân biệt chúng là chỉ
  -- cho kẻ dò biết nó đang tới gần chỗ nào.
  IF v_row.code_hash <> p_code_hash THEN
    RETURN NULL;
  END IF;

  UPDATE public.login_codes SET consumed_at = now() WHERE id = v_row.id;

  INSERT INTO public.users (email, email_verified)
       VALUES (v_email, true)
  ON CONFLICT (email) DO UPDATE SET email_verified = true
    RETURNING id INTO v_user;

  RETURN v_user;
END;
$fn$;

REVOKE ALL ON FUNCTION app.issue_login_code(text, text, timestamptz)  FROM PUBLIC;
REVOKE ALL ON FUNCTION app.consume_login_code(text, text)             FROM PUBLIC;
-- Chỉ người CHƯA đăng nhập mới cần hai hàm này. Người đã đăng nhập gọi được cũng
-- không có gì nguy hiểm, nhưng không cấp thì bề mặt nhỏ hơn.
GRANT EXECUTE ON FUNCTION app.issue_login_code(text, text, timestamptz) TO chronoshelf_anon;
GRANT EXECUTE ON FUNCTION app.consume_login_code(text, text)            TO chronoshelf_anon;
