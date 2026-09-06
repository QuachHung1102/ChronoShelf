-- Nội dung bài học. `required_item_slug` CỐ Ý KHÔNG TỒN TẠI: nó suy ra được 100% từ
-- vị trí (quyển i mở bằng vật phẩm thưởng của quyển i-1), nên không lưu thì chuỗi mở
-- khóa không thể đứt. Xem spec §2.2.
--
-- Ba ràng buộc UNIQUE về vị trí đều DEFERRABLE INITIALLY DEFERRED: đổi chỗ hai quyển
-- cần một trạng thái trung gian trùng vị trí, hợp lệ bên trong transaction và chỉ bị
-- kiểm lúc COMMIT. Đây chính là thứ MySQL không có và là một trong những lý do dự án
-- ở lại với PostgreSQL.

CREATE TABLE IF NOT EXISTS public.shelves (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  position     integer NOT NULL,
  country_code text UNIQUE,      -- id số ISO-3166-1 của world-atlas; '704' = Việt Nam
  blurb        text NOT NULL DEFAULT '',
  cover_url    text,
  published    boolean NOT NULL DEFAULT false,
  CONSTRAINT shelves_position_key UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.items (
  slug         text PRIMARY KEY,
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  image_url    text,
  image_source text,             -- URL trang gốc (Wikimedia Commons…)
  image_credit text              -- tác giả + giấy phép; điều kiện của CC BY-SA
);

CREATE TABLE IF NOT EXISTS public.books (
  slug             text PRIMARY KEY,
  shelf_slug       text NOT NULL REFERENCES public.shelves(slug) ON DELETE CASCADE,
  position         integer NOT NULL,
  title            text NOT NULL,
  era              text NOT NULL,
  cover_url        text,
  cover_source     text,
  cover_credit     text,
  -- RESTRICT chứ không SET NULL: SET NULL sẽ âm thầm mở toang quyển kế tiếp khi ai đó
  -- xóa một vật phẩm. RESTRICT bắt admin gỡ liên kết trước.
  reward_item_slug text REFERENCES public.items(slug) ON DELETE RESTRICT,
  published        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT books_shelf_position_key UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS public.pages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_slug    text NOT NULL REFERENCES public.books(slug) ON DELETE CASCADE,
  position     integer NOT NULL CHECK (position >= 1),
  heading      text NOT NULL,
  body         text NOT NULL,
  image_url    text,
  image_source text,
  image_credit text,
  caption      text,
  summary      text[],           -- chỉ trang cuối, 3-5 ý (content.md 4.3)
  CONSTRAINT pages_book_position_key UNIQUE (book_slug, position) DEFERRABLE INITIALLY DEFERRED
);

-- Bài trắc nghiệm cuối sách (content.md §4.3). Trả lời đúng hết mới được trao vật phẩm,
-- nên cột `correct_index` là thứ DUY NHẤT trong cả năm bảng nội dung phải giấu khỏi trình
-- duyệt — hàng rào cho nó là GRANT THEO CỘT ở `05-content-rls.sql`, không phải policy:
-- RLS lọc DÒNG, nó không biết gì về cột.
--
-- Đáp án lưu bằng CHỈ SỐ trong `choices` chứ không phải bản sao chuỗi đáp án: hai bản
-- sao thì sửa một chỗ quên chỗ kia là câu hỏi thành vô nghiệm, và không ràng buộc nào
-- bắt được. Chỉ số thì `book_questions_correct_range_ck` giữ cho luôn trỏ vào một lựa
-- chọn có thật.
CREATE TABLE IF NOT EXISTS public.book_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_slug     text NOT NULL REFERENCES public.books(slug) ON DELETE CASCADE,
  position      integer NOT NULL CHECK (position >= 1),
  prompt        text NOT NULL CHECK (btrim(prompt) <> '' AND length(prompt) <= 300),
  choices       text[] NOT NULL,
  correct_index smallint NOT NULL,
  CONSTRAINT book_questions_book_position_key UNIQUE (book_slug, position) DEFERRABLE INITIALLY DEFERRED,
  -- 2..4 lựa chọn: một câu một lựa chọn không phải câu hỏi, và quá bốn thì không còn
  -- vừa một trang giấy da bên cạnh câu hỏi.
  CONSTRAINT book_questions_choices_ck CHECK (
    array_length(choices, 1) BETWEEN 2 AND 4
    AND array_position(choices, NULL) IS NULL
    AND NOT ('' = ANY (choices))
  ),
  -- Chỉ số 0-based. Không có ràng buộc nào ở tầng Node bắt được lỗi này khi admin xóa
  -- bớt một lựa chọn mà quên hạ đáp án xuống.
  CONSTRAINT book_questions_correct_range_ck CHECK (
    correct_index >= 0 AND correct_index < array_length(choices, 1)
  )
);
