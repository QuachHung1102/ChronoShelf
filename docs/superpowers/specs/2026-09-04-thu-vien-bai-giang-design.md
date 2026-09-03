# Thư viện bài giảng & slide — thiết kế

Nguồn: `content.md` §7. Đây là mục thứ 5 trong sitemap và là subsystem lớn cuối cùng
chưa có route nào.

## 1. Phạm vi

`content.md` §7 đòi bốn thứ:

| Yêu cầu | Cách làm |
|---|---|
| Phân loại lớp 10 / 11 / 12 | Cột `lessons.grade`, ràng buộc `CHECK (grade IN (10,11,12))` |
| `.pptx` xem trước + tải về | Bảng `documents` giữ byte; ảnh xem trước do admin tải lên |
| Sơ đồ tư duy | Ảnh tĩnh do admin tải lên (`mindmap_url` + credit) |
| Liên kết chéo | `lessons.book_slug` → gợi ý ngay trên màn "đọc xong" |

**Xem trước là ẢNH TĨNH, không phải trình chiếu nhúng.** Nhúng Office Online đòi file có
URL công khai mà máy chủ Microsoft với tới được; byte của ta nằm trong Postgres sau một
route của chính ứng dụng, nên đường đó chỉ đi được nếu mở kho tài liệu ra Internet. Dựng
trình đọc `.pptx` phía client là một thư viện lớn cộng một bộ render OOXML — nhiều mã hơn
toàn bộ subsystem này. Admin tự chụp một ảnh slide đầu; đó cũng là thứ học sinh thật sự
cần để quyết định có tải hay không.

## 2. Vì sao một bảng `documents` RIÊNG, không nới `media`

`media` có hai hàng rào mà `90-verify.sql` so khớp **chính xác**: allowlist bốn kiểu ảnh
raster (SVG cố ý vắng mặt — nó là XML và sẽ thành stored XSS) và trần 2 MiB. Một bộ slide
vượt cả hai. Nới allowlist đó là mở lại đúng lỗ SVG cho một lý do không liên quan.

Bảng riêng giữ được cả hai hàng rào nguyên vẹn và cho `documents` một bộ luật của chính
nó: đúng một kiểu MIME, trần 25 MiB.

Giống `media`, `documents` **địa chỉ hóa theo nội dung** (khóa chính là sha256 của byte).
Ba lỗ bốc hơi theo: không path traversal (tên file client không bao giờ chạm đường dẫn),
không ghi đè lẫn nhau, không trùng lặp.

Và giống `media`, policy đọc là `USING (true)`: ai đoán đúng sha256 thì tải được, kể cả
khi bài giảng chưa xuất bản. Đây là **đánh đổi cố ý và phải nhớ** — đừng bao giờ để thứ
riêng tư vào bảng này.

## 3. Nhận diện `.pptx` — nói đúng phạm vi

`sniffPptx()` chỉ khẳng định **"đây là một gói ZIP"** (magic `PK\x03\x04`), không khẳng
định "đây là bản trình chiếu PowerPoint hợp lệ".

Không đi xa hơn vì hai lẽ:

1. **Không kiểm chứng được ở đây.** Máy dựng không có PowerPoint và không tải nổi một file
   `.pptx` thật để đối chứng (đã thử ba nguồn, đều 404). Viết một phép kiểm chặt hơn dựa
   trên suy đoán về bố cục file rồi không chạy thử được với file thật là cách chắc chắn để
   chặn đúng tệp của người dùng — hỏng theo hướng tệ nhất.
2. **Không cần cho bảo mật.** Chỉ admin tải lên được, và route phục vụ trả
   `Content-Disposition: attachment` kèm `X-Content-Type-Options: nosniff`, nên file không
   bao giờ chạy trong ngữ cảnh trang. Khác hẳn ảnh: ảnh hiện `inline`, nên ở đó phép sniff
   là hàng rào thật.

**Đường siết chặt khi có file thật để đối chứng:** OOXML bắt `[Content_Types].xml` là part
đầu tiên của gói, nên tên nó nằm nguyên văn ở offset 30 của local file header đầu tiên.
Thêm phép so đó — kèm một test dùng file `.pptx` thật commit vào repo — là bước kế tiếp.

## 4. Bảng `lessons`

```
slug            text PK, dạng slug
grade           smallint NOT NULL CHECK (grade IN (10,11,12))
title           text NOT NULL, <= 200
summary         text NOT NULL DEFAULT '', <= 500
book_slug       text NULL REFERENCES books(slug) ON DELETE SET NULL
slide_sha256    text NULL REFERENCES documents(sha256) ON DELETE RESTRICT
slide_filename  text NULL
preview_url/preview_source/preview_credit    -- ảnh xem trước slide
mindmap_url/mindmap_source/mindmap_credit    -- sơ đồ tư duy
published       boolean NOT NULL DEFAULT false
created_at      timestamptz
```

**Không có cột `position`.** Thứ tự hiển thị là `grade, title`. Sắp tay đòi cột `position`,
ràng buộc UNIQUE `DEFERRABLE INITIALLY DEFERRED` và một RPC đổi thứ tự như
`08-reorder.sql` — cả bộ đó tồn tại cho kệ sách vì **chuỗi mở khóa** phụ thuộc thứ tự.
Bài giảng không có chuỗi nào. Thêm khi có người thật sự cần xếp tay.

Hai ràng buộc credit (`lessons_preview_credit_ck`, `lessons_mindmap_credit_ck`) theo đúng
khuôn `10-image-credit.sql`: có ảnh thì bắt buộc có cả nguồn lẫn dòng ghi công. Điều kiện
BY của CC BY-SA có hiệu lực ở đây y như ở trang sách.

`slide_sha256` dùng `ON DELETE RESTRICT` chứ không `SET NULL`: `documents` là bảng
chỉ-ghi-thêm, không role nào xóa được dòng, nên nhánh này không bao giờ chạy — để
`RESTRICT` cho nó nói đúng ý đồ.

## 5. Hàng rào

Cùng khuôn với `shelves`/`books`: RLS bật, đọc thấy bài đã xuất bản (admin thấy cả nháp),
ghi chỉ admin qua `public.is_admin()`.

`documents`: `GRANT SELECT` cho anon + auth, **chỉ `INSERT`** cho auth (không UPDATE,
không DELETE) — cùng lý do như `media`: bảng chỉ-ghi-thêm là thứ khiến
`Cache-Control: immutable` đúng theo cấu tạo.

## 6. Route

| Đường | Vai trò |
|---|---|
| `/bai-giang` | Công khai. Ba nhóm lớp 10/11/12, mỗi bài một thẻ |
| `/quan-tri/bai-giang` | Admin: tạo, sửa, xuất bản, xóa |
| `/tai-lieu/[id]` | Tải `.pptx` về, `Content-Disposition: attachment` |
| `/api/quan-tri/tai-lieu` | Admin tải `.pptx` lên |

`bai-giang` và `tai-lieu` phải vào `RESERVED_SLUGS`: đoạn tĩnh thắng đoạn động trong App
Router, nên một kệ mang slug đó sẽ bị route tĩnh che mất. Cùng lượt này bổ sung luôn
`cong-dong` và `media` — hai cái đã thiếu từ trước.

## 7. Liên kết chéo

`readShelf()` gắn sẵn danh sách bài giảng đã xuất bản của từng quyển vào `ContentBook`.
Màn "đọc xong" (`ItemDropOverlay`) đã nhận `shelf`, nên chỉ cần thêm một liên kết — không
thêm request nào, và liên kết chỉ hiện khi thật sự có bài giảng để tới.
