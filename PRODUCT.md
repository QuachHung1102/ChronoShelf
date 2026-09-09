# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Học sinh phổ thông Việt Nam, **tự học ở nhà** trên máy cá nhân — ngồi gần màn hình, một mình,
không có giáo viên đứng cạnh giải thích. Đó là bối cảnh dùng đã xác nhận, và nó cho phép
không gian tối, chi tiết tinh và chữ ở cỡ đọc gần; nó cũng có nghĩa màn hình phải tự giải
thích được, vì không ai ở đó để trả lời "bây giờ tôi làm gì".

Người dùng thứ hai là **admin** (giáo viên/tác giả nội dung), soạn kệ, sách, trang, vật phẩm
và bài trắc nghiệm ở `/quan-tri` lúc chạy — không qua build lại.

## Product Purpose

Học lịch sử bằng cách **khám phá và sưu tầm**, không phải bằng cách cuộn qua một trang chữ.
Người học mở một quyển sách, lật từng trang, làm bài trắc nghiệm cuối sách, rồi nhận một vật
phẩm — và chính vật phẩm đó mở khóa quyển tiếp theo. Thành công là học sinh muốn quay lại để
lấy nốt vật phẩm còn thiếu.

Sản phẩm là **đồ án dự thi** trước, triển khai sau. Có buổi chấm, nên ấn tượng ở 30 giây đầu
là tiêu chí thật chứ không phải phù phiếm — nhưng nó không được đánh đổi bằng độ đọc được.

## Positioning

Kiến thức **không bày sẵn — nó được mở khóa dần**, và thứ mở khóa là bằng chứng đã hiểu bài
(trả lời đúng hết bài trắc nghiệm cuối sách), không phải là đã lướt qua bài. Chuỗi mở khóa
không lưu ở đâu cả: quyển `i` mở bằng vật phẩm thưởng của quyển `i-1`, suy ra từ vị trí — nên
chuỗi không thể đứt.

## Operating Context

- Một phiên học là: chọn kệ → mở quyển đang mời gọi → lật hết trang → làm 2–3 câu trắc nghiệm
  → xem vật phẩm rơi ra → về kệ thấy quyển sau vừa mở khóa.
- Ngoài vòng đó: trang chủ (dòng thời gian "Ngày ấy – Bây giờ"), túi hành trang (tủ vật phẩm
  + tranh ghép), cộng đồng (bảng tin + chuỗi ngày học), thư viện bài giảng & slide.
- Admin làm việc trong cùng ứng dụng, ở `/quan-tri`.

## Capabilities and Constraints

- **CHỈ MÀN HÌNH PC. Ngưỡng thấp nhất phải chạy đúng là 1024×768.** Không breakpoint mobile —
  đã cân nhắc và loại. Báo cáo lỗi bố cục dưới ~1000px thì bỏ qua.
- Next.js 16 App Router + PostgreSQL 18 cục bộ + Sequelize. Tailwind CSS **3.4**, pin cứng;
  nâng v4 là task riêng.
- `DESIGN.md` là nguồn sinh `tailwind.theme.json` qua `designmd export`. Đổi token phải chạy
  `npm run design:build`, và `npm run design:lint` chặn mọi cặp màu dưới WCAG AA.
- Nội dung nằm trong database (`shelves`/`items`/`books`/`pages`/`book_questions`), admin sửa
  lúc chạy. Giao diện không được giả định số quyển, số kệ hay độ dài tên.
- Đáp án trắc nghiệm không bao giờ rời database; việc trao vật phẩm chỉ xảy ra ở server.
- Không gửi email. Đăng nhập bằng email + mật khẩu, khôi phục bằng câu hỏi bảo mật.
- Cổng duy nhất trước khi nói "xong": `npm run check`.

## Brand Commitments

**Không có ràng buộc nhận diện nào** — người dùng đã xác nhận tự do hoàn toàn với tên, ẩn dụ
và font khi thay thế giới thị giác. Hai thứ vẫn phải đúng vì chúng là *sự thật sản phẩm*, không
phải thẩm mỹ:

- Cơ chế phải đọc ra được: có thứ để **mở**, có thứ để **lật**, có thứ để **sưu tầm**, và có
  thứ đang **khóa**.
- Mọi font phải có đủ dấu tiếng Việt (khối `unicode-range` chứa `U+1EA0-1EF9`). Kalam không
  có khối này nên không dùng được — đã kiểm.

## Evidence on Hand

- Nội dung thật trong database: ba kệ (Việt Nam 5 quyển, Thế giới 4, Quanh cuộc sống 4), mỗi
  quyển 3–5 trang, vật phẩm và bài trắc nghiệm. Bootstrap ở `db/seed/*.json`.
- Ảnh do admin tải lên, lưu ở bảng `media`, phục vụ qua `/media/[id]`. Nhiều ảnh là CC BY-SA
  nên **điều kiện ghi công là bắt buộc hiển thị**, không phải tùy chọn.
- `pen.dev/design.pen` — mockup Pencil của thế giới thị giác CŨ. Sau lần thay này nó là tài
  liệu lịch sử, không phải nguồn sự thật. Chỉ mở bằng Pencil MCP.
- **Không có** testimonial, số liệu người dùng, giải thưởng hay đối tác nào. Đừng bịa.

## Product Principles

1. **Một màn hình, một hành động chính.** Học sinh tự học ở nhà phải biết ngay "bây giờ mở
   quyển nào" mà không cần ai chỉ.
2. **Phần thưởng phải nhìn thấy được.** Vật phẩm, tiến độ, thứ vừa mở khóa — nếu người học
   không thấy mình tiến lên, cơ chế sưu tầm không hoạt động.
3. **Nội dung do admin quyết lúc chạy.** Bố cục nào chỉ đúng với đúng 5 quyển là bố cục sai.
4. **Chữ trước hiệu ứng.** Đây là công cụ đọc; hiệu ứng nào làm chữ khó đọc hơn thì bỏ.
5. **Không mất thông tin khi tắt chuyển động.** Trạng thái cuối phải giống hệt nhau ở cả hai
   chế độ `prefers-reduced-motion`.

## Accessibility & Inclusion

- WCAG AA cho chữ thường (4.5:1) và 3:1 cho thành phần mang thông tin (WCAG 1.4.11), có cổng
  tự động canh: `npm run design:lint`.
- Màu không bao giờ là tín hiệu duy nhất (WCAG 1.4.1) — khoảng 1/12 học sinh nam mù màu đỏ-lục.
- Mọi thứ bấm được phải dùng được bằng bàn phím và phải lộ vòng focus.
- `prefers-reduced-motion: reduce` là ràng buộc bắt buộc, không phải phần thêm nếu còn thời gian.
