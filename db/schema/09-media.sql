-- Kho ảnh. Byte nằm THẲNG trong Postgres, địa chỉ hóa bằng sha256 của chính nội dung.
--
-- VÌ SAO KHÔNG LƯU RA ĐĨA:
--   `public/` KHÔNG dùng được. Đã kiểm thực nghiệm: file ghi vào `public/` trong lúc
--   `next start` đang chạy trả về 404, còn `next dev` trả 200 — đúng loại bẫy "chạy tốt
--   trên máy tôi" chỉ nổ ở production. (File commit sẵn trong `public/` thì vẫn bình
--   thường; vấn đề chỉ ở file sinh ra LÚC CHẠY.)
--
--   Thư mục ngoài + volume thì kéo theo: một biến môi trường mới, một volume phải mount
--   ở mọi nơi deploy, backup thành HAI thứ phải khớp nhau, guard chống path traversal, và
--   file mồ côi. Postgres đã là nguồn sự thật cho toàn bộ nội dung — ảnh đi cùng
--   `pg_dump`, cùng transaction với dòng dữ liệu, và máy mới clone chỉ cần restore DB.
--
-- ĐỊA CHỈ HÓA THEO NỘI DUNG làm BỐC HƠI ba lỗ bảo mật thay vì phải chặn từng cái:
--   - path traversal: tên file của client không bao giờ chạm tới một đường dẫn nào;
--     URL là sha256 do server tự tính.
--   - ghi đè lẫn nhau: cùng byte = cùng dòng. Hai admin tải cùng một ảnh Wikimedia ra
--     đúng một dòng, không ai đè được của ai.
--   - trùng lặp: một ảnh dùng cho ba trang vẫn chỉ tốn một dòng.
--
-- ponytail: blob trong DB. Trần: kích thước `pg_dump` và không offload được CDN. Chuyển
-- sang thư mục ngoài + volume khi dump vượt cỡ khó chịu — lúc đó chỉ đổi thân hai route,
-- URL `/media/<sha256>` giữ nguyên nên không dòng dữ liệu nào phải sửa.

CREATE TABLE IF NOT EXISTS public.media (
  sha256     text PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  -- Kiểu SNIFF ĐƯỢC từ magic byte, KHÔNG phải kiểu client khai. Danh sách này là
  -- allowlist: mọi thứ ngoài đây bị từ chối ở tầng ứng dụng trước khi tới đây.
  -- SVG CỐ Ý VẮNG MẶT — nó là XML, phục vụ cùng origin thì <script>/onload= chạy thật,
  -- thành stored XSS nhắm vào cả admin lẫn học sinh.
  mime       text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp','image/gif')),
  bytes      bytea NOT NULL,
  byte_len   integer NOT NULL CHECK (byte_len > 0 AND byte_len <= 2097152),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read media"  ON public.media;
DROP POLICY IF EXISTS "admin write" ON public.media;

-- `USING (true)` là CỐ Ý và phải giữ nguyên ý nghĩa đó: một blob ảnh địa chỉ hóa bằng
-- sha256 không phải bí mật, và lọc nó theo trạng thái xuất bản sẽ đòi join ngược về bốn
-- bảng nội dung cho mỗi lượt tải ảnh. Hệ quả phải nhớ: ĐỪNG BAO GIỜ dùng bảng này cho
-- thứ gì riêng tư — ai đoán đúng sha256 là đọc được.
CREATE POLICY "read media"  ON public.media FOR SELECT USING (true);
CREATE POLICY "admin write" ON public.media FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.media FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.media TO chronoshelf_anon, chronoshelf_auth;

-- CHỈ INSERT, cố ý không UPDATE/DELETE. Bảng chỉ-ghi-thêm là thứ khiến
-- `Cache-Control: immutable` ở route phục vụ đúng THEO CẤU TẠO chứ không theo lời hứa:
-- nội dung tại một sha256 không thể đổi, vì đổi byte là đổi sha256. Nới GRANT ở đây là
-- biến header đó thành nói dối — `90-verify.sql` khẳng định lại điều này.
GRANT INSERT ON public.media TO chronoshelf_auth;
