-- Sưu tầm TRỌN BỘ một kệ: danh hiệu + nội dung thưởng (content.md §4.5), và bức tranh
-- toàn cảnh ghép từ các mảnh (content.md §4.4).
--
-- Năm cột, tất cả trên `shelves`, không bảng mới. Lý do không dựng bảng riêng: phần
-- thưởng là thuộc tính 1-1 của kệ, không có dòng nào thứ hai để mà chứa — một bảng
-- `shelf_rewards` sẽ chỉ là `shelves` với thêm một JOIN và thêm một chỗ để lệch.
--
-- VÌ SAO KHÔNG CÓ CỘT "SỐ MẢNH": số mảnh = số vật phẩm của kệ, đếm được từ
-- `books.reward_item_slug`. Lưu thêm một con số là mở đường cho nó lệch khỏi sự thật đúng
-- lần đầu admin thêm một quyển — cùng lý do `required_item_slug` không tồn tại (file 04).
--
-- `reward_title`/`reward_body` là NOT NULL DEFAULT '' theo đúng tiền lệ `blurb` ở cùng
-- bảng. Chuỗi rỗng = chưa soạn. Không NULL ⇒ ràng buộc dưới đây không dính bẫy
-- "CHECK chỉ TỪ CHỐI khi biểu thức ra FALSE, NULL thì cho qua" đã ghi ở CLAUDE.md.

ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS reward_title  text NOT NULL DEFAULT '';
ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS reward_body   text NOT NULL DEFAULT '';
ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS mosaic_url    text;
ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS mosaic_source text;
ALTER TABLE public.shelves ADD COLUMN IF NOT EXISTS mosaic_credit text;

-- KHÔNG có bước "vá dữ liệu cũ" như file 10 và 12, và đó là chủ ý: ở đó `cover_url` đã
-- tồn tại từ trước nên có thể đang giữ một tấm ảnh thiếu credit. Ở đây cả năm cột sinh ra
-- trong CHÍNH file này, cùng một transaction với ràng buộc, nên không tồn tại được một
-- dòng vi phạm để mà vá.

-- Cùng biểu thức với bốn ràng buộc credit kia (files 10 và 12): không ảnh thì cả ba cột
-- NULL là hợp lệ, và gỡ ảnh phải gỡ được luôn credit trong cùng một lần ghi.
ALTER TABLE public.shelves DROP CONSTRAINT IF EXISTS shelves_mosaic_credit_ck;
ALTER TABLE public.shelves ADD  CONSTRAINT shelves_mosaic_credit_ck
  CHECK (mosaic_url IS NULL OR (mosaic_source IS NOT NULL AND mosaic_credit IS NOT NULL));

-- Nội dung thưởng mà không có danh hiệu là một khối chữ không ai biết vì sao mình đọc
-- được nó. Chiều ngược lại thì hợp lệ: một danh hiệu suông vẫn là phần thưởng.
ALTER TABLE public.shelves DROP CONSTRAINT IF EXISTS shelves_reward_ck;
ALTER TABLE public.shelves ADD  CONSTRAINT shelves_reward_ck
  CHECK (reward_body = '' OR reward_title <> '');

-- `05-content-rls.sql` cấp SELECT/INSERT/UPDATE/DELETE TOÀN BẢNG nên năm cột mới đã tự
-- nằm trong đó. Khối dưới đây khẳng định lại thay vì tin — đúng lối file 12.

-- === TỰ KIỂM ===
DO $$
DECLARE
  v_msg text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shelves_mosaic_credit_ck') THEN
    RAISE EXCEPTION 'thiếu ràng buộc shelves_mosaic_credit_ck';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shelves_reward_ck') THEN
    RAISE EXCEPTION 'thiếu ràng buộc shelves_reward_ck';
  END IF;

  IF NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'reward_title',  'UPDATE')
  OR NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'reward_body',   'UPDATE')
  OR NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'mosaic_url',    'UPDATE')
  OR NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'mosaic_source', 'UPDATE')
  OR NOT has_column_privilege('chronoshelf_auth', 'public.shelves', 'mosaic_credit', 'UPDATE') THEN
    RAISE EXCEPTION 'chronoshelf_auth không ghi được cột phần thưởng — admin thật cũng lưu hỏng';
  END IF;

  -- Hai ràng buộc phải THẬT SỰ chặn, không chỉ tồn tại. Cả hai INSERT dưới đây đều phải
  -- nổ; nổ xong là roll back tới savepoint nên không dòng rác nào ở lại.
  BEGIN
    INSERT INTO public.shelves (slug, name, position, mosaic_url)
    VALUES ('__thu-rang-buoc-tranh', 'thử', 9998, '/media/' || repeat('a', 64));
    RAISE EXCEPTION 'shelves_mosaic_credit_ck KHÔNG chặn — ghi được tranh thiếu credit';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_msg = CONSTRAINT_NAME;
    IF v_msg <> 'shelves_mosaic_credit_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc: %', v_msg;
    END IF;
  END;

  BEGIN
    INSERT INTO public.shelves (slug, name, position, reward_body)
    VALUES ('__thu-rang-buoc-thuong', 'thử', 9997, 'nội dung thưởng không có danh hiệu');
    RAISE EXCEPTION 'shelves_reward_ck KHÔNG chặn — ghi được nội dung thưởng thiếu danh hiệu';
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_msg = CONSTRAINT_NAME;
    IF v_msg <> 'shelves_reward_ck' THEN
      RAISE EXCEPTION 'sai ràng buộc: %', v_msg;
    END IF;
  END;

  RAISE NOTICE '16. phần thưởng trọn bộ + tranh ghép của kệ OK';
END $$;
