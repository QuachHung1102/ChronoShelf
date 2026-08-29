-- `shelves` cũng phải có chỗ ghi nguồn + tác giả cho ảnh bìa.
--
-- Bảng này có sẵn `cover_url` từ `04-content-tables.sql` nhưng KHÔNG có hai cột credit,
-- nên `10-image-credit.sql` bỏ qua nó. Hệ quả: đó là bảng duy nhất mà một tấm ảnh có thể
-- vào hệ thống mà không có chỗ ghi giấy phép — và vì thế màn quản trị chưa bao giờ mở ô
-- upload ảnh bìa kệ. Thêm hai cột này là bước gỡ đúng chỗ nút thắt đó.
--
-- THỨ TỰ TRONG FILE NÀY QUAN TRỌNG, y như file 10: vá dữ liệu TRƯỚC, thêm ràng buộc SAU.
-- Đảo lại thì `db:migrate` roll back và thông báo lỗi trông như lỗi cú pháp.

ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS cover_source text;
ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS cover_credit text;

-- Vá dữ liệu cũ. Hôm nay chạy không trúng dòng nào (đã đo: 0/2 kệ có `cover_url`), nhưng
-- vẫn phải có: một database đã chạy từ trước có thể đã được gõ tay một tấm bìa vào, và
-- khi đó ADD CONSTRAINT sẽ nổ giữa chừng bản migrate.
UPDATE public.shelves
   SET cover_source = coalesce(cover_source, 'Chưa ghi nguồn — cần bổ sung'),
       cover_credit = coalesce(cover_credit, 'Chưa ghi tác giả — cần bổ sung')
 WHERE cover_url IS NOT NULL
   AND (cover_source IS NULL OR cover_credit IS NULL);

-- Cùng biểu thức với ba ràng buộc kia trong `10-image-credit.sql`: không ảnh thì cả ba cột
-- NULL là hợp lệ, và gỡ ảnh phải gỡ được luôn credit trong cùng một lần ghi.
ALTER TABLE public.shelves DROP CONSTRAINT IF EXISTS shelves_cover_credit_ck;
ALTER TABLE public.shelves ADD  CONSTRAINT shelves_cover_credit_ck
  CHECK (cover_url IS NULL OR (cover_source IS NOT NULL AND cover_credit IS NOT NULL));

-- Hai cột mới phải nằm trong GRANT ghi của `chronoshelf_auth`, nếu không admin thật sẽ
-- không lưu được — policy "admin write" mới là hàng rào, GRANT chỉ là cửa. `05-content-rls.sql`
-- cấp INSERT/UPDATE toàn bảng nên cột mới đã tự nằm trong đó; khối tự kiểm dưới đây khẳng
-- định lại điều đó thay vì tin.

-- === TỰ KIỂM ===
DO $$
DECLARE
  v_msg text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shelves_cover_credit_ck') THEN
    RAISE EXCEPTION 'thiếu ràng buộc shelves_cover_credit_ck';
  END IF;

  IF NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'cover_source', 'UPDATE')
  OR NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'cover_credit', 'UPDATE') THEN
    RAISE EXCEPTION 'chronoshelf_auth không ghi được cover_source/cover_credit — admin thật cũng lưu hỏng';
  END IF;

  -- Ràng buộc phải THẬT SỰ chặn, không chỉ tồn tại.
  BEGIN
    INSERT INTO public.shelves (slug, name, position, cover_url)
    VALUES ('__thu-rang-buoc-bia', 'thử', 9999, '/media/' || repeat('a', 64));
    RAISE EXCEPTION 'shelves_cover_credit_ck KHÔNG chặn — ghi được bìa thiếu credit';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_msg = CONSTRAINT_NAME;
    IF v_msg <> 'shelves_cover_credit_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc: %', v_msg;
    END IF;
  END;

  RAISE NOTICE 'C. shelves.cover phải có nguồn + tác giả OK';
END $$;
