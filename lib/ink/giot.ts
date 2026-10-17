/**
 * Đặt giọt mực của bài học thứ `i` trong chậu.
 *
 * Tách khỏi component vì đúng lý do đã tách `resolveState` khỏi `shelf.ts`: file này chỉ
 * import module thuần cùng thư mục (`fluid.ts`), nên `node --test` chạy thẳng được. Mọi module đi qua alias `@/` đều không
 * resolve dưới test runner của Node, mà ràng buộc ở đây thì cần một cổng tự động canh — nó
 * sai được trong IM LẶNG. Mực vẫn loang đẹp khi đặt sai chỗ; nó chỉ loang ra ngoài khung
 * hoặc chui hết xuống dưới tấm giấy, và không có gì báo.
 */

import { clamp01 } from "./fluid.ts";

/** Góc vàng — 137.5°, tính bằng radian. */
export const GOC_VANG = 2.399963229728653;

export interface ViTri {
  x: number;
  y: number;
}

/**
 * Toạ độ canvas 0..1 (gốc dưới-trái) cho giọt thứ `i`.
 *
 * `boRatio` là phần bề ngang canvas bị BỜ che — tấm giấy mang chữ. Phải truyền vào chứ không
 * đoán: bờ rộng `max(516px, 56%)` nên tỉ lệ của nó đổi theo khung nhìn (0.65 ở 1024px, 0.56
 * ở 1440px).
 *
 * Bản trước neo cứng tâm ở 0.78 với bán kính `0.13·√i` tính trên bề ngang TOÀN canvas. Ở
 * 1440px vùng nước chỉ chạy từ 0.56 tới 1.0, tức bán kính tối đa 0.22, trong khi công thức
 * cho 0.31 ở bài thứ sáu — mực tràn khỏi mép phải, bị cắt, và dồn thành một mảng ở góc.
 *
 * Ba tính chất phải giữ:
 *   1. **Tất định** — cùng đầu vào cho cùng vị trí, để chậu không nhảy giữa hai lần mở.
 *   2. **Nằm trong vùng nước** — không giọt nào tràn ra ngoài canvas hay chui hết xuống bờ.
 *   3. **Mật độ đều** — bán kính theo căn bậc hai, nếu không thì giọt dồn ra rìa.
 */
export function viTriGiot(i: number, boRatio: number, tong: number): ViTri {
  const goc = i * GOC_VANG;
  const bo = Math.min(Math.max(boRatio, 0), 0.88);
  const tam = (bo + 1) / 2;
  const rongNuoc = Math.max(0.12, 1 - bo);
  // Chừa 16% bề rộng vùng nước làm lề, để vân còn chỗ nở ra mà không chạm bờ chậu.
  const rMax = (rongNuoc / 2) * 0.84;
  const f = Math.sqrt((i + 0.6) / Math.max(tong, 4));
  return {
    x: tam + rMax * f * Math.cos(goc),
    // Trục dọc rộng rãi hơn trục ngang: vùng nước cao hơn là rộng, nên ép giọt vào một hình
    // tròn theo trục hẹp sẽ bỏ trống hai phần ba chiều cao chậu.
    y: 0.5 + 0.33 * f * Math.sin(goc),
  };
}

/**
 * Một cú THẢ GIỌT theo đúng thao tác suminagashi: bút mực chạm mặt nước, rồi bút nước trong
 * chạm ĐÚNG chỗ đó, lặp lại `soVong` lần. Mỗi lần chạm đẩy mọi vân cũ ra ngoài (xem shader
 * `DROP` ở `fluid.ts`), nên chuỗi này để lại những VÒNG MỰC ĐỒNG TÂM mảnh, xen nước trong.
 *
 * Giọt rơi theo trục Oz — vuông góc với màn hình — nên mọi vòng chung một tâm và không có
 * hướng ưu tiên nào. Ba bản trước đều thất bại ở đúng chỗ này: bản đẩy một vector làm mực
 * "bắn như con mực", bản tám tia vận tốc thì bị bước áp suất của bộ giải nuốt mất và chỉ còn
 * một vết khói.
 *
 * Vòng mực xen kẽ ĐẬM–NHẠT: vân thật không đều màu, và hai tông xen nhau là thứ làm mắt đọc
 * ra "vân" thay vì "bia bắn".
 *
 * Bán kính tính theo CHIỀU CAO chậu, nên giọt tròn trên mọi tỉ lệ khung.
 */
export interface CuGiot {
  x: number;
  y: number;
  r: number;
  amount: number;
}

export function giotRoi(
  x: number,
  y: number,
  amount: number,
  soVong = 4,
  rMuc = 0.024,
  rNuoc = 0.04,
  /**
   * Tay nghệ nhân không chạm đúng một điểm hai lần. `rand` cho mỗi lần chạm lệch tâm một
   * chút và đổi bán kính ±25% — chính độ lệch đó biến "bia bắn" thành vân. Để mặc định
   * (không truyền) thì tất định, cho test.
   */
  rand?: () => number,
): CuGiot[] {
  const lech = (k: number) => (rand ? (rand() * 2 - 1) * k : 0);
  const cu: CuGiot[] = [];
  for (let k = 0; k < soVong; k++) {
    const dx = lech(0.006);
    const dy = lech(0.006);
    cu.push({ x: x + dx, y: y + dy, r: rMuc * (1 + lech(0.25)), amount: k % 2 === 0 ? amount : amount * 0.55 });
    cu.push({ x: x + dx + lech(0.004), y: y + dy + lech(0.004), r: rNuoc * (1 + lech(0.25)), amount: 0 });
  }
  return cu;
}

/**
 * Chọn NGẪU NHIÊN một giọt để thả tiếp, lệch nhẹ khỏi chỗ cũ.
 *
 * Bản trước thả LẠI CẢ BỘ giọt cùng một lúc, đúng chỗ cũ, đúng mỗi 9 giây — nên mặt nước
 * đập theo một nhịp máy móc và mỗi chu kỳ vẽ lại y hệt chu kỳ trước. Ở đây mỗi lần chỉ một
 * giọt, chọn ngẫu nhiên trong danh sách, rơi lệch đi một chút so với lần trước.
 *
 * VÌ SAO KHÔNG random cả toạ độ: ở màn kệ sách, danh sách truyền vào là những quyển ĐÃ ĐỌC
 * XONG và vị trí mỗi giọt là chỗ của chính quyển đó trong chậu (rê chuột lên một dòng bài
 * học thì đúng giọt ấy loang ra). Random hoàn toàn sẽ cắt đứt liên kết đó và biến chậu thành
 * hình nền. Chọn ngẫu nhiên TRONG danh sách thì tổng lượng mực vẫn tỉ lệ với số bài đã học.
 *
 * `rand` truyền vào được để test kiểm bất biến: giọt sau khi lệch vẫn phải nằm trong chậu.
 */
export function chonGiot(
  danhSach: readonly ViTri[],
  rand: () => number = Math.random,
  lech = 0.07,
): ViTri | null {
  if (danhSach.length === 0) return null;
  const goc = danhSach[Math.floor(rand() * danhSach.length) % danhSach.length];
  return {
    x: clamp01(goc.x + (rand() * 2 - 1) * lech),
    y: clamp01(goc.y + (rand() * 2 - 1) * lech),
  };
}

/**
 * Khoảng chờ (ms) tới giọt kế tiếp: quanh `trungBinh` giây, dao động ±45%.
 *
 * Nhịp ĐỀU là thứ mắt bắt được sau ba lần lặp, và một khi đã bắt được thì mặt nước đọc ra
 * là một cái máy bơm chứ không phải mưa mực.
 */
export function nhipNgauNhien(trungBinh: number, rand: () => number = Math.random): number {
  return trungBinh * 1000 * (0.55 + rand() * 0.9);
}
