/**
 * Hàng rào nhìn từ phía ỨNG DỤNG: nối bằng đúng `DATABASE_URL` mà Route Handler dùng
 * (role `chronoshelf_app`), rồi thử đúng những việc một request thật có thể thử.
 *
 * Khác `db/schema/90-verify.sql`: file đó chạy bằng superuser nên kiểm được catalog
 * (`has_table_privilege`) nhưng KHÔNG kiểm được thứ quan trọng hơn — cái mà một
 * request thật làm được. Script này đi đúng đường của kẻ tấn công.
 *
 * Chạy: npm run db:check
 *
 * CẦN DỮ LIỆU SEED: nửa sau của script đòi nội dung thật cùng hai dòng mồi nhử do
 * `npm run seed:content` tạo ra (quyển nháp `__nhap-khong-bao-gio-xuat-ban` và dòng
 * vai trò admin của tài khoản mồi nhử `2222…`). Chạy trên database rỗng thì chúng
 * hỏng — không phải vì hàng rào thủng, mà vì không còn gì để thử.
 */

import pg from "pg";
import crypto from "node:crypto";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

let pass = 0, fail = 0;
const ok  = (n) => { console.log(`  PASS  ${n}`); pass++; };
const bad = (n, d) => { console.log(`  FAIL  ${n}\n        ${d}`); fail++; };
/** `cond` đúng thì đạt, sai thì hỏng kèm `detail`. */
const check = (cond, name, detail = "") => (cond ? ok(name) : bad(name, detail));

/** Chạy `sql` dưới `role`; đạt CHỈ KHI hỏng đúng sqlstate 42501 VÀ đúng thông điệp
 *  `expect`. Mọi lỗi khác — kể cả 42501 khác thông điệp — tính là rò rỉ, vì
 *  "permission denied for table" và "violates row-level security policy" dùng CHUNG
 *  mã 42501 nhưng nói hai chuyện hoàn toàn khác nhau. */
async function denied(name, role, sql, expect) {
  try {
    await c.query("BEGIN");
    await c.query(`SET LOCAL ROLE ${role}`);
    await c.query(sql);
    await c.query("ROLLBACK");
    return bad(name, "câu lệnh CHẠY ĐƯỢC — đáng lẽ bị từ chối");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    if (e.code !== "42501") return bad(name, `sqlstate ${e.code}, chờ 42501: ${e.message}`);
    if (e.message !== expect) return bad(name, `thông điệp "${e.message}", chờ đúng "${expect}"`);
    ok(name);
  }
}

/** Chạy trong một transaction có SET LOCAL ROLE, trả kết quả câu cuối. */
async function asRole(role, userId, queries) {
  await c.query("BEGIN");
  await c.query(`SET LOCAL ROLE ${role}`);
  if (userId) await c.query("SELECT set_config('app.user_id', $1, true)", [userId]);
  let last;
  for (const q of queries) last = await c.query(...[].concat(q));
  await c.query("COMMIT");
  return last;
}

console.log("\n-- NOINHERIT: role kết nối không tự có quyền của hai role con --");
console.log(`  current_user = ${(await c.query("SELECT current_user")).rows[0].current_user}`);
// Với role KHÔNG có quyền gì, "cổng nào bắn trước" (schema / function / bảng) là chi
// tiết nội bộ của Postgres và có thể đổi giữa các bản. Nên khẳng định chính xác đặt ở
// CATALOG — ổn định và nói đúng điều ta muốn — còn phép chạy thật chỉ cần xác nhận nó
// bị chặn bằng 42501.
for (const obj of ["public.users", "public.login_codes", "public.user_roles"]) {
  const got = (await c.query("SELECT has_table_privilege('chronoshelf_app',$1,'SELECT') AS ok", [obj])).rows[0].ok;
  check(got === false, `catalog: chronoshelf_app KHÔNG có SELECT trên ${obj}`, "NOINHERIT mất tác dụng");
}
{
  // Không dùng chữ ký dạng text: has_function_privilege() phải phân giải tên, việc đó
  // đòi USAGE trên schema `app` — thứ role này cố tình không có, nên chính phép kiểm
  // sẽ nổ thay vì trả lời. Tra OID trong pg_proc thì không cần quyền gì (catalog đọc
  // được cho mọi role).
  const q = await c.query(`
    SELECT has_schema_privilege('chronoshelf_app','app','USAGE') AS schema_usage,
           has_function_privilege('chronoshelf_app', p.oid, 'EXECUTE') AS fn_exec
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'app' AND p.proname = 'current_user_id'`);
  const r = q.rows[0];
  check(r.schema_usage === false, "catalog: chronoshelf_app KHÔNG có USAGE trên schema app");
  check(r.fn_exec === false, "catalog: chronoshelf_app KHÔNG có EXECUTE trên app.current_user_id()");
}
for (const [name, sql] of [
  ["chạy thật: đọc users khi chưa SET ROLE bị chặn", "SELECT 1 FROM public.users"],
  ["chạy thật: gọi app.current_user_id() bị chặn", "SELECT app.current_user_id()"],
]) {
  try {
    await c.query("BEGIN"); await c.query(sql); await c.query("ROLLBACK");
    bad(name, "CHẠY ĐƯỢC — đáng lẽ bị từ chối");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    check(e.code === "42501", `${name}  (${e.code}: ${e.message})`, `chờ 42501, nhận ${e.code}`);
  }
}

console.log("\n-- Người chưa đăng nhập (chronoshelf_anon) --");
await denied("không đọc được users",       "chronoshelf_anon", "SELECT 1 FROM public.users",       "permission denied for table users");
await denied("không đọc được login_codes", "chronoshelf_anon", "SELECT 1 FROM public.login_codes", "permission denied for table login_codes");
await denied("không đọc được user_roles",  "chronoshelf_anon", "SELECT 1 FROM public.user_roles",  "permission denied for table user_roles");
await denied("không tự phong admin",       "chronoshelf_anon",
  "INSERT INTO public.user_roles (user_id, role) VALUES (gen_random_uuid(),'admin')",
  "permission denied for table user_roles");

const anonUid = (await asRole("chronoshelf_anon", null, ["SELECT app.current_user_id() AS id"])).rows[0].id;
check(anonUid === null, "app.current_user_id() là NULL khi chưa đặt app.user_id", `nhận ${anonUid}`);

console.log("\n-- Luồng OTP (chỉ đi qua hàm SECURITY DEFINER) --");
const mk = (e, cd) => crypto.createHash("sha256").update(`${e}:${cd}`).digest("hex");
const emailA = `a-${Date.now()}@example.invalid`;
const hashA = mk(emailA, "111111");
const userA = (await asRole("chronoshelf_anon", null, [
  ["SELECT app.issue_login_code($1,$2,now() + interval '10 minutes')", [emailA, hashA]],
  ["SELECT app.consume_login_code($1,$2) AS id", [emailA, hashA]],
])).rows[0].id;
check(Boolean(userA), `anon phát + đổi mã, tạo tài khoản ${String(userA).slice(0, 8)}…`);

for (const [name, code] of [["mã sai bị từ chối", "999999"], ["mã đã dùng không tái sử dụng được", "111111"]]) {
  try {
    await asRole("chronoshelf_anon", null, [["SELECT app.consume_login_code($1,$2)", [emailA, mk(emailA, code)]]]);
    bad(name, "được chấp nhận");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    check(e.message === "Invalid or expired code", name, `thông điệp khác: ${e.message}`);
  }
}

const emailB = `b-${Date.now()}@example.invalid`;
const hashB = mk(emailB, "222222");
const userB = (await asRole("chronoshelf_anon", null, [
  ["SELECT app.issue_login_code($1,$2,now() + interval '10 minutes')", [emailB, hashB]],
  ["SELECT app.consume_login_code($1,$2) AS id", [emailB, hashB]],
])).rows[0].id;

console.log("\n-- RLS: người đã đăng nhập chỉ thấy dòng của mình --");
const seen = await asRole("chronoshelf_auth", userA, ["SELECT id FROM public.users"]);
check(seen.rowCount === 1 && seen.rows[0].id === userA,
  "chỉ thấy 1 dòng users, đúng của mình (bảng đang có ít nhất 2 tài khoản: A và B)",
  `thấy ${seen.rowCount} dòng: ${JSON.stringify(seen.rows)}`);

const seenB = await asRole("chronoshelf_auth", userB, ["SELECT id FROM public.users"]);
check(seenB.rowCount === 1 && seenB.rows[0].id === userB,
  "đổi app.user_id thì thấy đúng dòng của người kia, không phải dòng cũ",
  `thấy ${JSON.stringify(seenB.rows)}`);

console.log("\n-- SET LOCAL không rò rỉ sang transaction sau --");
const after = (await asRole("chronoshelf_auth", null, ["SELECT app.current_user_id() AS id"])).rows[0];
check(after.id === null, "app.user_id đã tự xóa khi transaction trước kết thúc", `còn sót ${after.id}`);

/**
 * Đạt CHỈ KHI câu lệnh hỏng vì POLICY chặn — sqlstate 42501 VÀ thông điệp nói về
 * row-level security.
 *
 * Phân biệt này là bắt buộc, không phải cầu kỳ: "thiếu GRANT" và "policy chặn" dùng
 * CHUNG sqlstate 42501 và khác nhau duy nhất ở message
 * (`permission denied for table` so với `new row violates row-level security policy`).
 * Nếu phép kiểm chấp nhận cả hai, thì một ngày nào đó GRANT bị gỡ mất — khiến chính
 * ADMIN THẬT cũng không ghi được — mà phép kiểm vẫn xanh. Nó sẽ không còn chứng minh
 * điều ta cần: rằng người thường đi qua được cửa GRANT rồi mới bị policy chặn lại.
 */
async function deniedByPolicy(name, userId, sql) {
  try {
    await asRole("chronoshelf_auth", userId, [sql]);
    return bad(name, "GHI ĐƯỢC — policy \"admin write\" không chặn");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    if (e.code !== "42501") return bad(name, `sqlstate ${e.code}, chờ 42501: ${e.message}`);
    if (!/row-level security policy/.test(e.message)) {
      return bad(name, `42501 nhưng KHÔNG phải do policy: "${e.message}" — có thể đang thiếu GRANT`);
    }
    ok(`${name} — bị policy chặn (không phải thiếu GRANT)`);
  }
}

console.log("\n-- Người đã đăng nhập nhưng KHÔNG phải admin --");
// Bốn bảng kiểm riêng từng cái: cả bốn dùng chung policy "admin write", nhưng một sai
// lệch ở riêng một bảng sẽ không bị phép nào khác bắt được.
for (const [table, sql] of [
  ["shelves", "INSERT INTO public.shelves (slug, name, position) VALUES ('__dbcheck', 'x', 997)"],
  ["items", "INSERT INTO public.items (slug, name) VALUES ('__dbcheck', 'x')"],
  [
    "books",
    "INSERT INTO public.books (slug, shelf_slug, position, title, era) " +
      "VALUES ('__dbcheck', 'lich-su-viet-nam', 997, 'x', 'x')",
  ],
  [
    "pages",
    "INSERT INTO public.pages (book_slug, position, heading, body) " +
      "VALUES ('khoi-nguon-bo-coi', 997, 'x', 'x')",
  ],
]) {
  await deniedByPolicy(`không ghi được ${table}`, userA, sql);
}

{
  // `user_items` KHÁC bốn bảng nội dung ở trên, và khác một cách có chủ ý: ở đó hàng
  // rào là policy (GRANT có, policy chặn), còn ở đây là chính GRANT — KHÔNG role nào
  // được ghi user_items, cửa duy nhất là `complete_book` chạy SECURITY DEFINER.
  //
  // Nên thông điệp đúng ở đây là "permission denied for table", và nếu một ngày nó đổi
  // thành "violates row-level security policy" thì nghĩa là ai đó vừa CẤP THÊM GRANT
  // INSERT — đúng thứ phải nổ.
  const sql = `INSERT INTO public.user_items (user_id, item_slug) VALUES ('${userA}', 'trong-dong')`;
  const name = "không tự trao được vật phẩm qua user_items";
  try {
    await asRole("chronoshelf_auth", userA, [sql]);
    bad(name, "GHI ĐƯỢC — tự phát vật phẩm cho mình được");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    const intact = e.code === "42501" && e.message === "permission denied for table user_items";
    check(intact, `${name} — chặn ở tầng GRANT, không role nào ghi được`,
      `chờ 42501 "permission denied for table user_items", nhận ${e.code} "${e.message}"`);
  }
}

{
  // Mồi nhử `__nhap-khong-bao-gio-xuat-ban` do seed tạo ra. Thiếu nó thì phép này luôn
  // thấy 0 dòng vì mọi sách thật đều đã xuất bản — vẫn báo đạt, kể cả khi RLS hỏng.
  const drafts = await asRole("chronoshelf_auth", userA, [
    "SELECT slug FROM public.books WHERE NOT published",
  ]);
  check(drafts.rowCount === 0, "không đọc được sách chưa xuất bản",
    `thấy ${drafts.rowCount} quyển nháp: ${JSON.stringify(drafts.rows)}`);
}

{
  // Vai trò "của người khác" cũng do seed tạo (tài khoản mồi nhử 2222…). Thiếu nó thì
  // user_roles không còn dòng nào ngoài của chính mình và phép này thành rỗng nghĩa.
  const roles = await asRole("chronoshelf_auth", userA, ["SELECT user_id FROM public.user_roles"]);
  check(roles.rowCount === 0, "không đọc trộm được vai trò của người khác",
    `thấy ${roles.rowCount} dòng: ${JSON.stringify(roles.rows)}`);
}

console.log("\n-- Kho ảnh (media) --");
{
  // Ảnh là nội dung công khai — policy `read media USING (true)` là chủ ý. Phép này xác
  // nhận điều đó THẬT SỰ đúng, vì nếu nó hỏng thì mọi ảnh trong sách vỡ với đúng đối
  // tượng chính của sản phẩm: học sinh chưa đăng nhập.
  const seen = await asRole("chronoshelf_anon", null, ["SELECT count(*) AS n FROM public.media"]);
  check(seen.rowCount === 1, "người chưa đăng nhập ĐỌC được media (ảnh phải hiện)",
    `truy vấn hỏng: ${JSON.stringify(seen.rows)}`);
}

const FAKE_SHA = "f".repeat(64);
await denied("người chưa đăng nhập không ghi được media", "chronoshelf_anon",
  `INSERT INTO public.media (sha256, mime, bytes, byte_len)
        VALUES ('${FAKE_SHA}', 'image/png', '\\x00'::bytea, 1)`,
  "permission denied for table media");

await deniedByPolicy(
  "người thường không ghi được media",
  userA,
  `INSERT INTO public.media (sha256, mime, bytes, byte_len)
        VALUES ('${FAKE_SHA}', 'image/png', '\\x00'::bytea, 1)`,
);

for (const [name, sql] of [
  ["không SỬA được dòng media đã có", "UPDATE public.media SET mime = 'image/gif'"],
  ["không XÓA được dòng media đã có", "DELETE FROM public.media"],
]) {
  // Khác hai phép trên: ở đây hàng rào là chính GRANT (bảng chỉ-ghi-thêm), không phải
  // policy. Đó là thứ giữ cho `Cache-Control: immutable` ở /media/[id] khỏi thành nói dối.
  try {
    await asRole("chronoshelf_auth", userA, [sql]);
    bad(name, "LÀM ĐƯỢC — media khong con chi-ghi-them");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    const intact = e.code === "42501" && e.message === "permission denied for table media";
    check(intact, `${name} — chặn ở tầng GRANT`,
      `chờ 42501 "permission denied for table media", nhận ${e.code} "${e.message}"`);
  }
}

console.log("\n-- Ảnh bắt buộc có nguồn + tác giả (điều kiện CC BY-SA) --");
{
  // Ràng buộc CHECK là lớp duy nhất còn đứng trước một UPDATE gõ tay qua psql. Phép này
  // chạy bằng role ứng dụng nên nó chứng minh lớp đó áp cho cả đường đi thật.
  const name = "không ghi được ảnh thiếu credit vào items";
  try {
    await asRole("chronoshelf_auth", userA, [
      `INSERT INTO public.items (slug, name, image_url) VALUES ('__dbcheck-img', 'x', '/media/${FAKE_SHA}')`,
    ]);
    bad(name, "GHI ĐƯỢC — ràng buộc ảnh-phải-có-credit không chặn");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    // Người thường bị policy "admin write" chặn TRƯỚC khi tới CHECK — đó vẫn là chặn
    // đúng, chỉ là ở lớp khác. Chấp nhận cả hai, nhưng KHÔNG chấp nhận thứ gì khác.
    const byPolicy = /row-level security policy/.test(e.message);
    const byCheck = /items_image_credit_ck/.test(e.message);
    check(byPolicy || byCheck, `${name} (${byCheck ? "CHECK" : "policy"} chặn)`,
      `hỏng vì lý do khác: ${e.code} "${e.message}"`);
  }
}

console.log("\n-- complete_book khi CHƯA đăng nhập --");
// Dùng slug sách THẬT đã xuất bản, không phải slug bịa. Với slug bịa, kể cả khi quyền
// EXECUTE lỡ bị cấp cho người chưa đăng nhập thì hàm vẫn dừng ở "Book not found" — một
// lỗi có thật nhưng không nói gì về quyền — nên phép kiểm sẽ báo đạt đúng lúc lỗ hổng
// nghiêm trọng nhất đã mở toang.
//
// Và không liệt kê những lỗi bị coi là "đã lộ" (danh sách đó không bao giờ đủ): chỉ
// một trạng thái được coi là "quyền còn nguyên" — đúng 42501 VÀ đúng thông điệp
// "permission denied for function" — mọi thứ khác là rò rỉ.
for (const [name, fn] of [
  ["complete_book", "SELECT public.complete_book('khoi-nguon-bo-coi')"],
  ["_complete_book_for", `SELECT public._complete_book_for('${userA}', 'khoi-nguon-bo-coi')`],
]) {
  try {
    await asRole("chronoshelf_anon", null, [fn]);
    bad(`người chưa đăng nhập không gọi được ${name}`, "GỌI ĐƯỢC");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    const intact = e.code === "42501" && e.message.startsWith("permission denied for function");
    check(intact, `người chưa đăng nhập không gọi được ${name}`,
      `chờ 42501 "permission denied for function…", nhận ${e.code} "${e.message}"`);
  }
}

console.log(`\n${pass} đạt / ${fail} hỏng`);
await c.end();
process.exit(fail ? 1 : 0);
