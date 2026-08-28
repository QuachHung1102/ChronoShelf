/**
 * Chạy `db/schema/NN-*.sql` theo thứ tự tên file, mỗi file một transaction.
 *
 * Dùng `pg` chứ không gọi `psql`: psql không nằm trên PATH của máy này, đường dẫn
 * lại khác nhau giữa các máy, và ta đã có sẵn driver rồi.
 *
 * Nối bằng SUPERUSER (biến PGADMIN_URL) chứ không phải DATABASE_URL: `00-roles.sql`
 * tạo role, và bảng phải thuộc sở hữu của một role KHÁC chronoshelf_anon/auth thì RLS
 * mới áp lên chúng.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const SCHEMA_DIR = path.join(import.meta.dirname, "..", "db", "schema");

const url = process.env.PGADMIN_URL;
if (!url) {
  console.error(
    "Thiếu PGADMIN_URL — chuỗi kết nối quyền superuser.\n" +
      "Ví dụ: PGADMIN_URL=postgres://postgres:...@127.0.0.1:5432/chronoshelf npm run db:migrate",
  );
  process.exit(1);
}

const files = (await readdir(SCHEMA_DIR, { withFileTypes: true }))
  .filter((e) => e.isFile() && /^\d.*\.sql$/.test(e.name))
  .map((e) => e.name)
  .sort();

if (files.length === 0) {
  console.error(`Không có file .sql nào trong ${SCHEMA_DIR}`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
// Hiện RAISE NOTICE. Không có dòng này thì một file tự kiểm rỗng và một file tự kiểm
// đầy khẳng định trông y hệt nhau khi chạy — cả hai đều chỉ in một dấu ✓.
client.on("notice", (n) => console.log(`    · ${n.message}`));
await client.connect();

let failed = false;
for (const name of files) {
  const sql = await readFile(path.join(SCHEMA_DIR, name), "utf8");
  const started = Date.now();
  try {
    // Một transaction cho mỗi file: file hỏng thì roll back sạch, các file trước
    // đã commit vẫn giữ nguyên nên chạy lại chỉ tốn từ chỗ hỏng trở đi.
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`✓ ${name}  (${Date.now() - started}ms)`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`✗ ${name}\n  ${err.message}`);
    if (err.hint) console.error(`  hint: ${err.hint}`);
    if (err.where) console.error(`  where: ${err.where}`);
    failed = true;
    break;
  }
}

await client.end();
if (failed) process.exit(1);
console.log(`\n${files.length} file schema đã chạy xong.`);
