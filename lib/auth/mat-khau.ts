import crypto from "node:crypto";

/**
 * Băm mật khẩu và đáp án câu hỏi bảo mật.
 *
 * **`crypto.scrypt` của stdlib, KHÔNG phải pgcrypto và KHÔNG phải bcrypt.** Ba lý do:
 *
 *  1. Repo đã băm mã OTP ở Node từ trước (xem `db/schema/02-users.sql`), nên giữ một
 *     triết lý băm duy nhất trong cả codebase.
 *  2. `pgcrypto` là một extension phải bật ở MỌI nơi deploy; `scrypt` có sẵn trong Node.
 *  3. bcrypt CẮT CỤT mật khẩu ở 72 byte trong im lặng. Với mật khẩu tiếng Việt có dấu
 *     (mỗi ký tự 3 byte UTF-8) thì 72 byte chỉ là 24 ký tự — một cái bẫy không ai thấy
 *     cho tới khi ai đó đặt mật khẩu dài. scrypt không có giới hạn đó.
 *
 * THAM SỐ ĐO TRÊN MÁY THẬT (2026-09-04, Node 24):
 *
 * ```
 *   N= 16384  33,6 ms  ~16 MB
 *   N= 32768  58,9 ms  ~32 MB   ← chọn cái này
 *   N= 65536 123,7 ms  ~64 MB
 *   N=131072 241,1 ms ~128 MB
 * ```
 *
 * N=32768 đủ nhanh để đăng nhập không thấy độ trễ, đủ đắt để dò ngoại tuyến tốn kém,
 * và 32 MB cho mỗi lượt băm đồng thời vẫn vừa với một máy chủ nhỏ. N=65536 tốn 64 MB
 * mỗi lượt — mười người đăng nhập cùng lúc là 640 MB.
 *
 * **Tham số nằm TRONG từng dòng dữ liệu, không phải hằng trong mã.** Nhờ vậy nâng N
 * sau này không làm hỏng mật khẩu đã lưu: dòng cũ vẫn kiểm được bằng tham số cũ của
 * chính nó, dòng mới dùng tham số mới.
 */

const N = 32768;
const R = 8;
const P = 1;
const DAI = 64;
/** scrypt cần ~128·N·r byte; mặc định `maxmem` của Node là 32 MiB, vừa đúng sát trần. */
const MAXMEM = 256 * 1024 * 1024;

export interface ThamSo {
  N: number;
  r: number;
  p: number;
  dai: number;
  salt: Buffer;
}

/** `scrypt$N=32768,r=8,p=1,len=64$<salt base64url>` */
export function vietThamSo(t: ThamSo): string {
  return `scrypt$N=${t.N},r=${t.r},p=${t.p},len=${t.dai}$${t.salt.toString("base64url")}`;
}

/** Đọc chuỗi tham số. Trả `null` cho mọi thứ không đúng khuôn — KHÔNG ném. */
export function docThamSo(chuoi: unknown): ThamSo | null {
  if (typeof chuoi !== "string") return null;
  const m = /^scrypt\$N=(\d+),r=(\d+),p=(\d+),len=(\d+)\$([A-Za-z0-9_-]+)$/.exec(chuoi);
  if (!m) return null;

  const t = {
    N: Number(m[1]),
    r: Number(m[2]),
    p: Number(m[3]),
    dai: Number(m[4]),
    salt: Buffer.from(m[5], "base64url"),
  };

  // Chốt chặn trên: một chuỗi tham số méo (hoặc bị sửa) với N khổng lồ sẽ làm scrypt
  // ngốn hết RAM của máy chủ — biến ô đăng nhập thành nút tắt máy. N phải là lũy thừa
  // của 2 và không vượt quá thứ `MAXMEM` chịu được.
  const boNhoCan = 128 * t.N * t.r;
  if (
    !Number.isInteger(t.N) || t.N < 2 || (t.N & (t.N - 1)) !== 0 ||
    !Number.isInteger(t.r) || t.r < 1 ||
    !Number.isInteger(t.p) || t.p < 1 || t.p > 16 ||
    !Number.isInteger(t.dai) || t.dai < 16 || t.dai > 128 ||
    t.salt.length < 8 ||
    boNhoCan > MAXMEM
  ) {
    return null;
  }

  return t;
}

function scrypt(biMat: string, t: ThamSo): Promise<Buffer> {
  return new Promise((giai, tuChoi) => {
    // Chuẩn hóa NFC trước khi băm: cùng một mật khẩu tiếng Việt gõ bằng hai bộ gõ khác
    // nhau có thể ra hai chuỗi Unicode khác nhau (tổ hợp vs dựng sẵn) mà nhìn y hệt.
    // Không chuẩn hóa thì người dùng đổi bộ gõ là mất tài khoản.
    crypto.scrypt(
      biMat.normalize("NFC"),
      t.salt,
      t.dai,
      { N: t.N, r: t.r, p: t.p, maxmem: MAXMEM },
      (loi, ra) => (loi ? tuChoi(loi) : giai(ra)),
    );
  });
}

/** Băm một bí mật mới: sinh salt ngẫu nhiên, trả về cả tham số lẫn bản băm. */
export async function bamMoi(biMat: string): Promise<{ thamSo: string; bam: string }> {
  const t: ThamSo = { N, r: R, p: P, dai: DAI, salt: crypto.randomBytes(16) };
  return { thamSo: vietThamSo(t), bam: (await scrypt(biMat, t)).toString("base64url") };
}

/** Băm lại theo ĐÚNG tham số đã lưu, để so với bản băm cũ. `null` khi tham số méo. */
export async function bamTheoThamSo(biMat: string, thamSo: unknown): Promise<string | null> {
  const t = docThamSo(thamSo);
  if (!t) return null;
  return (await scrypt(biMat, t)).toString("base64url");
}

/**
 * Chuẩn hóa đáp án câu hỏi bảo mật trước khi băm.
 *
 * Bỏ dấu tiếng Việt, hạ chữ thường, gộp khoảng trắng. Người dùng gõ "Hà Nội", " ha noi"
 * hay "HÀ NỘI" sáu tháng sau đều phải khớp — đây là câu hỏi để KHÔI PHỤC tài khoản,
 * bắt gõ chính xác từng dấu là cách chắc chắn nhất để khóa người dùng ra ngoài.
 *
 * Đánh đổi đã biết: bỏ dấu làm giảm entropy của đáp án. Đáp án câu hỏi bảo mật vốn đã
 * ít entropy, nên hàng rào thật ở đây là GIỚI HẠN SỐ LẦN THỬ trong
 * `app.ket_thuc_khoi_phuc`, không phải độ khó đoán của đáp án.
 */
export function chuanHoaDapAn(raw: string): string {
  return raw
    .normalize("NFD")
    // Dải dấu tổ hợp Unicode, viết bằng escape chứ không bằng ký tự thật: dấu thanh
    // đứng một mình trong mã nguồn là thứ không nhìn thấy và không sửa lại được.
    .replace(/[\u0300-\u036f]/g, "")
    // `đ` KHÔNG tách được bằng NFD nên phải thay riêng — cùng bẫy đã ghi ở `slugify`.
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// `MAT_KHAU_TOI_THIEU` và `kiemMatKhau` nay ở `mat-khau-quy-tac.ts`.
//
// File NÀY mở đầu bằng `import crypto from "node:crypto"`, nên bất cứ thứ gì một client
// component cần PHẢI nằm ngoài nó — chỉ một `import` từ trình duyệt là Turbopack kéo cả
// 445 KB polyfill `node:crypto` xuống. Số đo đầy đủ ở đầu `mat-khau-quy-tac.ts`.
//
// Đừng "gom lại cho gọn" bằng một dòng `export * from "./mat-khau-quy-tac"`: chính dòng
// đó nối hai file lại và kéo polyfill về đúng như cũ.
