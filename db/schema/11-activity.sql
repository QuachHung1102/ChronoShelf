-- Nhật ký hoạt động theo NGÀY, để đếm chuỗi giữ lửa (content.md §6).
--
-- Một dòng cho mỗi người mỗi ngày có học — không phải mỗi lần lật trang. Nhờ vậy bảng lớn
-- chậm theo số NGƯỜI DÙNG chứ không theo lượng thao tác, và câu hỏi duy nhất mà nó phải
-- trả lời ("hôm đó có học không") đọc thẳng từ khóa chính.
--
-- Ngày lưu theo múi giờ VIỆT NAM chứ không phải UTC. Học sinh học lúc 22 giờ tối và lúc
-- 1 giờ sáng hôm sau là HAI ngày khác nhau với các em, nhưng với UTC thì 1 giờ sáng giờ
-- Việt Nam vẫn là ngày hôm trước — chuỗi sẽ đứt sai. `Asia/Ho_Chi_Minh` không có quy tắc
-- giờ mùa hè nên phép quy đổi này ổn định.

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id   uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  active_on date NOT NULL,
  PRIMARY KEY (user_id, active_on)
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own activity select" ON public.user_activity;
CREATE POLICY "own activity select" ON public.user_activity
  FOR SELECT USING (app.current_user_id() = user_id);

-- KHÔNG role nào ghi được, y như `user_items`. Chuỗi giữ lửa là thứ sẽ gắn với danh hiệu
-- và phần thưởng (§6), nên nếu client tự ghi được thì con số đó vô nghĩa ngay từ đầu.
-- Cửa duy nhất là hàm SECURITY DEFINER bên dưới.
REVOKE ALL ON public.user_activity FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;
GRANT SELECT ON public.user_activity TO chronoshelf_auth;

-- ---------------------------------------------------------------------------
-- Ghi nhận "hôm nay có học".
--
-- SECURITY DEFINER và tự lấy danh tính từ `app.current_user_id()`, KHÔNG nhận user_id làm
-- tham số: nhận tham số thì nó thành hàm ghi hộ người khác, đúng lỗi mà `_complete_book_for`
-- phải giấu EXECUTE để tránh.
--
-- `ON CONFLICT DO NOTHING` nên gọi bao nhiêu lần trong ngày cũng chỉ một dòng, và hàm
-- không bao giờ nổ vì gọi trùng — người đọc 30 trang một tối vẫn chỉ tính một ngày.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := app.current_user_id();
BEGIN
  -- Chưa đăng nhập thì im lặng không làm gì: `/api/me/progress` gọi hàm này trên mọi lần
  -- lưu, và một khách vãng lai lưu tiến độ không phải là lỗi cần nổ.
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_activity (user_id, active_on)
  VALUES (v_user, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
  ON CONFLICT (user_id, active_on) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_activity() TO chronoshelf_auth;

-- === TỰ KIỂM ===
-- Khối này chạy ngay sau khi tạo, nên một lần `db:migrate` là biết hàng rào có đứng không.
DO $$
DECLARE
  v_msg text;
BEGIN
  IF has_table_privilege('chronoshelf_auth', 'public.user_activity', 'INSERT')
  OR has_table_privilege('chronoshelf_auth', 'public.user_activity', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.user_activity', 'DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_auth ghi được user_activity — chuỗi giữ lửa tự bịa được';
  END IF;

  IF has_table_privilege('chronoshelf_anon', 'public.user_activity', 'SELECT') THEN
    RAISE EXCEPTION 'người chưa đăng nhập đọc được user_activity';
  END IF;

  IF NOT has_function_privilege('chronoshelf_auth', 'public.record_activity()', 'EXECUTE') THEN
    RAISE EXCEPTION 'chronoshelf_auth không gọi được record_activity — chuỗi sẽ không bao giờ tăng';
  END IF;
  IF has_function_privilege('chronoshelf_anon', 'public.record_activity()', 'EXECUTE') THEN
    RAISE EXCEPTION 'người chưa đăng nhập gọi được record_activity';
  END IF;

  v_msg := 'C. user_activity chỉ-đọc + record_activity OK';
  RAISE NOTICE '%', v_msg;
END $$;
