/**
 * Kiểm thử đột biến cho `db/schema/90-verify.sql`.
 *
 * Một file tự kiểm luôn xanh và một file tự kiểm đã mục ruỗng trông giống hệt nhau.
 * Dự án này đã bị chính chuyện đó cắn hai lần (xem CLAUDE.md, "Bẫy đã gặp"), nên
 * hàng rào cần một hàng rào: script này lần lượt PHÁ từng thứ mà 90-verify.sql tuyên
 * bố là mình canh, chạy lại nó, và đòi nó phải NỔ đúng chỗ. Đột biến nào lọt qua
 * nghĩa là khẳng định tương ứng đã vô nghĩa.
 *
 * Chạy bằng superuser: `PGADMIN_URL=... node scripts/db-mutation-check.mjs`
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const VERIFY = path.join(import.meta.dirname, "..", "db", "schema", "90-verify.sql");

const url = process.env.PGADMIN_URL;
if (!url) {
  console.error("Thiếu PGADMIN_URL — chuỗi kết nối quyền superuser.");
  process.exit(1);
}

/** [tên, SQL phá, SQL trả lại, chuỗi bắt buộc có trong thông điệp lỗi] */
const MUTATIONS = [
  [
    "chronoshelf_app được INHERIT",
    "ALTER ROLE chronoshelf_app INHERIT",
    "ALTER ROLE chronoshelf_app NOINHERIT",
    "đang INHERIT",
  ],
  [
    "người chưa đăng nhập đọc được user_roles",
    "GRANT SELECT ON public.user_roles TO chronoshelf_anon",
    "REVOKE SELECT ON public.user_roles FROM chronoshelf_anon",
    "người chưa đăng nhập đọc được",
  ],
  [
    'policy "admin write" nới thành is_admin() OR true',
    `DROP POLICY "admin write" ON public.books;
     CREATE POLICY "admin write" ON public.books FOR ALL
       USING (public.is_admin() OR true) WITH CHECK (public.is_admin() OR true)`,
    `DROP POLICY "admin write" ON public.books;
     CREATE POLICY "admin write" ON public.books FOR ALL
       USING (public.is_admin()) WITH CHECK (public.is_admin())`,
    "admin write",
  ],
  [
    "ràng buộc vị trí hạ xuống INITIALLY IMMEDIATE",
    `ALTER TABLE public.books DROP CONSTRAINT books_shelf_position_key;
     ALTER TABLE public.books ADD CONSTRAINT books_shelf_position_key
       UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY IMMEDIATE`,
    `ALTER TABLE public.books DROP CONSTRAINT books_shelf_position_key;
     ALTER TABLE public.books ADD CONSTRAINT books_shelf_position_key
       UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY DEFERRED`,
    "DEFERRABLE INITIALLY DEFERRED",
  ],
  [
    "_complete_book_for lộ EXECUTE",
    "GRANT EXECUTE ON FUNCTION public._complete_book_for(uuid, text) TO chronoshelf_auth",
    "REVOKE EXECUTE ON FUNCTION public._complete_book_for(uuid, text) FROM chronoshelf_auth",
    "lộ EXECUTE",
  ],
  [
    "reorder_books đổi thành SECURITY DEFINER",
    "ALTER FUNCTION public.reorder_books(text, text[]) SECURITY DEFINER",
    "ALTER FUNCTION public.reorder_books(text, text[]) SECURITY INVOKER",
    "SECURITY DEFINER",
  ],
  [
    "login_codes mọc thêm một policy",
    `CREATE POLICY "leak" ON public.login_codes FOR SELECT USING (true)`,
    `DROP POLICY "leak" ON public.login_codes`,
    "login_codes có policy",
  ],
];

const verifySql = await readFile(VERIFY, "utf8");
const client = new pg.Client({ connectionString: url });
client.on("notice", () => {}); // im lặng — ở đây ta chỉ quan tâm nổ hay không nổ
await client.connect();

let pass = 0;
let fail = 0;

// Điều kiện tiên quyết: chưa phá gì thì 90-verify phải XANH. Không có bước này thì
// một 90-verify hỏng sẵn sẽ làm mọi đột biến "đạt" vì lý do hoàn toàn khác.
try {
  await client.query(verifySql);
  console.log("  PASS  nền: 90-verify.sql xanh khi chưa phá gì\n");
  pass++;
} catch (e) {
  console.error(`  FAIL  nền: 90-verify.sql đã hỏng sẵn — ${e.message}`);
  await client.end();
  process.exit(1);
}

for (const [name, breakSql, restoreSql, expect] of MUTATIONS) {
  await client.query(breakSql);
  let caught = null;
  try {
    await client.query(verifySql);
  } catch (e) {
    caught = e.message;
  }
  await client.query(restoreSql);

  if (caught === null) {
    console.log(`  FAIL  ${name}\n        90-verify.sql VẪN XANH — khẳng định này đã vô nghĩa`);
    fail++;
  } else if (!caught.includes(expect)) {
    console.log(`  FAIL  ${name}\n        nổ nhưng sai chỗ: "${caught}"\n        (chờ có "${expect}")`);
    fail++;
  } else {
    console.log(`  PASS  ${name}\n        → "${caught.slice(0, 90)}"`);
    pass++;
  }
}

// Mọi đột biến phải đã được trả lại nguyên trạng.
try {
  await client.query(verifySql);
  console.log("\n  PASS  sau cùng: 90-verify.sql lại xanh — mọi đột biến đã hoàn tác");
  pass++;
} catch (e) {
  console.log(`\n  FAIL  sau cùng: chưa hoàn tác hết — ${e.message}`);
  fail++;
}

console.log(`\n${pass} đạt / ${fail} hỏng`);
await client.end();
process.exit(fail ? 1 : 0);
