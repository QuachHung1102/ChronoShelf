# Thiết kế: Kệ sách & Trải nghiệm đọc sách (cơ chế lõi)

> ## ⚠️ ĐÃ BỊ THAY THẾ (2026-08-28)
>
> Spec này mô tả cơ chế kệ-sách-đọc-sách theo mô hình nội dung JSON và một BaaS ngoài — **cả
> hai đều không còn đúng**. Nội dung nay nằm trong database; hạ tầng là PostgreSQL cục bộ.
>
> Giữ lại vì phần mô tả *cơ chế chơi* (đọc hết sách → nhận vật phẩm → mở khóa quyển sau) vẫn
> là gốc của sản phẩm. Đọc `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md`
> trước, rồi mới đọc file này để hiểu ý đồ ban đầu.


Ngày: 2026-08-12
Trạng thái: Đã duyệt (UX + BE), chuẩn bị vẽ Pencil

## 1. Bối cảnh & phạm vi

Dự án "Cửa Sổ Lịch Sử" (xem `content.md` ở gốc repo) có nhiều subsystem gần như độc lập:
design system nền tảng, kệ sách + đọc sách, trang chủ, túi hành trang, streak/cộng đồng,
learning hub, và BE tổng thể. Spec này chỉ phủ **subsystem đầu tiên**: kệ sách + trải
nghiệm đọc sách — cơ chế trung tâm (mục 4, content.md) mà mọi kệ khác tái dùng.

**Trong phạm vi đợt này:**
- Kệ "Lịch sử Việt Nam" (5 quyển) làm ví dụ nội dung cụ thể để vẽ trong Pencil.
- Trải nghiệm đọc 1 quyển: mở sách → lật trang → trang tổng kết → rơi vật phẩm → mở khóa
  quyển kế tiếp.
- Chỉ desktop.
- Nội dung text dùng lorem ipsum; ảnh minh họa dùng ảnh thật tìm được (không phải ảnh AI-gen
  cho bìa sách/vật phẩm ở bước vẽ này).
- Backend: schema + 1 hàm phía máy chủ cho cơ chế mở khóa.

**Ngoài phạm vi (để sau, mỗi phần sẽ có spec riêng):**
- Câu hỏi trắc nghiệm cuối sách (mục 4.3, content.md ghi là "tùy chọn nâng cao").
- Trang chủ, túi hành trang, streak/cộng đồng, learning hub.
- Mobile/responsive + phiên bản vuốt trang trên điện thoại.
- 2 kệ sách còn lại (Thế giới, quanh cuộc sống) — dùng lại component nhưng re-skin bìa sách.

## 2. UX — Luồng & màn hình

### Màn hình A — Kệ sách "Lịch sử Việt Nam"
- Header cố định: logo trái, nav phải, icon Streak (placeholder số), icon túi hành trang
  (placeholder số) — logic thật của các icon này thuộc subsystem khác.
- Kệ gỗ nâu đất, 5 bìa sách xếp hàng ngang:
  1. Khởi nguồn bờ cõi (Hùng Vương)
  2. Trận chiến Bạch Đằng 938
  3. Hào khí Đông A (nhà Trần)
  4. Đại phá quân Thanh (vua Quang Trung)
  5. Sử thi Điện Biên Phủ (1954)
- Mỗi bìa ở 1 trong 3 trạng thái thị giác:
  - **Đã khóa**: bìa tối màu, icon ổ khóa + dây xích chặn ngang, không click được; hover hiện
    tooltip "Cần [tên vật phẩm] để mở".
  - **Đã mở khóa — chưa đọc**: bìa sáng, viền cam pulse-glow nhẹ; hover sách nhô lên khỏi kệ
    + phát sáng cam.
  - **Đã đọc xong**: dấu triện/đánh dấu hoàn thành ở góc bìa; click lại vẫn đọc được.
- Quyển 1 luôn ở trạng thái mở sẵn (điểm bắt đầu).

### Màn hình B — Đọc sách (Book Reader)
- Click bìa đã mở khóa → sách phóng to giữa màn hình, mở bìa bằng chuyển động 3D-flip.
- Nội dung chia trang giấy da kiểu sách mở (2 trang đối xứng trái/phải).
- Điều hướng: click mép trang, kéo góc trang, hoặc phím mũi tên.
- Progress ribbon cố định: "Trang x/12".
- Góc trên: nút thoát (X), nút tắt âm thanh sột soạt khi lật trang.
- Thoát giữa chừng → lần sau quay lại đúng trang đang đọc (dùng `current_page` đã lưu).

### Màn hình C — Trang cuối: tổng kết + rơi vật phẩm
- Trang tổng kết: 3-5 ý chính của bài học.
- Animation: vật phẩm rơi ra giữa trang, xoay chậm trong glow cam, text
  "Bạn nhận được: [tên vật phẩm]" → bay vào icon túi hành trang trên header.
- Quay lại kệ sách: quyển kế tiếp (nếu có) chạy animation ổ khóa mở + dây xích rơi + bìa
  sáng dần lên.
- Nếu quay lại một quyển **đã hoàn thành trước đó** (đọc lại): bỏ qua toàn bộ animation rơi
  vật phẩm/mở khóa, vào thẳng trang tổng kết tĩnh.

### Component list (đặt tên để vẽ trong Pencil, tái dùng khi code)
`Header`, `ShelfHeader`, `BookShelf`, `BookCover` (3 biến thể trạng thái), `LockTooltip`,
`BookReaderModal`, `PageSpread`, `ProgressRibbon`, `ItemDropOverlay`, `UnlockNextBookOverlay`.

## 3. Backend

### 3.1 Bảng dữ liệu

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `profiles` | `user_id` (FK → auth user), `display_name`, `streak_count`, `last_active_date` | Mở rộng 1-1 cho bảng user auth |
| `shelves` | `id`, `slug`, `name`, `order` | Public read |
| `books` | `id`, `shelf_id`, `title`, `cover_image_url`, `position`, `required_item_id` (null = luôn mở), `reward_item_id` | Public read |
| `pages` | `id`, `book_id`, `page_number`, `content`, `image_url` | Public read |
| `items` | `id`, `name`, `image_url`, `description` | Public read |
| `user_book_progress` | `id`, `user_id`, `book_id`, `current_page`, `completed`, `completed_at` | `unique(user_id, book_id)`; RLS: user chỉ đọc/ghi row của chính mình |
| `user_items` | `id`, `user_id`, `item_id`, `obtained_at` | `unique(user_id, item_id)` chống trùng vật phẩm |

### 3.2 Storage buckets
`book-covers`, `page-images`, `item-images` — public read.

### 3.3 Function `complete-book` (server-side)

Input: `{ bookId }`. User xác định qua JWT của request (không nhận `userId` từ client).

1. Nếu `user_book_progress.completed` của (user, book) đã `true` → trả kết quả hiện có,
   **không** phát vật phẩm lại (idempotent — chống double-click, chống replay request).
2. Ngược lại: xác nhận đã lật tới trang cuối (so `current_page` với tổng số trang của
   book) → nếu hợp lệ, insert `user_items` (nếu `reward_item_id` khác null và chưa sở hữu)
   và update `user_book_progress.completed = true, completed_at = now()`.
3. Tính quyển kế tiếp trong cùng `shelf` (theo `position`) đã mở khóa chưa, dựa trên
   `required_item_id` của nó so với `user_items` vừa cập nhật.
4. Trả về `{ grantedItem, alreadyCompleted, nextBookUnlocked }`.

Đây là nơi duy nhất ghi `user_items`/`completed` — client không tự ý set các cột này,
đúng yêu cầu "logic mở khóa đặt ở phía máy chủ" (mục 8, content.md).

### 3.4 Data flow

- **Đọc** kệ/sách/trang: client query thẳng xuống database, RLS cho phép public read trên
  `shelves`/`books`/`pages`/`items`.
- **Lật trang**: client tự update `user_book_progress.current_page` trực tiếp qua SDK —
  không qua function, vì đây không phải điểm cần chống gian lận (chỉ ảnh hưởng UX "đọc tiếp
  từ đâu", không tạo ra vật phẩm/mở khóa).
- **Lật hết trang cuối**: client gọi function `complete-book` → dùng response quyết định
  có chạy animation rơi vật phẩm/mở khóa hay không (`alreadyCompleted=true` → bỏ qua
  animation, vào thẳng trang tổng kết tĩnh).

### 3.5 Lỗi & edge case

- Gọi `complete-book` lỗi mạng: giữ nguyên `current_page` ở trang cuối, hiện toast "Thử
  lại". An toàn để gọi lại vì function idempotent (bước 1 ở trên).
- Double-click nút hoàn thành / gọi function 2 lần liên tiếp: chặn ở DB bằng
  `unique(user_id, item_id)` trên `user_items`, cộng với check `completed` ở bước 1 của
  function.
- Đọc lại quyển đã hoàn thành: không tạo `user_items` mới, không replay animation.

## 4. Bước tiếp theo

Vẽ các màn hình A/B/C và component list ở mục 2 vào `pen.dev/design.pen` bằng Pencil MCP,
dùng lorem ipsum cho text và ảnh thật tìm được cho minh họa/bìa sách.
