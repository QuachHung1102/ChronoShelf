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
 * Một cú THẢ GIỌT: mực chạm mặt nước và loang tròn ra từ tâm.
 *
 * "Phía trên" của chậu là trục **Oz** — vuông góc với màn hình — chứ không phải mép trên
 * của khung. Chậu được nhìn từ trên xuống, nên giọt rơi về phía người xem, chạm mặt nước
 * tại một điểm, rồi đẩy nước ra **mọi hướng quanh điểm đó**.
 *
 * Hai bản trước đều sai theo cùng một kiểu và người dùng gọi đúng tên: một cú đẩy theo MỘT
 * vector `(dx, dy)` làm mực bay lệch hẳn về một phía — "giống con mực bắn mực hơn". Thêm
 * trọng lực theo Oy chỉ đổi hướng bắn thành hướng xuống, vẫn là bắn.
 *
 * Trả về danh sách cú `splat` cần chạy theo thứ tự: một giọt mực ở tâm, rồi `SO_TIA` cú đẩy
 * CHỈ-VẬN-TỐC xếp đều trên một vòng tròn quanh tâm, mỗi cú hướng ra ngoài. Vorticity
 * confinement của bộ giải biến vòng loang đó thành vân hoa cúc — đó là suminagashi.
 */
export const SO_TIA = 8;

export interface CuSplat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  amount: number;
  radius?: number;
}

export function giotRoi(x: number, y: number, amount: number, luc = 150): CuSplat[] {
  // Vòng đẩy phải nằm NGOÀI lõi giọt, nếu không nó đẩy chính chỗ vừa đổ mực và triệt tiêu
  // nhau. 0.035 ≈ bán kính hình học của lõi (√0.0011 ≈ 0.033).
  const banKinh = 0.035;
  const cu: CuSplat[] = [{ x, y, dx: 0, dy: 0, amount }];
  for (let k = 0; k < SO_TIA; k++) {
    const goc = (k / SO_TIA) * Math.PI * 2;
    const cx = Math.cos(goc);
    const cy = Math.sin(goc);
    cu.push({
      x: x + banKinh * cx,
      y: y + banKinh * cy,
      dx: cx * luc,
      dy: cy * luc,
      amount: 0,
      radius: 0.004,
    });
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
  /**
   * Chỗ giọt TRƯỚC vừa rơi. Có thì giọt này tránh rơi lại sát đó (dưới `CACH_TOI_THIEU`):
   * hai giọt liền nhau cùng một chỗ chỉ dồn mực thành một cụm đậm trong khi phần còn lại
   * của chậu trống trơn — người dùng chê đúng "điểm rơi". Danh sách một phần tử thì không
   * tránh được, và cũng không nên tránh.
   */
  truoc?: ViTri | null,
): ViTri | null {
  if (danhSach.length === 0) return null;
  let tot: ViTri | null = null;
  for (let lan = 0; lan < 6; lan++) {
    const goc = danhSach[Math.floor(rand() * danhSach.length) % danhSach.length];
    tot = {
      x: clamp01(goc.x + (rand() * 2 - 1) * lech),
      y: clamp01(goc.y + (rand() * 2 - 1) * lech),
    };
    if (!truoc || Math.hypot(tot.x - truoc.x, tot.y - truoc.y) >= CACH_TOI_THIEU) break;
  }
  return tot;
}

/** Khoảng cách tối thiểu (toạ độ chậu) giữa hai giọt rơi liền nhau. */
export const CACH_TOI_THIEU = 0.12;

/**
 * Khoảng chờ (ms) tới giọt kế tiếp: quanh `trungBinh` giây, dao động ±45%.
 *
 * Nhịp ĐỀU là thứ mắt bắt được sau ba lần lặp, và một khi đã bắt được thì mặt nước đọc ra
 * là một cái máy bơm chứ không phải mưa mực.
 */
export function nhipNgauNhien(trungBinh: number, rand: () => number = Math.random): number {
  return trungBinh * 1000 * (0.55 + rand() * 0.9);
}
