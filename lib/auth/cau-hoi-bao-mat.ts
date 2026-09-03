/**
 * Danh sách câu hỏi bảo mật CỐ ĐỊNH.
 *
 * Cố định chứ không cho tự viết, theo yêu cầu — và đó cũng là lựa chọn đúng: câu hỏi
 * người dùng tự viết hay ra kiểu "mật khẩu của tôi là gì" hoặc một câu mà chính họ
 * quên mất cách diễn đạt sáu tháng sau.
 *
 * **Đây là hàng rào YẾU và ta biết điều đó.** NIST SP 800-63B khuyến nghị bỏ hẳn xác
 * thực dựa trên kiến thức: đáp án đoán được, tra được, và với học sinh thì bạn cùng lớp
 * thường biết sẵn. Ba thứ bù lại, tất cả nằm ở tầng database:
 *
 *  - Giới hạn 5 lần thử rồi khóa 15 phút (`app.ket_thuc_khoi_phuc`).
 *  - Đáp án chỉ lưu dạng băm scrypt, không bao giờ lưu thô.
 *  - Trang khôi phục LUÔN trả về một câu hỏi, kể cả với email không tồn tại, nên nó
 *    không thành máy dò xem ai đã có tài khoản.
 *
 * `ma` là thứ đi vào database và **bị ràng buộc CHECK trong
 * `db/schema/15-mat-khau.sql` cưỡng chế**. Hai danh sách phải khớp nhau; có một test
 * đọc thẳng file SQL để bắt lệch — xem `cau-hoi-bao-mat.test.ts`.
 */

export interface CauHoiBaoMat {
  ma: string;
  hoi: string;
}

export const CAU_HOI_BAO_MAT: readonly CauHoiBaoMat[] = [
  { ma: "truong-tieu-hoc", hoi: "Tên trường tiểu học đầu tiên của bạn là gì?" },
  { ma: "ban-than-lop-mot", hoi: "Hồi lớp 1, bạn thân nhất của bạn tên gì?" },
  { ma: "ten-thu-cung", hoi: "Con vật nuôi đầu tiên của bạn tên gì?" },
  { ma: "giao-vien-lop-mot", hoi: "Giáo viên chủ nhiệm lớp 1 của bạn tên gì?" },
  { ma: "mon-an-ghet", hoi: "Món ăn bạn ghét nhất là món gì?" },
  { ma: "bai-hat-thuoc-dau", hoi: "Bài hát đầu tiên bạn thuộc lời là bài nào?" },
] as const;

const THEO_MA = new Map(CAU_HOI_BAO_MAT.map((c) => [c.ma, c]));

/** Trả về câu hỏi, hoặc `null` nếu mã không nằm trong danh sách. */
export function timCauHoi(ma: unknown): CauHoiBaoMat | null {
  return typeof ma === "string" ? (THEO_MA.get(ma) ?? null) : null;
}

/** Mã có hợp lệ không — dùng ở đầu vào của server action / route. */
export function laMaCauHoi(ma: unknown): ma is string {
  return timCauHoi(ma) !== null;
}

/** Độ dài tối đa của đáp án, khớp ràng buộc `users_security_answer_ck`. */
export const DAP_AN_TOI_DA = 200;
