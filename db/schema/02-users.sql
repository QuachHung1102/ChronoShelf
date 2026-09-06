-- Bảng `users` — tài khoản.
--
-- Ở đây CHỈ có phần lõi. Cột mật khẩu, câu hỏi bảo mật, bộ đếm lần thử sai và sáu hàm
-- đăng nhập/khôi phục đều nằm ở `15-mat-khau.sql`. Tách như vậy vì bảng này ra đời
-- trước cơ chế xác thực và sẽ sống lâu hơn bất kỳ cơ chế xác thực nào.
--
-- File này TỪNG dài 168 dòng: 146 dòng trong đó dựng bảng `login_codes` cùng hai hàm
-- `app.issue_login_code` / `app.consume_login_code` của luồng đăng nhập OTP, mà
-- `15-mat-khau.sql` DROP ngay trong cùng một lượt `db:migrate`. Đã cắt ngày 2026-09-07
-- vì ba lý do đo được:
--   1. Chú thích đầu file mô tả một cơ chế đăng nhập KHÔNG CÒN TỒN TẠI — và đây là
--      file thứ hai mà người mở `db/schema/` lần đầu đọc trúng.
--   2. Trong khoảng giữa lượt chạy file 02 và file 15, `app.consume_login_code` sống
--      thật với `GRANT EXECUTE TO chronoshelf_anon` — mang đúng lỗi bộ-đếm-vĩnh-viễn-
--      bằng-0 mà `CLAUDE.md` ghi là chiếm được tài khoản bất kỳ bằng 10^6 lần thử.
--   3. `90-verify.sql` (khối A) NỔ nếu bảng hoặc hai hàm đó còn sống, tức migrate CHỈ
--      xanh khi cả 146 dòng ấy đã bị hủy. Chúng chưa bao giờ tồn tại quá một lượt chạy.
-- Các câu `DROP … IF EXISTS` ở `15-mat-khau.sql` VẪN PHẢI Ở LẠI: chúng dọn cho những
-- database đã migrate từ trước 2026-09-07. Trên database trắng chúng là no-op.

CREATE TABLE IF NOT EXISTS public.users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Ép chữ thường ngay ở ràng buộc: nếu không, "An@x.vn" và "an@x.vn" thành hai tài
  -- khoản khác nhau và người dùng mất sạch tiến độ chỉ vì gõ hoa một chữ.
  CONSTRAINT users_email_lowercase CHECK (email = lower(email))
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own user select" ON public.users;
CREATE POLICY "own user select" ON public.users
  FOR SELECT USING (app.current_user_id() = id);

-- KHÔNG cấp quyền GHI cho role nào. Mọi thay đổi lên bảng này đi qua sáu hàm
-- SECURITY DEFINER ở `15-mat-khau.sql`, và `90-verify.sql` khối A canh đúng chuyện đó:
-- có GRANT UPDATE ở đây là người dùng tự gỡ được lệnh khóa của chính mình.
REVOKE ALL ON public.users FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.users TO chronoshelf_auth;
