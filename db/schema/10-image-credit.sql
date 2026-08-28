-- Có ảnh thì BẮT BUỘC có nguồn + tác giả/giấy phép — cưỡng chế ở tầng database.
--
-- Đây là điều kiện của giấy phép CC BY-SA (spec §6), không phải thủ tục thừa. Form quản
-- trị đã chặn ở giao diện và `readImageFields()` chặn ở tầng action, nhưng cả hai đều
-- quên gọi được. Ràng buộc ở đây là lớp duy nhất còn đứng vững trước một `UPDATE` gõ tay
-- qua psql — và đó chính là con đường nội dung đang được sửa cho tới khi `/quan-tri`
-- hoàn thiện.
--
-- THỨ TỰ TRONG FILE NÀY QUAN TRỌNG: sửa dữ liệu TRƯỚC, thêm ràng buộc SAU. Đảo lại thì
-- `npm run db:migrate` roll back ngay và thông báo lỗi trông như lỗi cú pháp. Đã đo trên
-- DB thật ngày 2026-08-29: đúng 5/5 dòng `items` vi phạm, `books` và `pages` sạch.

-- ---------------------------------------------------------------------------
-- 1. Vá dữ liệu cũ.
--
-- Năm vật phẩm seed dùng SVG do CHÍNH DỰ ÁN vẽ (`public/items/*.svg`, commit trong git),
-- nên "nguồn" là repo và giấy phép là CC0 — đây là sự thật, không phải chỗ điền cho qua.
-- Khi spec §6 được thực hiện đầy đủ (thay bằng ảnh Wikimedia thật) thì hai câu UPDATE này
-- không còn khớp dòng nào nữa và trở thành vô hại.
-- ---------------------------------------------------------------------------
UPDATE public.items
   SET image_source = coalesce(image_source, 'https://github.com/QuachHung1102/ChronoShelf — public/items/' || slug || '.svg'),
       image_credit = coalesce(image_credit, 'Tự vẽ cho ChronoShelf · CC0 1.0')
 WHERE image_url LIKE '/items/%'
   AND (image_source IS NULL OR image_credit IS NULL);

-- ---------------------------------------------------------------------------
-- 2. Ràng buộc. Viết theo lối chạy lặp được như `db/schema/README.md` yêu cầu.
--
-- Chỉ đòi source+credit KHI CÓ ảnh: không ảnh thì cả ba cột NULL là hợp lệ, và gỡ ảnh
-- phải gỡ được luôn credit trong cùng một lần ghi.
-- ---------------------------------------------------------------------------
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_image_credit_ck;
ALTER TABLE public.items ADD  CONSTRAINT items_image_credit_ck
  CHECK (image_url IS NULL OR (image_source IS NOT NULL AND image_credit IS NOT NULL));

ALTER TABLE public.books DROP CONSTRAINT IF EXISTS books_cover_credit_ck;
ALTER TABLE public.books ADD  CONSTRAINT books_cover_credit_ck
  CHECK (cover_url IS NULL OR (cover_source IS NOT NULL AND cover_credit IS NOT NULL));

ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_image_credit_ck;
ALTER TABLE public.pages ADD  CONSTRAINT pages_image_credit_ck
  CHECK (image_url IS NULL OR (image_source IS NOT NULL AND image_credit IS NOT NULL));

-- === TỰ KIỂM ===
-- Ràng buộc vừa thêm phải THẬT SỰ chặn, không chỉ tồn tại trong catalog. Chèn thử một
-- dòng vi phạm rồi đòi nó nổ; nổ đúng thì nuốt, không nổ thì báo lỗi to.
DO $$
DECLARE v_msg text;
BEGIN
  BEGIN
    INSERT INTO public.items (slug, name, image_url) VALUES ('__ck-probe', 'x', '/media/deadbeef');
    RAISE EXCEPTION 'items_image_credit_ck KHÔNG chặn — ghi được ảnh thiếu credit';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_msg = CONSTRAINT_NAME;
    IF v_msg <> 'items_image_credit_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc bắt được: %', v_msg;
    END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.items
              WHERE image_url IS NOT NULL AND (image_source IS NULL OR image_credit IS NULL)) THEN
    RAISE EXCEPTION 'còn dòng items có ảnh mà thiếu credit — bước vá dữ liệu ở trên hụt';
  END IF;

  RAISE NOTICE 'D. ràng buộc ảnh-phải-có-credit OK';
END $$;
