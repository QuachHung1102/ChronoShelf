-- Danh tính người gọi, thay cho `auth.uid()` của InsForge.
--
-- InsForge lấy user id từ claim của JWT ngay trong Postgres. Ở đây không có JWT nào
-- đi tới database — middleware xác thực ở tầng Node rồi đặt `app.user_id` bằng
-- `SET LOCAL` bên trong transaction của request. `SET LOCAL` tự hết hiệu lực khi
-- COMMIT/ROLLBACK, nên giá trị không thể rò rỉ sang request dùng lại cùng connection.

CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO chronoshelf_anon, chronoshelf_auth;

-- Tham số thứ hai `true` = missing_ok: chưa đặt thì trả NULL thay vì báo lỗi. Đó
-- chính là trạng thái "chưa đăng nhập", và nó là mặc định — quên đặt thì fail đóng,
-- không phải fail mở.
--
-- Cố ý KHÔNG bọc ép kiểu trong exception handler: `app.user_id` chỉ do middleware của
-- chính ta đặt, nên một giá trị không phải uuid là lỗi lập trình. Nuốt nó đi sẽ biến
-- một request hỏng thành một request ẩn danh im lặng.
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $fn$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$fn$;

REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO chronoshelf_anon, chronoshelf_auth;
