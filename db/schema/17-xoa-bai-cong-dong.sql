-- Gỡ bài và bình luận trên bảng tin cộng đồng.
--
-- `13-community.sql` cố ý chỉ cấp SELECT + INSERT: lúc đó bảng tin mới dựng và chưa ai
-- nghĩ tới việc phải gỡ. Hệ quả là **không ai xóa được gì, kể cả admin** — một bài bậy
-- đăng lên là nằm đó vĩnh viễn, và cách duy nhất gỡ nó là mở psql dưới quyền superuser.
-- Đó không phải một quyết định thiết kế, đó là một lỗ.
--
-- HAI CHỦ THỂ ĐƯỢC XÓA, và chỉ hai:
--   1. **Chính tác giả** — gõ nhầm, đăng nhầm chỗ, đổi ý. Đây là thao tác người dùng
--      bình thường nhất trên mọi bảng tin.
--   2. **Admin** — kiểm duyệt. Dùng `public.is_admin()`, đúng hàm mà policy "admin write"
--      của bảng nội dung gọi, nên định nghĩa admin không bao giờ có hai bản.
--
-- CỐ Ý KHÔNG CÓ UPDATE. Sửa một bài đã có người bình luận bên dưới là làm cho các bình
-- luận đó nói về một văn bản không còn tồn tại — người đọc sau không có cách nào biết.
-- Trên một bảng tin ngắn thế này, xóa rồi đăng lại là đủ, và nó thành thật hơn. Muốn có
-- UPDATE thì phải kèm `edited_at` hiển thị ra và một quyết định về lịch sử sửa; đó là
-- một việc riêng, không phải một dòng GRANT thêm vào đây.
--
-- Xóa bài KHÔNG rút lại ngày giữ lửa đã ghi. `record_community_post_activity()` là
-- trigger AFTER INSERT và không có trigger ngược lại — CHỦ Ý: hôm đó người ta CÓ hoạt
-- động thật, việc sau này họ gỡ bài không làm điều đó chưa từng xảy ra. Nếu ngày nào
-- muốn đổi, hãy sửa ở đây và nhớ rằng streak khi đó thành thứ tự trừ được.

DROP POLICY IF EXISTS "delete own or admin post"    ON public.community_posts;
DROP POLICY IF EXISTS "delete own or admin comment" ON public.community_comments;

CREATE POLICY "delete own or admin post" ON public.community_posts
  FOR DELETE USING (app.current_user_id() = author_id OR public.is_admin());
CREATE POLICY "delete own or admin comment" ON public.community_comments
  FOR DELETE USING (app.current_user_id() = author_id OR public.is_admin());

-- GRANT là cái CỬA, policy mới là hàng rào. Thiếu GRANT thì admin thật cũng xóa hỏng;
-- có GRANT mà thiếu policy thì RLS chặn sạch. Cần cả hai.
GRANT DELETE ON public.community_posts, public.community_comments TO chronoshelf_auth;

-- `chronoshelf_anon` KHÔNG được cấp gì thêm: người chưa đăng nhập không có `author_id`
-- nào để mà sở hữu, và `is_admin()` của họ luôn false — nhưng để rõ ý, cứ REVOKE lại.
REVOKE DELETE ON public.community_posts, public.community_comments FROM chronoshelf_anon;

-- Bình luận đi theo bài: `community_comments.post_id` có ON DELETE CASCADE từ file 13,
-- nên xóa một bài là dọn luôn cả nhánh bình luận trong cùng một câu lệnh. Ràng buộc
-- khóa ngoại chạy bằng quyền chủ bảng và BỎ QUA RLS (tài liệu PG, mục Row Security
-- Policies) — ở đây đó chính là thứ ta muốn: gỡ một bài thì mọi bình luận dưới nó phải
-- đi theo, kể cả bình luận của người khác.

-- === TỰ KIỂM ===
DO $$
DECLARE
  v_qual text;
BEGIN
  IF NOT has_table_privilege('chronoshelf_auth', 'public.community_posts', 'DELETE')
  OR NOT has_table_privilege('chronoshelf_auth', 'public.community_comments', 'DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_auth không có GRANT DELETE trên bảng tin — admin thật cũng gỡ hỏng';
  END IF;

  IF has_table_privilege('chronoshelf_anon', 'public.community_posts', 'DELETE')
  OR has_table_privilege('chronoshelf_anon', 'public.community_comments', 'DELETE') THEN
    RAISE EXCEPTION 'chronoshelf_anon xóa được bài — người chưa đăng nhập không được đụng vào';
  END IF;

  -- Biểu thức policy phải nhắc CẢ HAI vế. Rơi mất `is_admin()` thì kiểm duyệt chết câm;
  -- rơi mất vế tác giả thì người dùng không gỡ được bài của chính mình. Cả hai đều là
  -- hỏng trong im lặng — giao diện vẫn có nút, bấm vào chỉ không có gì xảy ra.
  FOR v_qual IN
    SELECT qual FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('community_posts', 'community_comments')
       AND cmd = 'DELETE'
  LOOP
    IF v_qual IS NULL OR v_qual NOT LIKE '%current_user_id%' OR v_qual NOT LIKE '%is_admin%' THEN
      RAISE EXCEPTION 'policy DELETE của bảng tin không còn đủ hai vế tác giả + admin: %', v_qual;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename IN ('community_posts','community_comments')
         AND cmd='DELETE') <> 2 THEN
    RAISE EXCEPTION 'chờ đúng 2 policy DELETE trên bảng tin';
  END IF;

  -- UPDATE vẫn phải đóng. Đây là dòng giữ cho quyết định "không sửa bài" ở phần chú
  -- thích đầu file không âm thầm biến mất bằng một GRANT tiện tay.
  IF has_table_privilege('chronoshelf_auth', 'public.community_posts', 'UPDATE')
  OR has_table_privilege('chronoshelf_auth', 'public.community_comments', 'UPDATE') THEN
    RAISE EXCEPTION 'bảng tin mọc thêm quyền UPDATE — sửa bài đã có bình luận cần thiết kế riêng, xem đầu file 17';
  END IF;

  RAISE NOTICE '17. gỡ bài + bình luận cộng đồng OK';
END $$;
