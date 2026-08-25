/**
 * Lọc tham số `?next=` của trang đăng nhập xuống còn đường dẫn nội bộ.
 *
 * `//evil.com` là URL tuyệt đối theo giao thức hiện tại, nên riêng `startsWith("/")`
 * không chặn được chuyển hướng ra ngoài. Đây là ranh giới tin cậy: giá trị đến thẳng
 * từ thanh địa chỉ, và kẻ tấn công chỉ cần dụ người dùng bấm một link để đẩy họ sang
 * trang đăng nhập giả sau khi đăng nhập thật.
 */
export function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}
