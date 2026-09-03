/**
 * Đếm chuỗi ngày học liên tục (content.md §6).
 *
 * Tách riêng ra một module THUẦN, import tương đối, cùng lý do như `lib/api/unlock.ts`:
 * alias `@/` không resolve dưới `node --test` của Node, mà quy tắc đếm chuỗi thì đầy
 * trường hợp biên (đổi tháng, năm nhuận, hôm nay chưa học) — quá nhiều để chỉ dựa vào
 * việc bấm thử trên giao diện.
 *
 * VÌ SAO KHÔNG VIẾT BẰNG SQL: số dòng luôn nhỏ (một dòng mỗi ngày hoạt động của một
 * người), nên kéo cả mảng ngày về rồi đếm ở JS vừa rẻ vừa test được. Một hàm cửa sổ
 * trong Postgres thì không có cách nào kiểm bằng `npm test`.
 */

/** Một ngày dạng `YYYY-MM-DD`, đúng thứ Postgres trả về cho kiểu `date`. */
export type Ngay = string;

/** Ngày hiện tại theo cùng múi giờ mà `record_activity()` dùng trong PostgreSQL. */
export function homNayVietNam(now = new Date()): Ngay {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

const MOT_NGAY = 86_400_000;

/** `YYYY-MM-DD` -> mốc thời gian UTC giữa trưa. */
function moc(ngay: Ngay): number {
  const [y, m, d] = ngay.split("-").map(Number);
  // Dùng 12:00 UTC chứ không phải 00:00: giữa trưa thì lệch múi giờ ±14 giờ vẫn không
  // đẩy sang ngày khác, nên phép trừ hai mốc luôn ra đúng số ngày.
  return Date.UTC(y, m - 1, d, 12);
}

/**
 * Số ngày liên tục tính LÙI từ `homNay`.
 *
 * Chuỗi vẫn còn sống nếu ngày hoạt động gần nhất là hôm nay HOẶC hôm qua — người học
 * chưa mở máy hôm nay thì chuỗi chưa đứt, nó chỉ đứt khi đã qua trọn một ngày trống.
 * Đó là quy ước mà mọi ứng dụng streak dùng, và nếu không có nó thì chuỗi của mọi người
 * đều về 0 vào lúc 0 giờ mỗi đêm.
 *
 * @param cacNgay danh sách ngày hoạt động, KHÔNG cần sắp xếp trước và trùng lặp cũng được
 * @param homNay ngày hôm nay theo múi giờ người dùng, dạng `YYYY-MM-DD`
 */
export function tinhStreak(cacNgay: Ngay[], homNay: Ngay): number {
  const rieng = [...new Set(cacNgay)].sort().reverse();
  if (rieng.length === 0) return 0;

  const mocHomNay = moc(homNay);
  const cachHomNay = Math.round((mocHomNay - moc(rieng[0])) / MOT_NGAY);

  // Ngày trong TƯƠNG LAI (đồng hồ máy khách chạy sai, hoặc dữ liệu hỏng) không được tính
  // thành chuỗi — cũng không được làm hàm nổ.
  if (cachHomNay < 0) return 0;
  // Đã trống trọn một ngày: chuỗi đứt.
  if (cachHomNay > 1) return 0;

  let dem = 1;
  for (let i = 1; i < rieng.length; i++) {
    if (Math.round((moc(rieng[i - 1]) - moc(rieng[i])) / MOT_NGAY) !== 1) break;
    dem++;
  }
  return dem;
}

/** Chuỗi ngày liên tiếp dài nhất từng đạt, dùng để mở danh hiệu vĩnh viễn. */
export function tinhStreakDaiNhat(cacNgay: Ngay[]): number {
  const rieng = [...new Set(cacNgay)].sort();
  let daiNhat = 0;
  let hienTai = 0;

  for (let i = 0; i < rieng.length; i++) {
    hienTai =
      i > 0 && Math.round((moc(rieng[i]) - moc(rieng[i - 1])) / MOT_NGAY) === 1
        ? hienTai + 1
        : 1;
    daiNhat = Math.max(daiNhat, hienTai);
  }

  return daiNhat;
}

export type DanhHieuStreak = "Sử gia tập sự" | "Nhà thông thái" | "Học giả uyên bác" | null;

/**
 * Danh hiệu vĩnh viễn theo mốc chuỗi dài nhất đã đạt.
 *
 * `content.md` §6 kể ba danh hiệu nhưng chỉ cho hai mốc — "7 ngày, 30 ngày…". Mốc thứ ba
 * là **100 ngày**, chọn từ hai con số đo được chứ không bốc:
 *
 *  - Tỉ lệ 7 → 30 là ×4,29; giữ đúng tỉ lệ đó thì mốc kế là 129 ngày.
 *  - Năm học phổ thông (5/9 → 31/5) dài 268 ngày. 100 ngày là 37% năm học — đạt được
 *    thật, còn 365 ngày thì dài hơn cả năm học nên không học sinh nào với tới.
 *
 * 100 lệch 23% so với mốc hình học lý tưởng, đổi lại là một con số tròn mà học sinh nhớ
 * được. Đó là đánh đổi có ý thức, không phải nhầm lẫn.
 */
export function danhHieuTuStreakDaiNhat(streakDaiNhat: number): DanhHieuStreak {
  if (streakDaiNhat >= 100) return "Học giả uyên bác";
  if (streakDaiNhat >= 30) return "Nhà thông thái";
  if (streakDaiNhat >= 7) return "Sử gia tập sự";
  return null;
}
