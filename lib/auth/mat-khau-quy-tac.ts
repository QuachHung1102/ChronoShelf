/**
 * Luật về mật khẩu — phần THUẦN, không chạm `node:crypto`.
 *
 * VÌ SAO TÁCH RA KHỎI `mat-khau.ts`: form đăng nhập cần đúng một con số (`8`) để đặt
 * `minLength` và viết câu nhắc. Nhưng `mat-khau.ts` mở đầu bằng `import crypto from
 * "node:crypto"`, nên chỉ cần một client component chạm vào nó là Turbopack phải
 * polyfill cả `node:crypto` xuống trình duyệt.
 *
 * Đã đo trên artifact `.next` thật ngày 2026-09-07: chunk đó nặng **445.499 byte** raw
 * (133 KB gzip), tức gấp 2,65 lần TOÀN BỘ client JS duy nhất của mọi route còn lại cộng
 * lại (167.844 byte) — chỉ để mang một hằng số. Và nó là mã chết trọn vẹn:
 * `grep -c scrypt` trên chunk trả về **0**, vì crypto-browserify không có `scrypt` —
 * đúng hàm duy nhất mà `mat-khau.ts` thật sự gọi. Sau khi tách: `/dang-nhap` từ
 * 491.543 → 46.044 byte raw (−90,6%), bằng đúng các route nhẹ khác.
 *
 * Đây là cùng một khuôn đã dùng cho `lib/api/unlock.ts` và `lib/safe-next.ts`: tách
 * phần thuần ra để nó qua được một ranh giới mà phần còn lại không qua được. Ở hai file
 * kia ranh giới là test runner của Node; ở đây là ranh giới server/client.
 *
 * ĐỪNG import bất cứ thứ gì từ `node:` vào file này.
 */

/** Độ dài tối thiểu của mật khẩu. */
export const MAT_KHAU_TOI_THIEU = 8;

/**
 * Trả về câu lỗi, hoặc `null` khi mật khẩu dùng được.
 *
 * CỐ Ý KHÔNG có luật "phải có chữ hoa, số và ký tự đặc biệt": NIST SP 800-63B khuyến
 * nghị bỏ hẳn những luật đó vì chúng đẩy người dùng tới `Matkhau@123` — dễ đoán hơn
 * hẳn một câu dài. Chỉ ràng buộc độ dài, và đếm theo KÝ TỰ chứ không theo byte.
 */
export function kiemMatKhau(mk: unknown): string | null {
  if (typeof mk !== "string") return "Thiếu mật khẩu.";
  const soKyTu = [...mk].length;
  if (soKyTu < MAT_KHAU_TOI_THIEU) {
    return `Mật khẩu phải có ít nhất ${MAT_KHAU_TOI_THIEU} ký tự.`;
  }
  if (soKyTu > 200) return "Mật khẩu quá dài (tối đa 200 ký tự).";
  return null;
}
