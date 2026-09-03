-- Thư viện bài giảng & slide (content.md §7).
--
-- Hai bảng: `documents` giữ byte của bộ slide, `lessons` là dòng dữ liệu bài giảng.
--
-- VÌ SAO KHÔNG DÙNG LẠI `media`: bảng đó có hai hàng rào mà `90-verify.sql` so khớp CHÍNH
-- XÁC — allowlist bốn kiểu ảnh raster (SVG cố ý vắng mặt vì nó là XML và sẽ thành stored
-- XSS) và trần 2 MiB. Một bộ slide vượt cả hai. Nới allowlist đó là mở lại đúng lỗ SVG cho
-- một lý do chẳng liên quan gì tới SVG. Bảng riêng giữ được cả hai hàng rào nguyên vẹn.

-- ---------------------------------------------------------------------------
-- documents — byte của bộ slide, địa chỉ hóa theo nội dung y như `media`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  sha256     text PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  -- Đúng MỘT kiểu. Danh sách một phần tử vẫn viết dưới dạng allowlist để lần sau thêm
  -- kiểu (PDF chẳng hạn) là sửa đúng một chỗ, và `90-verify.sql` khẳng định lại nó.
  mime       text NOT NULL CHECK (mime IN (
               'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  -- Tên hiển thị lúc tải về. KHÔNG BAO GIỜ được dùng làm đường dẫn: định danh là sha256
  -- do máy chủ tự tính. Chặn ký tự điều khiển và dấu ngoặc kép ở đây vì tên này đi thẳng
  -- vào header `Content-Disposition`.
  filename   text NOT NULL CHECK (
               btrim(filename) <> '' AND length(filename) <= 200
               AND filename !~ '[[:cntrl:]"\\]'),
  bytes      bytea NOT NULL,
  -- 25 MiB. Một bộ slide bài giảng có ảnh tư liệu nằm gọn dưới ngưỡng này.
  byte_len   integer NOT NULL CHECK (byte_len > 0 AND byte_len <= 26214400),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read documents" ON public.documents;
DROP POLICY IF EXISTS "admin write"    ON public.documents;

-- `USING (true)` cùng lý do và cùng ĐÁNH ĐỔI như `media`: một blob địa chỉ hóa bằng
-- sha256 không phải bí mật, và lọc theo trạng thái xuất bản đòi join ngược về `lessons`
-- cho mỗi lượt tải. HỆ QUẢ PHẢI NHỚ: ai đoán đúng sha256 là tải được, kể cả bài giảng còn
-- nháp. Đừng bao giờ để thứ riêng tư vào bảng này.
CREATE POLICY "read documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "admin write"    ON public.documents FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.documents FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.documents TO chronoshelf_anon, chronoshelf_auth;
-- CHỈ INSERT, cố ý không UPDATE/DELETE — cùng lý do như `media`: bảng chỉ-ghi-thêm là thứ
-- khiến `Cache-Control: immutable` ở route phục vụ đúng THEO CẤU TẠO chứ không theo lời
-- hứa. Nới GRANT ở đây là biến header đó thành nói dối.
GRANT INSERT ON public.documents TO chronoshelf_auth;

-- Neo `byte_len` vào kích thước THẬT. Không có ràng buộc này thì trần 25 MiB ở trên chỉ
-- chặn một CON SỐ do người ghi tự khai, không chặn byte. Vá dữ liệu TRƯỚC, thêm ràng buộc
-- SAU (đảo lại thì ADD CONSTRAINT roll back cả file). Cùng lối với `09-media.sql`.
UPDATE public.documents SET byte_len = octet_length(bytes) WHERE byte_len <> octet_length(bytes);

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_byte_len_thuc_ck;
ALTER TABLE public.documents ADD  CONSTRAINT documents_byte_len_thuc_ck
  CHECK (byte_len = octet_length(bytes));

-- ---------------------------------------------------------------------------
-- lessons — một bài giảng: bộ slide + sơ đồ tư duy, gắn với một lớp và (tùy chọn) một
-- quyển sách.
--
-- KHÔNG CÓ CỘT `position`. Thứ tự hiển thị là `grade, title`. Sắp tay đòi cột position,
-- ràng buộc UNIQUE DEFERRABLE và một RPC đổi thứ tự như `08-reorder.sql`; cả bộ đó tồn
-- tại cho kệ sách vì CHUỖI MỞ KHÓA phụ thuộc thứ tự. Bài giảng không có chuỗi nào.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lessons (
  slug           text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  grade          smallint NOT NULL CHECK (grade IN (10, 11, 12)),
  title          text NOT NULL CHECK (btrim(title) <> '' AND length(title) <= 200),
  summary        text NOT NULL DEFAULT '' CHECK (length(summary) <= 500),

  -- Liên kết chéo (content.md §7): đọc xong quyển này thì gợi ý bài giảng này.
  -- SET NULL chứ không RESTRICT: xóa một quyển sách không được kéo theo việc chặn admin,
  -- bài giảng vẫn còn giá trị khi đứng một mình.
  book_slug      text REFERENCES public.books(slug) ON DELETE SET NULL,

  -- RESTRICT chứ không SET NULL: `documents` là bảng chỉ-ghi-thêm, không role nào xóa
  -- được dòng, nên nhánh này không bao giờ chạy. Để RESTRICT cho nó nói đúng ý đồ.
  slide_sha256   text REFERENCES public.documents(sha256) ON DELETE RESTRICT,
  slide_filename text CHECK (slide_filename IS NULL OR btrim(slide_filename) <> ''),

  preview_url    text,
  preview_source text,
  preview_credit text,

  mindmap_url    text,
  mindmap_source text,
  mindmap_credit text,

  published      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Có ảnh thì BẮT BUỘC có cả nguồn lẫn dòng ghi công — cùng khuôn `10-image-credit.sql`.
-- Đây là điều kiện BY của CC BY-SA, cưỡng chế ở tầng dữ liệu chứ không phải ở form.
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_preview_credit_ck;
ALTER TABLE public.lessons ADD  CONSTRAINT lessons_preview_credit_ck
  CHECK (preview_url IS NULL
         OR (btrim(coalesce(preview_source, '')) <> '' AND btrim(coalesce(preview_credit, '')) <> ''));

ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_mindmap_credit_ck;
ALTER TABLE public.lessons ADD  CONSTRAINT lessons_mindmap_credit_ck
  CHECK (mindmap_url IS NULL
         OR (btrim(coalesce(mindmap_source, '')) <> '' AND btrim(coalesce(mindmap_credit, '')) <> ''));

-- Tên tệp đi cùng bộ slide: có slide thì phải có tên để đặt vào Content-Disposition.
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_slide_filename_ck;
ALTER TABLE public.lessons ADD  CONSTRAINT lessons_slide_filename_ck
  CHECK ((slide_sha256 IS NULL) = (slide_filename IS NULL));

CREATE INDEX IF NOT EXISTS lessons_grade_idx ON public.lessons (grade, title);
CREATE INDEX IF NOT EXISTS lessons_book_idx  ON public.lessons (book_slug) WHERE book_slug IS NOT NULL;

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read published" ON public.lessons;
DROP POLICY IF EXISTS "admin write"    ON public.lessons;

CREATE POLICY "read published" ON public.lessons FOR SELECT
  USING (published OR public.is_admin());
CREATE POLICY "admin write" ON public.lessons FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.lessons FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.lessons TO chronoshelf_anon, chronoshelf_auth;
GRANT INSERT, UPDATE, DELETE ON public.lessons TO chronoshelf_auth;

-- === TỰ KIỂM ===
-- Ràng buộc phải THẬT SỰ chặn, không chỉ có mặt trong catalog. Chèn thử dòng sai rồi đòi
-- nó nổ đúng tên; nổ đúng thì nuốt, không nổ thì báo lỗi to.
DO $$
DECLARE v_name text;
BEGIN
  BEGIN
    INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
         VALUES (repeat('b', 64),
                 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                 'a.pptx', '\x0001'::bytea, 1);
    RAISE EXCEPTION 'documents_byte_len_thuc_ck KHÔNG chặn — byte_len vẫn khai man được';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_name = CONSTRAINT_NAME;
    IF v_name <> 'documents_byte_len_thuc_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc bắt được: %', v_name;
    END IF;
  END;

  BEGIN
    INSERT INTO public.lessons (slug, grade, title, mindmap_url)
         VALUES ('kiem-thu-tam', 10, 'Kiểm thử', '/media/' || repeat('c', 64));
    RAISE EXCEPTION 'lessons_mindmap_credit_ck KHÔNG chặn — ảnh vào được mà không có credit';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_name = CONSTRAINT_NAME;
    IF v_name <> 'lessons_mindmap_credit_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc bắt được: %', v_name;
    END IF;
  END;

  BEGIN
    INSERT INTO public.lessons (slug, grade, title, slide_sha256)
         VALUES ('kiem-thu-tam', 10, 'Kiểm thử', NULL);
    -- Không có slide thì không cần tên — dòng này PHẢI qua. Dọn lại ngay.
    DELETE FROM public.lessons WHERE slug = 'kiem-thu-tam';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'bài giảng không có slide lẽ ra phải chèn được, nhưng: %', SQLERRM;
  END;

  RAISE NOTICE 'H. thư viện bài giảng: trần byte + credit ảnh OK';
END $$;
