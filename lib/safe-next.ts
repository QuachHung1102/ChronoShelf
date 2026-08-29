/**
 * Lọc tham số `?next=` của trang đăng nhập xuống còn đường dẫn nội bộ.
 *
 * Đây là ranh giới tin cậy: giá trị đến thẳng từ thanh địa chỉ, và kẻ tấn công chỉ cần
 * dụ người dùng bấm một link để đẩy họ sang trang đăng nhập giả sau khi đăng nhập thật.
 *
 * So tiền tố chuỗi KHÔNG đủ. Thuật toán phân tích URL của WHATWG coi `\` y hệt `/` với
 * scheme http/https, và còn XÓA HẲN tab (U+0009), LF (U+000A), CR (U+000D) trước khi
 * phân tích — nên `/\evil.com` lẫn `/<tab>/evil.com` đều phân giải thành `http://evil.com/`
 * dù cả hai đều bắt đầu bằng đúng một dấu `/`. Vì vậy phải chuẩn hóa bằng chính `new URL`
 * rồi so origin, thay vì đuổi theo từng ký tự lạ.
 *
 * Base `http://x.invalid` dùng `.invalid` — TLD IANA giữ chỗ, không ai đăng ký được — nên
 * nhánh "origin trùng base" luôn trả về một đường dẫn nội bộ, không bao giờ là host của kẻ
 * tấn công. Không có gì fetch tới base này.
 */
export function safeNext(value: string | string[] | undefined): string {
  // `typeof` chặn undefined và mảng (?next=a&next=b); `startsWith("/")` giữ nguyên hợp đồng
  // cũ là chỉ nhận đường dẫn tuyệt đối, để `evil.com` không thành `/evil.com`.
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  try {
    const u = new URL(value, "http://x.invalid");
    return u.origin === "http://x.invalid" ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}
