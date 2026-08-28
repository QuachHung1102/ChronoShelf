-- Hàng rào đọc/ghi của bốn bảng nội dung.
--
-- Khác thời InsForge ở MỘT điểm về mô hình đe dọa, cần nói rõ: hồi đó trình duyệt gọi
-- thẳng PostgREST nên quyền của `anon` chính là thứ kẻ tấn công cầm trong tay. Bây giờ
-- trình duyệt chỉ nói chuyện với Route Handler của ta, nên lớp này là phòng thủ chiều
-- sâu chống lại LỖI CỦA CHÍNH TA — một route quên kiểm quyền admin vẫn bị chặn ở đây.
-- Nó rẻ và nó bắt đúng loại lỗi hay xảy ra nhất, nên vẫn giữ.

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
