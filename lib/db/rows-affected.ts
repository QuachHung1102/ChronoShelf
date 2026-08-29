/**
 * Số dòng mà một lệnh UPDATE/DELETE thực sự đụng tới.
 *
 * `sequelize.query(sql, { bind, transaction })` — không truyền `type` — chạy nhánh
 * `QueryTypes.RAW`, và nhánh đó của dialect postgres trả về `[rows, queryResult]`.
 * Phần tử thứ hai là ĐỐI TƯỢNG `pg.Result`, không phải số dòng. Đoạn code trước ép
 * kiểu `as [unknown, number]` rồi so `affected === 0`: TypeScript im lặng, còn lúc
 * chạy phép so đó luôn false, nên mọi phép kiểm "UPDATE trúng 0 dòng" trong khu quản
 * trị đều chết — RLS chặn mà giao diện vẫn báo "Đã lưu."
 *
 * Nhận CẢ HAI hình dạng chứ không chỉ hình dạng đang thấy hôm nay:
 * hợp đồng của `sequelize.query` khai kiểu trả về là `[unknown[], unknown]`, mỗi
 * dialect tự quyết phần tử thứ hai (mysql2 trả thẳng một con số ở nhánh này), và giá
 * trị đó đã đổi giữa các bản Sequelize. Một hàm đọc được cả hai thì lần nâng cấp sau
 * không âm thầm biến hàng rào thành vô hiệu lần nữa.
 *
 * Không nhận dạng được thì trả 0 — tức là "coi như không đụng dòng nào", để lời gọi
 * báo lỗi. Fail đóng: một hàng rào hỏng phải kêu, không được im.
 */
export function rowsAffected(result: unknown): number {
  if (!Array.isArray(result)) return 0;

  const meta: unknown = result[1];
  if (typeof meta === "number") return meta;

  // `pg.Result.rowCount` là `number | null` — null với những lệnh không đếm dòng.
  const count = (meta as { rowCount?: unknown } | null | undefined)?.rowCount;
  return typeof count === "number" ? count : 0;
}
