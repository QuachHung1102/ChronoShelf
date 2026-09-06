-- Hàng rào đọc/ghi của bốn bảng nội dung.
--
-- MÔ HÌNH ĐE DỌA, cần nói rõ vì nó quyết định lớp này đáng giá bao nhiêu: trình duyệt
-- KHÔNG nói chuyện thẳng với Postgres, nó chỉ gọi Route Handler của ta. Nên hàng rào
-- đầu tiên là code Node, còn lớp RLS này là phòng thủ chiều sâu chống lại LỖI CỦA
-- CHÍNH TA — một route quên kiểm quyền admin vẫn bị chặn ở đây. Nó rẻ và bắt đúng loại
-- lỗi hay xảy ra nhất, nên vẫn giữ.

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read published" ON public.shelves;
DROP POLICY IF EXISTS "read published" ON public.books;
DROP POLICY IF EXISTS "read items"     ON public.items;
DROP POLICY IF EXISTS "read pages"     ON public.pages;
DROP POLICY IF EXISTS "admin write"    ON public.shelves;
DROP POLICY IF EXISTS "admin write"    ON public.items;
DROP POLICY IF EXISTS "admin write"    ON public.books;
DROP POLICY IF EXISTS "admin write"    ON public.pages;

CREATE POLICY "read published" ON public.shelves FOR SELECT USING (published OR public.is_admin());

-- Không chỉ tự bản thân quyển: kệ cha cũng phải xuất bản (hoặc người gọi là admin).
-- Thiếu vế này, một quyển published nằm trên một kệ CHƯA published vẫn đọc được thẳng
-- qua bảng books/pages — trong khi readShelf() vẫn ẩn kệ đó khỏi UI, nên không có gì
-- trên giao diện lộ ra sự mâu thuẫn. Đúng luồng biên tập trong spec (tạo kệ → thêm
-- sách → publish từng quyển → publish kệ sau cùng) tạo ra trạng thái này một cách tự
-- nhiên, không phải trường hợp hiếm.
CREATE POLICY "read published" ON public.books   FOR SELECT USING (
  (published OR public.is_admin())
  AND EXISTS (SELECT 1 FROM public.shelves s
               WHERE s.slug = books.shelf_slug AND (s.published OR public.is_admin()))
);

-- items chỉ là tên/mô tả/ảnh, không có gì để giấu — và trang kệ cần tên vật phẩm để
-- hiện "Cần Trống đồng để mở" cho quyển đang khóa.
CREATE POLICY "read items"     ON public.items   FOR SELECT USING (true);

-- Không cần tự soi thêm `shelves` ở đây: subquery này SELECT từ `public.books`, và RLS
-- của `books` (đã có vế kệ cha ở trên) áp dụng LẠI cho chính subquery đó theo vai trò
-- của người gọi — Postgres không có khái niệm "đã ở trong policy khác thì miễn RLS".
CREATE POLICY "read pages"     ON public.pages   FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.books b
           WHERE b.slug = pages.book_slug AND (b.published OR public.is_admin()))
);

CREATE POLICY "admin write" ON public.shelves FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin write" ON public.items   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin write" ON public.books   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin write" ON public.pages   FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS chỉ LỌC DÒNG, nó không cấp quyền bảng. GRANT dưới đây là cần thiết để admin
-- thật ghi được; người đã đăng nhập nhưng không phải admin đi qua GRANT rồi bị policy
-- "admin write" chặn lại. Thiếu GRANT thì chính admin cũng ghi hỏng, và phép kiểm
-- "người thường không ghi được" sẽ đạt vì lý do sai.
REVOKE ALL ON public.shelves, public.items, public.books, public.pages
  FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.shelves, public.items, public.books, public.pages
  TO chronoshelf_anon, chronoshelf_auth;
GRANT INSERT, UPDATE, DELETE ON public.shelves, public.items, public.books, public.pages
  TO chronoshelf_auth;

-- ---------------------------------------------------------------------------
-- book_questions — bảng nội dung thứ NĂM, và bảng duy nhất có một cột phải giấu
-- ---------------------------------------------------------------------------
--
-- Bốn bảng trên không giấu gì cả: nội dung bài học vốn công khai, kể cả của quyển
-- "đang khóa" (CLAUDE.md nói thẳng điều đó). `book_questions.correct_index` là ngoại lệ
-- DUY NHẤT — đáp án tới được trình duyệt thì bài kiểm tra chỉ còn là trang trí.
--
-- Hàng rào ở đây là GRANT THEO CỘT, không phải policy, vì RLS lọc DÒNG và không có
-- khái niệm cột. Nó bắt đúng cái lỗi dễ mắc nhất: một `SELECT *` vô ý trong `readShelf()`
-- rồi đẩy nguyên dòng xuống client component. Với GRANT theo cột, câu lệnh đó NỔ ngay
-- (fail đóng) thay vì âm thầm in đáp án ra HTML.
ALTER TABLE public.book_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read published" ON public.book_questions;
DROP POLICY IF EXISTS "admin write"    ON public.book_questions;

-- Cùng khuôn với `pages`: RLS của `books` (đã gồm vế kệ cha) áp lại cho chính subquery
-- này theo vai trò người gọi, nên không cần soi `shelves` thêm lần nữa ở đây.
CREATE POLICY "read published" ON public.book_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.books b
           WHERE b.slug = book_questions.book_slug AND (b.published OR public.is_admin()))
);
CREATE POLICY "admin write" ON public.book_questions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.book_questions FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;

-- `correct_index` KHÔNG có trong danh sách. Đây là dòng làm nên toàn bộ giá trị của bài
-- kiểm tra — đừng thêm cột đó vào cho tiện.
GRANT SELECT (id, book_slug, position, prompt, choices) ON public.book_questions
  TO chronoshelf_anon, chronoshelf_auth;

-- GHI thì cấp cả bảng: ghi không làm lộ gì, và policy "admin write" đã lọc dòng. Admin
-- phải đặt được đáp án, nên INSERT/UPDATE buộc phải chạm `correct_index`.
GRANT INSERT, UPDATE, DELETE ON public.book_questions TO chronoshelf_auth;

-- Mặt sau của GRANT theo cột: admin cũng không SELECT được `correct_index`, mà màn soạn
-- câu hỏi thì phải hiện đáp án đang chọn. Cửa cho việc đó là hàm SECURITY DEFINER này —
-- một cửa, tự kiểm `is_admin()`, thay vì nới GRANT ra cho mọi người đã đăng nhập.
CREATE OR REPLACE FUNCTION public.admin_book_questions(p_book_slug text)
-- `"position"` phải đặt trong nháy kép: POSITION là từ khóa của SQL (hàm
-- `position(x in y)`), nên khai báo trần ở đây là lỗi cú pháp.
RETURNS TABLE (id uuid, "position" integer, prompt text, choices text[], correct_index smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $fn$
BEGIN
  -- SECURITY DEFINER nên hàm KHÔNG chịu RLS: thiếu dòng này thì bất kỳ ai đã đăng nhập
  -- cũng đọc được đáp án của mọi quyển, kể cả quyển còn nháp.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_book_questions: chỉ admin đọc được đáp án';
  END IF;

  RETURN QUERY
    SELECT q.id, q.position, q.prompt, q.choices, q.correct_index
      FROM public.book_questions q
     WHERE q.book_slug = p_book_slug
     ORDER BY q.position;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_book_questions(text) FROM PUBLIC, chronoshelf_anon, chronoshelf_app;
GRANT EXECUTE ON FUNCTION public.admin_book_questions(text) TO chronoshelf_auth;
