/**
 * Nhận diện kiểu ảnh bằng MAGIC BYTE, không tin gì client nói.
 *
 * Thuần, import tương đối — điều kiện để `node --test` chạy được (alias `@/` không
 * resolve dưới test runner của Node).
 *
 * Cả `file.type` lẫn đuôi tệp đều do client đặt, nên cả hai đều nói dối được. Giá trị
 * client gửi lên bị VỨT, không bao giờ vọng lại: kiểu lưu vào cột `media.mime` và kiểu
 * trả về ở header `Content-Type` đều là kiểu hàm này sniff ra.
 *
 * Đây là allowlist theo đúng bài học đã ghi trong CLAUDE.md: liệt kê CHÍNH XÁC cái được
 * coi là hợp lệ, rồi coi MỌI thứ khác là không hợp lệ — thay vì liệt kê những thứ bị cấm,
 * một danh sách không bao giờ đủ.
 *
 * SVG CỐ Ý KHÔNG có trong danh sách. Nó là XML: phục vụ cùng origin thì `<script>`,
 * `onload=`, `<foreignObject>` chạy thật — thành stored XSS nhắm vào cả admin lẫn học
 * sinh. Làm sạch SVG cho đúng cần DOMPurify + một DOM, tức hai dependency, để nhận một
 * định dạng không ai cần (ảnh tư liệu lịch sử đều là raster).
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** So `bytes` với `sig` bắt đầu từ `offset`. */
function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG = [0xff, 0xd8, 0xff] as const;
const GIF = [0x47, 0x49, 0x46, 0x38] as const; // "GIF8" — phủ cả 87a lẫn 89a
const RIFF = [0x52, 0x49, 0x46, 0x46] as const; // "RIFF" ở offset 0
const WEBP = [0x57, 0x45, 0x42, 0x50] as const; // "WEBP" ở offset 8

/** Trả về kiểu ảnh nhận ra được, hoặc `null` cho mọi thứ khác. */
export function sniffImage(bytes: Uint8Array): ImageMime | null {
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, GIF)) return "image/gif";
  // WebP cần CẢ HAI: "RIFF" ở đầu và "WEBP" ở offset 8. Chỉ kiểm "RIFF" thì file WAV,
  // AVI, hay bất cứ container RIFF nào cũng lọt qua.
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}
