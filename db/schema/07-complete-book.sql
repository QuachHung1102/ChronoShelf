-- Chốt hoàn thành một quyển sách: chấm bài trắc nghiệm, trao vật phẩm và cho biết quyển
-- kế tiếp đã mở chưa.
--
-- Tách làm hai hàm: `_complete_book_for` nhận user_id tường minh nên kiểm được bằng
-- fixture mà không cần dựng phiên đăng nhập giả, còn `complete_book` là cửa duy nhất
-- mở cho ứng dụng.
--
-- BẢO MẬT: `_complete_book_for` KHÔNG ĐƯỢC cấp EXECUTE cho role nào cả — ai gọi được
-- nó với user_id tùy ý là tự phát vật phẩm cho mình.

-- Chữ ký ĐỔI ngày 2026-09-07 (thêm `p_answers`). Phải DROP chứ không `CREATE OR REPLACE`
-- được: thêm tham số là tạo ra một hàm NẠP CHỒNG, và bản hai-tham-số cũ sẽ ở lại như một
-- cửa thứ hai trao vật phẩm mà KHÔNG chấm bài. Hai file này chạy lặp được nên DROP …
-- IF EXISTS là an toàn.
DROP FUNCTION IF EXISTS public.complete_book(text);
DROP FUNCTION IF EXISTS public._complete_book_for(uuid, text);

CREATE OR REPLACE FUNCTION public._complete_book_for(
  p_user_id  uuid,
  p_book_slug text,
  p_answers  smallint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app
AS $fn$
DECLARE
  v_book              RECORD;
  v_page_count        integer;
  v_progress          RECORD;
  v_already_completed boolean := false;
  v_wrong             bigint[];
  v_next              RECORD;
  v_has_next          boolean := false;
  v_next_unlocked     boolean := false;
BEGIN
  -- PHẠM VI: năm phép kiểm dưới đây là TOÀN BỘ những gì hàm này bảo đảm — đã đăng nhập,
  -- sách và kệ đều published, sách có trang, đã đọc đủ số trang, và trả lời đúng hết bài
  -- trắc nghiệm nếu quyển đó có. KHÔNG có phép kiểm nào ép thứ tự đọc: gọi thẳng quyển
  -- cuối kệ khi `user_items` còn rỗng vẫn được trao thưởng (đo ngày 2026-08-29). Chuỗi
  -- khóa/mở chỉ là chuyện hiển thị, do `resolveState` ở `lib/api/unlock.ts` lo, và nội
  -- dung quyển "bị khóa" vốn đã công khai.
  --
  -- ĐỪNG "vá" bằng cách đòi vật phẩm thưởng của quyển liền trước. Nó vừa không chặn được —
  -- kẻ gian chỉ cần duyệt kệ theo thứ tự, mỗi bước tự trao chìa khóa cho bước sau — vừa đẻ
  -- ra lỗi thật: `08-reorder.sql` cho đổi `position`, nên "quyển liền trước" không cố định
  -- và một lần admin chèn sách vào giữa là làm đứt chuỗi của người đang đọc. Đường nâng cấp
  -- đúng (cột `required_item_slug` tường minh) ghi ở `lib/api/unlock.ts`.
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Join `shelves` và đòi `s.published`: hàm chạy SECURITY DEFINER nên KHÔNG chịu RLS
  -- của policy "read published" — thiếu vế này, một quyển published nằm trên một kệ
  -- chưa published vẫn hoàn thành được và vẫn phát vật phẩm thật, dù readShelf() đã ẩn
  -- cả kệ khỏi giao diện từ trước.
  SELECT b.* INTO v_book
    FROM public.books b
    JOIN public.shelves s ON s.slug = b.shelf_slug
   WHERE b.slug = p_book_slug AND b.published AND s.published;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  SELECT count(*) INTO v_page_count FROM public.pages WHERE book_slug = p_book_slug;
  IF v_page_count = 0 THEN
    -- Không có dòng này thì current_page >= 0 luôn đúng và quyển rỗng thành máy phát
    -- vật phẩm.
    RAISE EXCEPTION 'Book has no pages';
  END IF;

  SELECT * INTO v_progress
    FROM public.user_book_progress
   WHERE user_id = p_user_id AND book_slug = p_book_slug
     FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
         VALUES (p_user_id, p_book_slug, 1)
      RETURNING * INTO v_progress;
  END IF;

  IF v_progress.completed THEN
    v_already_completed := true;
  ELSE
    IF v_progress.current_page < v_page_count THEN
      RAISE EXCEPTION 'Book not finished yet (page % of %)', v_progress.current_page, v_page_count;
    END IF;

    -- Chấm bài trắc nghiệm (content.md §4.3). Đây là chỗ DUY NHẤT trong sản phẩm đọc
    -- `correct_index`; không role nào SELECT được cột đó (GRANT theo cột ở
    -- `05-content-rls.sql`), nên không có đường nào chấm bài ở tầng Node kể cả khi ai đó
    -- muốn.
    --
    -- Đối chiếu theo THỨ TỰ (`row_number`), không theo giá trị `position`: xóa một câu
    -- để lại lỗ thủng trong `position` (y như `pages`), mà client thì gửi về một mảng
    -- song song với danh sách câu hỏi nó nhận được. Neo vào `position` là lệch chỉ số
    -- ngay lần admin xóa câu hỏi đầu tiên.
    --
    -- Quyển KHÔNG có câu hỏi nào: `array_agg` trên không dòng trả NULL, `coalesce` biến
    -- thành mảng rỗng, và nhánh dưới không chạy — 13 quyển đang xuất bản giữ nguyên
    -- hành vi cũ, không cần trường hợp đặc biệt.
    --
    -- `p_answers` NULL hoặc ngắn hơn số câu: phần tử thiếu là NULL, `IS DISTINCT FROM`
    -- cho ra "sai". Bỏ trống là sai, không phải là được bỏ qua.
    SELECT coalesce(array_agg(q.n ORDER BY q.n), '{}')
      INTO v_wrong
      FROM (SELECT correct_index, row_number() OVER (ORDER BY position) AS n
              FROM public.book_questions
             WHERE book_slug = p_book_slug) q
     WHERE q.correct_index IS DISTINCT FROM p_answers[q.n::int];

    IF array_length(v_wrong, 1) IS NOT NULL THEN
      -- RETURN, KHÔNG `RAISE EXCEPTION`: exception hủy cả transaction của request, và
      -- luật đó đã được ghi bằng máu ở CLAUDE.md (bộ đếm OTP vĩnh viễn bằng 0). Ở đây
      -- chưa ghi gì nên chưa mất gì — nhưng nếu ngày nào thêm việc đếm số lần làm bài
      -- thì lần ghi đó cũng sẽ bị cuốn theo. Trả về là hình dạng đúng ngay từ đầu.
      --
      -- CỐ Ý không giới hạn số lần thử: đây là hàng rào SƯ PHẠM, không phải hàng rào
      -- bảo mật — nội dung sách vốn công khai và đáp án đoán được bằng cách thử. Nó tồn
      -- tại để học sinh phải quay lại đọc, không phải để chống kẻ gian.
      RETURN jsonb_build_object(
        'quizPassed',      false,
        'wrongPositions',  to_jsonb(v_wrong),
        'alreadyCompleted', false,
        'grantedItemSlug', null,
        'nextBook',        null
      );
    END IF;

    UPDATE public.user_book_progress
       SET completed = true, completed_at = now()
     WHERE user_id = p_user_id AND book_slug = p_book_slug;

    IF v_book.reward_item_slug IS NOT NULL THEN
      INSERT INTO public.user_items (user_id, item_slug)
           VALUES (p_user_id, v_book.reward_item_slug)
      ON CONFLICT (user_id, item_slug) DO NOTHING;
    END IF;
  END IF;

  SELECT * INTO v_next
    FROM public.books
   WHERE shelf_slug = v_book.shelf_slug AND position > v_book.position AND published
   ORDER BY position ASC LIMIT 1;
  v_has_next := FOUND;

  IF v_has_next THEN
    -- Quyển kế tiếp mở ⟺ người dùng có vật phẩm thưởng của quyển này. Không tra cột
    -- required_item_slug nào cả — nó không tồn tại, nên chuỗi không thể đứt.
    v_next_unlocked := v_book.reward_item_slug IS NULL
      OR EXISTS (SELECT 1 FROM public.user_items
                  WHERE user_id = p_user_id AND item_slug = v_book.reward_item_slug);
  END IF;

  RETURN jsonb_build_object(
    'quizPassed',       true,
    'wrongPositions',   '[]'::jsonb,
    'alreadyCompleted', v_already_completed,
    'grantedItemSlug',  v_book.reward_item_slug,
    'nextBook',
      CASE WHEN v_has_next
           THEN jsonb_build_object('slug', v_next.slug, 'unlocked', v_next_unlocked)
           ELSE null END
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.complete_book(p_book_slug text, p_answers smallint[])
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, app
AS $w$ SELECT public._complete_book_for(app.current_user_id(), p_book_slug, p_answers) $w$;

REVOKE ALL ON FUNCTION public._complete_book_for(uuid, text, smallint[])
  FROM PUBLIC, chronoshelf_anon, chronoshelf_auth, chronoshelf_app;
REVOKE ALL ON FUNCTION public.complete_book(text, smallint[])
  FROM PUBLIC, chronoshelf_anon, chronoshelf_app;
GRANT EXECUTE ON FUNCTION public.complete_book(text, smallint[]) TO chronoshelf_auth;
