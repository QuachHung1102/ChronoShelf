# Kế hoạch triển khai: Bảng tin cộng đồng

Nguồn: `content.md` §6 và
`docs/superpowers/specs/2026-09-01-bang-tin-cong-dong-design.md`.

## Task 1 — Seam kiểm thử đầu vào

1. Viết test đỏ cho chuẩn hóa loại bài, trim nội dung và hai giới hạn ký tự.
2. Thêm module thuần tối thiểu để test xanh.

## Task 2 — Schema và hàng rào

1. Thêm `13-community.sql`: bảng, index, RLS, policy và GRANT.
2. Mở rộng `90-verify.sql`, `db-check.mjs` và `db-mutation-check.mjs` cho trạng thái quyền
   chính xác, đối chứng INSERT hợp lệ và trigger tạo bài gọi `record_activity()`.
3. Cập nhật `db/schema/README.md`.

## Task 3 — Đường đọc/ghi

1. Khai báo hai Sequelize model và quan hệ cần dùng.
2. Thêm đường đọc 30 bài + 200 bình luận và tính bí danh/danh hiệu.
3. Thêm hai Server Action, xác thực ở đầu vào, validate `FormData`, truyền transaction
   xuống mọi truy vấn và revalidate `/cong-dong`.

## Task 4 — Giao diện

1. Thêm `/cong-dong`, form bài đăng và form bình luận dùng component form hiện có.
2. Thêm lối vào header; giữ focus ring, pending state, `aria-live` và reset khi thành công.
3. Đo giao diện thật ở 1024×768 và kiểm tra bàn phím.

## Task 5 — Cổng và bàn giao

1. Chạy test tập trung trong từng vòng đỏ → xanh.
2. Chạy migrate, `db:check`, `db:mutation`, `npm run check`.
3. Review diff theo Standards + Spec, sửa phát hiện thật, rồi commit riêng subsystem.
