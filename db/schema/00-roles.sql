-- Ba role của ứng dụng.
-- CẦN SUPERUSER. Role là đối tượng cấp cluster, không thuộc riêng database nào.
--
-- `chronoshelf_app` là role DUY NHẤT có LOGIN — `DATABASE_URL` dùng nó. Nó NOINHERIT,
-- nghĩa là nối vào xong nó KHÔNG tự động có quyền của hai role kia; middleware phải
-- `SET LOCAL ROLE` sang đúng một cái mỗi transaction. Bỏ NOINHERIT đi là hợp nhất
-- quyền của người chưa đăng nhập với người đã đăng nhập ngay tại lúc kết nối — hàng
-- rào GRANT biến mất mà không có gì báo.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chronoshelf_anon') THEN
    CREATE ROLE chronoshelf_anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chronoshelf_auth') THEN
    CREATE ROLE chronoshelf_auth NOLOGIN;
  END IF;
  -- `chronoshelf_app` được tạo tay lúc bootstrap kèm mật khẩu (xem db/schema/README.md).
  -- File này cố tình KHÔNG đụng tới mật khẩu của nó.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'chronoshelf_app') THEN
    RAISE EXCEPTION 'Chưa có role chronoshelf_app. Tạo trước: CREATE ROLE chronoshelf_app LOGIN PASSWORD ''…'';';
  END IF;
END $$;

ALTER ROLE chronoshelf_app NOINHERIT;

GRANT chronoshelf_anon TO chronoshelf_app;
GRANT chronoshelf_auth TO chronoshelf_app;

GRANT USAGE ON SCHEMA public TO chronoshelf_anon, chronoshelf_auth;

-- Không role nào trong ba cái này được tạo bảng mới lúc chạy.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, chronoshelf_anon, chronoshelf_auth, chronoshelf_app;
