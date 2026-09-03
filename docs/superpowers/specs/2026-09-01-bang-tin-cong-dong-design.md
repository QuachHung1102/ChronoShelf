# Thiết kế: Bảng tin cộng đồng

Ngày: 2026-09-01

Trạng thái: Chốt theo ủy quyền tự chọn hướng triển khai

## 1. Mục tiêu và phạm vi

Hoàn tất nửa còn lại của `content.md` §6 bằng một bảng tin nơi mọi người đọc được các
chia sẻ lịch sử, còn người đã đăng nhập có thể:

- đăng một bài chia sẻ hoặc câu hỏi;
- bình luận dưới bài;
- giữ chuỗi ngày học khi đăng bài hoặc câu hỏi thành công.

Trang mới là `/cong-dong`, có lối vào trên header. Bản đầu chỉ dùng văn bản thuần; React
escape nội dung lúc render. Không có Markdown/HTML, ảnh, lượt thích, sửa/xóa, báo cáo hay
kiểm duyệt — thêm khi sản phẩm thật sự cần những luồng đó.

## 2. Luồng và giao diện

- Người chưa đăng nhập đọc được bảng tin và thấy lời mời đăng nhập.
- Người đã đăng nhập thấy form chọn `Chia sẻ` / `Câu hỏi`, nội dung tối đa 1.000 ký tự.
- Mỗi bài hiện loại bài, bí danh ổn định `Bạn đọc #XXXX`, thời gian và các bình luận.
- Bình luận tối đa 500 ký tự; gửi thành công thì form xóa nội dung và bài hiện bình luận mới.
- Không lộ email hay UUID. Bí danh lấy từ bốn ký tự đầu của SHA-256(UUID), đủ phân biệt
  trong một cuộc thảo luận mà không cần mở thêm subsystem hồ sơ cá nhân.
- Giao diện dùng thẻ nội dung phẳng trên nền `neutral`/`surface`, không thêm token hay
  đổ bóng. Mọi ô nhập dùng `FIELD`, mọi điều khiển có vòng focus, trạng thái gửi và vùng
  `aria-live`. Phạm vi màn hình giữ đúng chuẩn dự án: từ 1024×768.

## 3. Dữ liệu và quyền

Hai bảng mới:

| Bảng | Cột chính |
|---|---|
| `community_posts` | `id`, `author_id`, `kind`, `body`, `created_at` |
| `community_comments` | `id`, `post_id`, `author_id`, `body`, `created_at` |

Ràng buộc:

- `kind` chỉ nhận `chia-se` hoặc `cau-hoi`;
- `body` phải khác rỗng sau khi trim và không vượt giới hạn tương ứng;
- xóa tài khoản xóa bài/bình luận của tài khoản; xóa bài xóa bình luận của bài;
- `chronoshelf_anon` và `chronoshelf_auth` chỉ đọc được mọi bài/bình luận;
- chỉ `chronoshelf_auth` được INSERT và policy bắt `author_id = app.current_user_id()`;
- không role ứng dụng nào được UPDATE/DELETE.

Server Action luôn lấy `author_id` từ cookie phiên, không nhận từ form. Trigger của thao tác
INSERT bài gọi `record_activity()` ngay trong transaction đó: hoặc cả bài lẫn ngày hoạt động
cùng được ghi, hoặc không cái nào được ghi. Bình luận không giữ streak vì `content.md` chỉ
nêu đăng bài/câu hỏi.

## 4. Đọc dữ liệu và giới hạn cố ý

Trang đọc 30 bài mới nhất và tối đa 200 bình luận mới nhất của nhóm bài đó bằng hai truy
vấn tuần tự trong một transaction. Đây là trần cố ý cho bản đầu; thêm cursor pagination
khi bảng tin thật sự vượt quá một màn hình hoạt động thường xuyên.

Danh hiệu dùng lịch sử `user_activity` đã có, không thêm bảng mới:

- chuỗi dài nhất từ 7 ngày mở `Sử gia tập sự`;
- chuỗi dài nhất từ 30 ngày mở `Nhà thông thái`.

`Học giả uyên bác` chưa có mốc trong `content.md`, nên chưa tự bịa một con số. Thêm khi
sản phẩm chốt mốc.

## 5. Nghiệm thu

1. Anon đọc được bài/bình luận nhưng không INSERT được bằng role database hoặc Server Action.
2. Người A đăng bài chỉ dưới danh tính A; không thể truyền UUID của B để mạo danh.
3. Bài rỗng/quá 1.000 ký tự và bình luận rỗng/quá 500 ký tự bị chặn ở cả action lẫn DB.
4. Đăng bài ghi đúng một dòng `user_activity` cho ngày Việt Nam; đăng trùng trong ngày không
   tạo thêm dòng; bình luận không tạo hoạt động.
5. Sau khi gửi, nội dung mới xuất hiện, form xóa và trình đọc màn hình nhận thông báo.
6. `npm run check`, `npm run db:check`, `npm run db:mutation` đều xanh; trình duyệt thật ở
   1024×768 không tràn ngang và dùng được bằng bàn phím.
