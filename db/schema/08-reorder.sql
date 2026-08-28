-- Đổi thứ tự sách và trang.
--
-- LÝ DO TỒN TẠI: `books_shelf_position_key` và `pages_book_position_key` là DEFERRABLE
-- INITIALLY DEFERRED, nên đổi chỗ hai dòng chỉ hợp lệ khi cả hai UPDATE nằm TRONG CÙNG
-- một transaction. Một hàm là một transaction — gọn hơn là bắt tầng ứng dụng tự mở
-- transaction rồi nhớ đừng quên.
--
-- BẢO MẬT: hai hàm này CỐ Ý KHÔNG PHẢI `SECURITY DEFINER`. Chạy bằng quyền người gọi
-- thì policy "admin write" vẫn áp lên UPDATE bên trong; người đã đăng nhập mà không
-- phải admin sẽ trúng 0 dòng và khẳng định ROW_COUNT bên dưới ném lỗi. Đổi thành
-- SECURITY DEFINER là mở toang quyền sửa nội dung cho mọi tài khoản.

CREATE OR REPLACE FUNCTION public.reorder_books(p_shelf_slug text, p_slugs text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE v_updated integer;
BEGIN
  -- Phải nhận TOÀN BỘ kệ. Danh sách thiếu sẽ đẩy vài quyển vào đúng vị trí mà một
  -- quyển không nằm trong danh sách đang giữ — hợp lệ ở giữa transaction, vỡ lúc
  -- commit, và thông báo lỗi của Postgres lúc đó chẳng nói được gì cho admin.
  IF EXISTS (SELECT 1 FROM public.books
              WHERE shelf_slug = p_shelf_slug AND NOT (slug = ANY(p_slugs))) THEN
    RAISE EXCEPTION 'reorder_books: phải gửi TOÀN BỘ quyển của kệ %', p_shelf_slug;
  END IF;

  UPDATE public.books b
     SET position = x.ord
    FROM unnest(p_slugs) WITH ORDINALITY AS x(slug, ord)
   WHERE b.slug = x.slug AND b.shelf_slug = p_shelf_slug;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  -- Không phải khẳng định phòng xa: hàm này SECURITY INVOKER nên với người không phải
  -- admin, policy "admin write" làm UPDATE trúng 0 dòng mà KHÔNG báo lỗi. Dòng này là
  -- thứ biến "im lặng không làm gì" thành một lỗi nhìn thấy được.
  IF v_updated <> coalesce(array_length(p_slugs, 1), 0) THEN
    RAISE EXCEPTION 'reorder_books: nhận % slug nhưng chỉ ghi được % dòng (thiếu quyền, hoặc slug sai kệ)',
      coalesce(array_length(p_slugs, 1), 0), v_updated;
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reorder_pages(p_book_slug text, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE v_updated integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.pages
              WHERE book_slug = p_book_slug AND NOT (id = ANY(p_ids))) THEN
    RAISE EXCEPTION 'reorder_pages: phải gửi TOÀN BỘ trang của quyển %', p_book_slug;
  END IF;

  UPDATE public.pages p
     SET position = x.ord
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
   WHERE p.id = x.id AND p.book_slug = p_book_slug;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> coalesce(array_length(p_ids, 1), 0) THEN
    RAISE EXCEPTION 'reorder_pages: nhận % id nhưng chỉ ghi được % dòng (thiếu quyền, hoặc id sai quyển)',
      coalesce(array_length(p_ids, 1), 0), v_updated;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.reorder_books(text, text[]) FROM PUBLIC, chronoshelf_anon;
REVOKE ALL ON FUNCTION public.reorder_pages(text, uuid[]) FROM PUBLIC, chronoshelf_anon;
GRANT EXECUTE ON FUNCTION public.reorder_books(text, text[]) TO chronoshelf_auth;
GRANT EXECUTE ON FUNCTION public.reorder_pages(text, uuid[]) TO chronoshelf_auth;
