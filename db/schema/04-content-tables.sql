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
