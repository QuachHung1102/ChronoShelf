import { Sequelize } from "sequelize";

/**
 * Một instance Sequelize duy nhất cho cả tiến trình.
 *
 * Cache trên `globalThis` KHÔNG phải thói quen chép từ chỗ khác: `next dev` nạp lại
 * module mỗi lần sửa file, nên một `new Sequelize(...)` ở top-level sẽ đẻ thêm một
 * connection pool sau mỗi lần lưu. Sau vài chục lần sửa là Postgres từ chối kết nối
 * mới (`too many clients already`) và lỗi hiện ra ở một chỗ chẳng liên quan gì.
 *
 * `serverExternalPackages: ["sequelize"]` trong `next.config.ts` là điều kiện bắt
 * buộc để file này chạy được: Sequelize nạp dialect bằng `require()` động mà bundler
 * không lần ra. `pg` thì Next đã tự loại sẵn.
 */

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Thiếu DATABASE_URL. Sao chép .env.example thành .env.local rồi điền chuỗi kết nối " +
      "PostgreSQL (role chronoshelf_app, KHÔNG phải postgres).",
  );
}

const globalForDb = globalThis as unknown as { __chronoshelfDb?: Sequelize };

export const sequelize =
  globalForDb.__chronoshelfDb ??
  new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { max: 10, idle: 10_000 },
    // Giờ giấc luôn đi lại dưới dạng UTC. Không có dòng này, `timestamptz` đọc lên sẽ
    // mang múi giờ của MÁY CHỦ, nên cùng một dòng dữ liệu hiện khác nhau giữa máy dev
    // ở Việt Nam và máy chạy thật ở nơi khác.
    timezone: "+00:00",
  });

if (process.env.NODE_ENV !== "production") globalForDb.__chronoshelfDb = sequelize;
