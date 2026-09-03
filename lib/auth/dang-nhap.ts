import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { bamMoi, bamTheoThamSo, chuanHoaDapAn } from "./mat-khau";

/**
 * Đăng nhập bằng email + mật khẩu, khôi phục bằng câu hỏi bảo mật.
 *
 * Toàn bộ LUẬT nằm ở tầng database (`db/schema/15-mat-khau.sql`): đếm lần thử, khóa 15
 * phút, allowlist câu hỏi, và việc bản băm không bao giờ rời khỏi Postgres. File này chỉ
 * làm đúng một việc mà SQL không làm được — chạy scrypt.
 *
 * HAI ĐIỀU BẮT BUỘC GIỮ, cả hai đều là bài học đã trả giá:
 *
 *  1. **`throw` phải nằm NGOÀI `withRole()`.** Các hàm SQL trả `NULL` cho mọi nhánh hỏng
 *     chứ không ném, vì một exception sẽ hủy cả transaction và cuốn theo chính câu UPDATE
 *     bộ đếm — giới hạn 5 lần thử thành vô nghĩa. Ném từ trong callback thì Sequelize
 *     rollback và mở lại đúng cái lỗ đó. Lý do đầy đủ ở `db/schema/02-users.sql`.
 *
 *  2. **Hai lượt gọi là HAI transaction riêng, không phải một.** scrypt tốn ~59 ms; gói cả
 *     hai vào một transaction là giữ một connection database mở suốt quãng đó mà không
 *     làm gì. Tách ra không mất an toàn: bước 1 chỉ trả về salt (thứ không bí mật), còn
 *     bộ đếm nằm ở bước 2 — nên mọi lần THỬ THẬT đều bị tính, kể cả khi kẻ tấn công bỏ
 *     ngang giữa chừng.
 */

/** Mọi nhánh hỏng của đăng nhập/khôi phục dùng chung một lỗi — xem `SAI` ở dưới. */
export const SAI = "SAI_THONG_TIN";
export const EMAIL_DA_CO = "EMAIL_DA_CO";

const goi = <T extends object>(sql: string, bind: unknown[]): Promise<T[]> =>
  withRole(null, (t) =>
    sequelize.query<T>(sql, { bind, transaction: t, type: QueryTypes.SELECT }),
  );

/** Tạo tài khoản. Ném `EMAIL_DA_CO` khi email đã có người dùng, hoặc email sai định dạng. */
export async function dangKy(
  email: string,
  matKhau: string,
  maCauHoi: string,
  dapAn: string,
): Promise<string> {
  const mk = await bamMoi(matKhau);
  const da = await bamMoi(chuanHoaDapAn(dapAn));

  const rows = await goi<{ dang_ky: string | null }>(
    "SELECT app.dang_ky($1, $2, $3, $4, $5, $6) AS dang_ky",
    [email, mk.thamSo, mk.bam, maCauHoi, da.thamSo, da.bam],
  );

  const id = rows[0]?.dang_ky;
  if (!id) throw new Error(EMAIL_DA_CO);
  return id;
}

/** Đổi email + mật khẩu lấy user id. Ném `SAI` cho MỌI nhánh hỏng. */
export async function dangNhap(email: string, matKhau: string): Promise<string> {
  const thamSo = (
    await goi<{ bat_dau_dang_nhap: string | null }>(
      "SELECT app.bat_dau_dang_nhap($1) AS bat_dau_dang_nhap",
      [email],
    )
  )[0]?.bat_dau_dang_nhap;

  // NULL = đang bị khóa. Dừng ở đây, không tốn một lượt scrypt cho kẻ đang dò.
  if (!thamSo) throw new Error(SAI);

  const bam = await bamTheoThamSo(matKhau, thamSo);
  if (!bam) throw new Error(SAI);

  const rows = await goi<{ ket_thuc_dang_nhap: string | null }>(
    "SELECT app.ket_thuc_dang_nhap($1, $2) AS ket_thuc_dang_nhap",
    [email, bam],
  );

  // Tới đây `withRole()` đã COMMIT: bộ đếm lần thử an toàn, giờ mới được ném.
  const id = rows[0]?.ket_thuc_dang_nhap;
  if (!id) throw new Error(SAI);
  return id;
}

/**
 * Câu hỏi bảo mật của một email. LUÔN trả về một mã câu hỏi, kể cả email không tồn tại —
 * nếu không thì trang "quên mật khẩu" thành máy dò xem ai đã có tài khoản.
 */
export async function layCauHoi(email: string): Promise<string> {
  const rows = await goi<{ cau_hoi_khoi_phuc: string }>(
    "SELECT app.cau_hoi_khoi_phuc($1) AS cau_hoi_khoi_phuc",
    [email],
  );
  return rows[0].cau_hoi_khoi_phuc;
}

/** Đặt lại mật khẩu bằng đáp án câu hỏi bảo mật. Ném `SAI` cho MỌI nhánh hỏng. */
export async function khoiPhuc(
  email: string,
  dapAn: string,
  matKhauMoi: string,
): Promise<string> {
  const thamSo = (
    await goi<{ bat_dau_khoi_phuc: string | null }>(
      "SELECT app.bat_dau_khoi_phuc($1) AS bat_dau_khoi_phuc",
      [email],
    )
  )[0]?.bat_dau_khoi_phuc;

  if (!thamSo) throw new Error(SAI);

  const bamDapAn = await bamTheoThamSo(chuanHoaDapAn(dapAn), thamSo);
  if (!bamDapAn) throw new Error(SAI);

  const mkMoi = await bamMoi(matKhauMoi);

  const rows = await goi<{ ket_thuc_khoi_phuc: string | null }>(
    "SELECT app.ket_thuc_khoi_phuc($1, $2, $3, $4) AS ket_thuc_khoi_phuc",
    [email, bamDapAn, mkMoi.thamSo, mkMoi.bam],
  );

  const id = rows[0]?.ket_thuc_khoi_phuc;
  if (!id) throw new Error(SAI);
  return id;
}
