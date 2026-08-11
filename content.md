# BẢN MÔ TẢ CHI TIẾT DỰ ÁN: WEBSITE "CỬA SỔ LỊCH SỬ" (V4)

## 1. TỔNG QUAN DỰ ÁN

* **Tên dự án:** Cửa Sổ Lịch Sử (The History Window)
* **Mục tiêu:** Nền tảng học tập và chia sẻ kiến thức lịch sử trực quan, sống động dành cho học sinh và người yêu thích lịch sử.
* **Ý tưởng cốt lõi:** Người dùng khám phá một **thư viện cổ**. Mỗi chuyên mục là một kệ sách, mỗi bài học là một quyển sách được mở ra và lật từng trang như sách thật.
* **Điểm khác biệt:** Kiến thức không được bày sẵn — nó được **mở khóa dần**. Đọc hết một quyển sách, người dùng nhận được một vật phẩm (chìa khóa, ấn tín, la bàn…) rơi ra từ trang sách, và đó chính là thứ mở được quyển tiếp theo trên kệ. Việc học trở thành một hành trình sưu tầm.

---

## 2. QUY CHUẨN PHONG CÁCH & MÀU SẮC CHỦ ĐẠO

| Vai trò | Màu | Ứng dụng |
| --- | --- | --- |
| **Primary** | Nâu đất / nâu gỗ cổ | Kệ sách, thanh điều hướng, khung viền, tiêu đề chính, bìa sách |
| **Accent** | Cam lửa / cam đất | Nút hành động, hiệu ứng phát sáng khi hover, ngọn lửa Streak, ánh sáng khi vật phẩm rơi ra |
| **Secondary** | Trắng kem / trắng giấy da | Nền trang sách, nội dung bài viết, khối so sánh "Ngày ấy – Bây giờ" |

Tinh thần chung: cổ kính, hoài niệm, nhưng chuyển động mượt và có điểm nhấn năng động.

---

## 3. SƠ ĐỒ TRANG (SITEMAP)

Website gồm **5 mục chính** trên thanh điều hướng:

1. **Trang chủ** — Hành trình tiến hóa và cuộc sống của loài người qua các thời kỳ.
2. **Lịch sử Việt Nam** — Kệ sách 3–5 quyển về lịch sử nước nhà.
3. **Lịch sử Thế giới** — Kệ sách 3–5 quyển về các nền văn minh và sự kiện quốc tế.
4. **Lịch sử quanh cuộc sống** — Kệ sách 3–5 quyển về nguồn gốc những đồ vật gần gũi.
5. **Bài giảng & Slide** — Kho tài nguyên bài học (PowerPoint, sơ đồ tư duy).

**Header** cố định ở mọi trang: bên trái là logo "CỬA SỔ LỊCH SỬ", bên phải là menu điều hướng, biểu tượng **ngọn lửa Streak**, và **túi hành trang** hiển thị số vật phẩm đang sở hữu.

---

## 4. CƠ CHẾ CỐT LÕI: QUYỂN SÁCH & CHUỖI MỞ KHÓA

Đây là tính năng trung tâm của toàn bộ sản phẩm, áp dụng đồng nhất cho cả 3 chuyên mục kệ sách.

### 4.1. Trạng thái của một quyển sách

Mỗi quyển sách trên kệ luôn ở một trong ba trạng thái, phân biệt rõ bằng thị giác:

* **Đã khóa:** Bìa sách tối màu, có ổ khóa/dây xích chặn ngang, không click được. Hover chỉ hiện gợi ý: *"Cần [tên vật phẩm] để mở"*.
* **Đã mở khóa – chưa đọc:** Bìa sáng rõ, viền cam nhấp nháy nhẹ để mời gọi. Hover thì sách nhô lên khỏi kệ và phát sáng cam.
* **Đã đọc xong:** Bìa hiện dấu triện/đánh dấu hoàn thành ở góc. Có thể mở đọc lại bất cứ lúc nào.

Quyển đầu tiên của mỗi kệ luôn ở trạng thái mở sẵn để người dùng có điểm bắt đầu.

### 4.2. Trải nghiệm đọc — hiệu ứng lật sách

Khi click vào một quyển đã mở khóa:

1. Sách được rút ra khỏi kệ, phóng to vào giữa màn hình và **mở bìa ra** bằng chuyển động 3D.
2. Nội dung bài học được chia thành **các trang giấy da**, không cuộn dọc dài lê thê. Người dùng lật trang bằng cách click mép trang, kéo góc trang, dùng phím mũi tên hoặc vuốt trên điện thoại.
3. Mỗi lần lật là một chuyển động cong của tờ giấy kèm đổ bóng và âm thanh sột soạt nhẹ (có nút tắt tiếng).
4. Bố cục trang xen kẽ chữ và hình minh họa, bản đồ, mốc thời gian — mỗi trang là một ý trọn vẹn, dễ nhớ.
5. Có thanh chỉ báo tiến độ dạng dải ruy băng đánh dấu trang: *"Trang 4 / 12"*. Người dùng thoát ra giữa chừng thì lần sau quay lại đúng trang đang đọc.

### 4.3. Vật phẩm rơi ra & mở khóa quyển tiếp theo

Khi người dùng lật đến **trang cuối cùng** của quyển sách:

1. Trang cuối là **trang tổng kết**: tóm tắt 3–5 ý chính của bài học.
2. Một hoạt cảnh ngắn diễn ra: vật phẩm **rơi ra từ giữa các trang sách**, xoay chậm trong luồng ánh sáng cam, kèm dòng chữ *"Bạn nhận được: Ấn tín Đông A"*.
3. Vật phẩm được cất vào **Túi hành trang** của người dùng.
4. Quay lại kệ sách, quyển tiếp theo có hoạt cảnh **ổ khóa bật mở**, dây xích rơi xuống, bìa sách sáng dần lên — báo hiệu chặng tiếp theo đã sẵn sàng.

**Tùy chọn nâng cao:** trước khi thả vật phẩm, hiển thị 2–3 câu hỏi trắc nghiệm ngắn về nội dung vừa đọc. Trả lời đúng mới nhận được vật phẩm. Cơ chế này biến việc mở khóa thành phần thưởng cho việc *hiểu bài*, không chỉ *lướt qua bài*.

### 4.4. Bộ vật phẩm theo từng kệ sách

Mỗi chuyên mục có một bộ vật phẩm riêng, gắn với nội dung bài học vừa đọc:

* **Lịch sử Việt Nam:** Trống đồng → Cọc gỗ Bạch Đằng → Ấn tín Đông A → Áo bào Quang Trung → Lá cờ Quyết Chiến Quyết Thắng.
* **Lịch sử Thế giới:** Chìa khóa đồng Ai Cập → Đồng xu La Mã → La bàn hàng hải → Bánh răng máy hơi nước.
* **Lịch sử quanh cuộc sống:** Mỗi quyển thả ra một mảnh ghép; sưu tầm đủ sẽ ghép thành một bức tranh toàn cảnh của chuyên mục.

### 4.5. Túi hành trang (Inventory)

* Trang riêng trưng bày toàn bộ vật phẩm đã sưu tầm, dạng tủ kính bảo tàng.
* Ô trống hiện bóng mờ của vật phẩm chưa có — tạo động lực hoàn thành bộ sưu tập.
* Click vào từng vật phẩm để xem mô tả lịch sử ngắn và liên kết về bài học đã sinh ra nó.
* Sưu tầm trọn một bộ sẽ mở khóa danh hiệu và một nội dung thưởng (bài viết mở rộng hoặc bộ slide đặc biệt).

---

## 5. MÔ TẢ CHI TIẾT TỪNG TRANG

### 5.1. Trang chủ — Hành trình tiến hóa của loài người

* Bố cục **dòng thời gian cuộn dọc**, dẫn người dùng đi qua các cột mốc lớn (năm 500 → năm 1500 → thế kỷ 21).
* Mỗi chủ đề là một khối so sánh trực quan **"Ngày ấy – Bây giờ"**, hai hình ảnh đối lập đặt cạnh nhau kèm giải thích ngắn gọn.
* Nội dung (3–5 khối):
  * **Ẩm thực:** Săn bắt hái lượm, ăn đồ tươi sống/nướng thô sơ ⟷ thức ăn nhanh và công nghệ nấu nướng hiện đại.
  * **Trang phục:** Da thú, vải thô tự dệt ⟷ thời trang và sợi tổng hợp thế kỷ 21.
  * **Nhà ở & định cư:** Hang đá, túp lều tranh ⟷ nhà chọc trời, căn hộ thông minh.
  * **Giao tiếp:** Viết trên lá cây, thẻ tre, thư bồ câu ⟷ tin nhắn tức thời qua smartphone.
* Khi cuộn tới, các khối so sánh trượt ra và hiện dần; hình "ngày xưa" và "ngày nay" có thể kéo thanh trượt giữa hai ảnh để so sánh trực tiếp.
* Cuối trang là ba lối vào ba kệ sách, kèm chỉ báo tiến độ: *"Bạn đã mở 2/5 quyển"*.

### 5.2. Lịch sử Việt Nam

* Kệ sách gỗ cổ kính tông nâu đất, 3–5 quyển đặt cạnh nhau, bìa thiết kế riêng cho từng bài.
* Nội dung mẫu:
  * *Quyển 1:* Khởi nguồn bờ cõi (Hùng Vương)
  * *Quyển 2:* Trận chiến Bạch Đằng 938
  * *Quyển 3:* Hào khí Đông A (nhà Trần)
  * *Quyển 4:* Đại phá quân Thanh (vua Quang Trung)
  * *Quyển 5:* Sử thi Điện Biên Phủ (1954)
* Thứ tự mở khóa đi theo dòng chảy thời gian — người học đi đúng mạch lịch sử.

### 5.3. Lịch sử Thế giới

* Cùng cấu trúc kệ sách, nhưng hoa văn và bìa sách mang phong cách phương Tây cổ đại để phân biệt.
* Nội dung mẫu:
  * *Quyển 1:* Bí ẩn các Kim tự tháp Ai Cập
  * *Quyển 2:* Sự hưng thịnh và suy tàn của đế chế La Mã
  * *Quyển 3:* Kỷ nguyên phát kiến địa lý (tìm ra châu Mỹ)
  * *Quyển 4:* Cuộc cách mạng công nghiệp thay đổi thế giới

### 5.4. Lịch sử quanh cuộc sống

* Cùng cấu trúc kệ sách, mỗi bìa sách được vẽ cách điệu lồng ghép hình ảnh đồ vật liên quan.
* Nội dung mẫu:
  * *Quyển 1 (đồng xu):* Lịch sử tiền tệ — từ vỏ sò đến tiền giấy
  * *Quyển 2 (quả bóng):* Hành trình quả bóng đá chinh phục thế giới
  * *Quyển 3 (áo dài):* Sự tiến hóa của trang phục qua các thời kỳ
  * *Quyển 4 (bóng đèn):* Lịch sử những phát minh thắp sáng nhân loại

---

## 6. HỆ THỐNG GIỮ CHUỖI (STREAK) & CỘNG ĐỒNG

* **Đếm chuỗi:** Biểu tượng ngọn lửa cam kèm số ngày liên tục, hiển thị trên header.
* **Nhiệm vụ giữ chuỗi mỗi ngày:** đọc xong ít nhất một trang sách, hoặc đăng một bài viết ngắn / một câu hỏi thảo luận lên bảng tin cộng đồng.
* **Bảng tin cộng đồng:** nơi người dùng đăng bài ngắn, đặt câu hỏi, bình luận và thảo luận về lịch sử.
* **Phần thưởng:** đạt mốc 7 ngày, 30 ngày… mở khóa danh hiệu *Sử gia tập sự*, *Nhà thông thái*, *Học giả uyên bác*. Có thể gắn thêm phần thưởng là vật phẩm hiếm cho túi hành trang.

---

## 7. THƯ VIỆN BÀI GIẢNG & SLIDE (LEARNING HUB)

* **Phân loại:** theo Lịch sử lớp 10, lớp 11, lớp 12.
* **Bài trình chiếu (.pptx):** thiết kế sẵn theo tông nâu–cam cổ điển, có xem trước trực tiếp trên web và tải về miễn phí để học sinh làm bài thuyết trình nhóm.
* **Sơ đồ tư duy:** tóm tắt từng chương bằng hình ảnh trực quan, dễ ôn tập.
* **Liên kết chéo:** đọc xong một quyển sách thì gợi ý ngay bộ slide và mindmap tương ứng của chương đó.

---

## 8. CÔNG NGHỆ ÁP DỤNG (TECH STACK)

* **Nền tảng:** **Next.js** cho toàn bộ ứng dụng — giao diện và API xử lý trong cùng một codebase. Trang nội dung tĩnh (bài học, kệ sách) được render sẵn để tải nhanh và thân thiện với tìm kiếm; phần tương tác (lật sách, mở khóa, túi hành trang) xử lý phía client.
* **Cơ sở dữ liệu:** **PostgreSQL**, lưu tài khoản người dùng, nội dung bài học và từng trang sách, tiến độ đọc, kho vật phẩm, chuỗi Streak, bài đăng và bình luận cộng đồng.
* **Xác thực:** đăng nhập bằng email hoặc tài khoản Google; toàn bộ tiến độ gắn với tài khoản để người dùng đọc tiếp trên bất kỳ thiết bị nào.
* **Lưu trữ tệp:** hình minh họa, bìa sách và tệp `.pptx` lưu trên dịch vụ lưu trữ đối tượng, phân phối qua CDN.
* **Logic mở khóa:** đặt ở phía máy chủ. Client chỉ gửi tín hiệu "đã đọc xong quyển X"; máy chủ kiểm tra điều kiện, ghi nhận vật phẩm và trả về trạng thái mới của kệ sách — tránh việc mở khóa bằng cách can thiệp từ trình duyệt.
* **Thiết bị:** thiết kế responsive, hiệu ứng lật sách có phiên bản vuốt tối giản trên điện thoại để giữ độ mượt.

---

## 9. MÔ HÌNH DỮ LIỆU RÚT GỌN

| Bảng | Nội dung chính |
| --- | --- |
| `User` | Tài khoản, ngày Streak hiện tại, ngày hoạt động gần nhất |
| `Shelf` | Kệ sách / chuyên mục, thứ tự hiển thị |
| `Book` | Quyển sách: tiêu đề, ảnh bìa, thuộc kệ nào, vị trí trên kệ, vật phẩm yêu cầu để mở, vật phẩm sẽ trao |
| `Page` | Từng trang của quyển sách: số thứ tự, nội dung, hình minh họa |
| `Item` | Vật phẩm: tên, hình ảnh, mô tả lịch sử ngắn |
| `UserBookProgress` | Người dùng đang đọc tới trang nào của quyển nào, đã hoàn thành chưa |
| `UserItem` | Vật phẩm người dùng đang sở hữu, thời điểm nhận |
| `Post` / `Comment` | Bài đăng và bình luận trên bảng tin cộng đồng |
| `Resource` | Slide, mindmap: khối lớp, chương, tệp đính kèm |

---

## 10. LỘ TRÌNH TRIỂN KHAI ĐỀ XUẤT

1. **Giai đoạn 1 — Nền tảng:** dựng khung Next.js, kết nối PostgreSQL, hoàn thiện trang chủ dòng thời gian và một kệ sách với nội dung tĩnh.
2. **Giai đoạn 2 — Trải nghiệm đọc:** hoàn thiện hiệu ứng lật sách, chia trang, lưu tiến độ đọc.
3. **Giai đoạn 3 — Chuỗi mở khóa:** vật phẩm, trạng thái khóa/mở, túi hành trang, câu hỏi kiểm tra cuối sách.
4. **Giai đoạn 4 — Tài khoản & cộng đồng:** đăng nhập, Streak, bảng tin, danh hiệu.
5. **Giai đoạn 5 — Learning Hub:** thư viện slide và mindmap, xem trước và tải về.