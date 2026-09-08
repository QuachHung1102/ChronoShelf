/**
 * Hình học của bức tranh ghép (content.md §4.4).
 *
 * Mỗi vật phẩm của một kệ là MỘT MẢNH của bức tranh toàn cảnh; sưu tầm đủ thì tranh liền
 * lại. Mảnh được cắt theo **dải dọc**, không theo lưới ô vuông, và đó là lựa chọn có lý
 * do: lưới đòi một cặp (hàng, cột) tích đúng bằng số vật phẩm, mà số đó do admin quyết
 * lúc chạy — kệ 5 quyển thì không có lưới nào vừa, và mọi cách chữa đều đẻ ra ô thừa.
 * Dải dọc chia đều cho MỌI số mảnh, và "toàn cảnh" vốn nghĩa là một bức rộng.
 *
 * Kỹ thuật: mỗi mảnh là một ô nền cùng ảnh, phóng ngang `tong` lần rồi trượt ngang.
 * Chiều dọc để `auto` — **không** ép thành `100%`. Cả dải ghép lại là 865×132 ở 1024px,
 * tức tỉ lệ 6.55:1; ép một tấm ảnh 4:3 vào đó là kéo ngang **4,91 lần**, mặt người và
 * hiện vật đều thành vệt bẹt. Không có chỗ nào trong sản phẩm bảo admin phải nạp ảnh
 * panorama 6,6:1, nên tấm đầu tiên họ tải lên sẽ là một tấm ảnh thường. Với `auto` thì
 * ảnh giữ đúng tỉ lệ và bị cắt bớt trên/dưới — mất một phần khung hình đổi lấy hình
 * không méo, và đó là đánh đổi đúng.
 * `background-position` theo phần trăm là phép nội suy CSS — 0% dán mép trái ảnh vào mép
 * trái ô, 100% dán mép phải vào mép phải — nên mẫu số là `tong - 1`, KHÔNG phải `tong`.
 *
 * File thuần, import tương đối, không chạm `@/` — điều kiện để `node --test` chạy được
 * (xem mục Test ở CLAUDE.md).
 */

export interface KieuManhGhep {
  backgroundSize: string;
  backgroundPosition: string;
}

/** Bỏ đuôi số lẻ vô nghĩa: 1/3 ra "33.333%" chứ không phải 17 chữ số sau dấu phẩy. */
function phanTram(v: number): string {
  return `${Math.round(v * 1000) / 1000}%`;
}

/**
 * @param chiSo  vị trí mảnh, đánh số từ 0, theo THỨ TỰ ĐỌC của kệ. Ngoài khoảng thì kẹp.
 * @param tong   số mảnh của cả bức. `0` và `1` đều cho ra nguyên bức tranh.
 */
export function manhGhep(chiSo: number, tong: number): KieuManhGhep {
  // Một mảnh (hoặc không mảnh nào) thì mảnh đó CHÍNH LÀ bức tranh — và phép chia dưới
  // kia sẽ là chia cho 0. Trả sớm ở đây, không vá bằng `|| 0` sau khi đã chia.
  if (tong <= 1) return { backgroundSize: "100% auto", backgroundPosition: "0% 50%" };

  const i = Math.min(Math.max(Math.trunc(chiSo), 0), tong - 1);
  return {
    backgroundSize: `${tong * 100}% auto`,
    backgroundPosition: `${phanTram((i / (tong - 1)) * 100)} 50%`,
  };
}
