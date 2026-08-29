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

/** Tài khoản mồi nhử ĐÃ LÀ ADMIN do `npm run seed:content` tạo ra.
 *
 *  Cần nó vì `db:check` cố tình chỉ dùng `DATABASE_URL` — không có cửa nào để tự phong
 *  admin lúc chạy (chronoshelf_auth chỉ có SELECT trên `user_roles`, và không hàm
 *  SECURITY DEFINER nào cấp vai trò), mà kéo `PGADMIN_URL` vào đây thì mở lại đúng cái
 *  bẫy "âm thầm bỏ qua phép kiểm khi thiếu biến môi trường". */
const ADMIN_DECOY = "22222222-2222-2222-2222-222222222222";

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

/** Như `asRole` nhưng HOÀN TÁC thay vì COMMIT.
 *
 *  Dùng cho những phép mong câu lệnh CHẠY ĐƯỢC: không có nó thì mỗi lần chạy
 *  `npm run db:check` lại để lại một dòng rác thật trong bảng nội dung. Lỗi vẫn ném ra
 *  ngoài y như `asRole`, chỉ khác là transaction đã được dọn sẵn — nên một phép hỏng
 *  không kéo theo mọi phép sau nó hỏng dây chuyền. */
async function asRoleUndo(role, userId, queries) {
  await c.query("BEGIN");
  await c.query(`SET LOCAL ROLE ${role}`);
  if (userId) await c.query("SELECT set_config('app.user_id', $1, true)", [userId]);
  try {
    let last;
    for (const q of queries) last = await c.query(...[].concat(q));
    return last;
  } finally {
    await c.query("ROLLBACK").catch(() => {});
  }
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

// Hợp đồng của `consume_login_code`: uuid khi mã đúng, NULL cho MỌI nhánh hỏng — nó
// KHÔNG ném exception, và đó là điều kiện sống còn của giới hạn 5 lần thử chứ không phải
// sở thích về kiểu trả về. Một RAISE không ai bắt sẽ hủy cả transaction của request, kéo
// theo luôn câu `UPDATE attempts` bên trong chính hàm đó (db/schema/02-users.sql).
for (const [name, code] of [["mã sai bị từ chối", "999999"], ["mã đã dùng không tái sử dụng được", "111111"]]) {
  const r = await asRole("chronoshelf_anon", null, [
    ["SELECT app.consume_login_code($1,$2) AS id", [emailA, mk(emailA, code)]],
  ]);
  check(r.rows[0].id === null, name, `được chấp nhận: ${r.rows[0].id}`);
}

{
  // Phép DUY NHẤT chứng minh bộ đếm sống sót QUA từng transaction — và cũng là phép duy
  // nhất bắt được nếu ai đó "dọn dẹp" mấy nhánh `RETURN NULL` ngược lại thành RAISE.
  // Mỗi asRole() là một transaction riêng, đúng hình dạng một request POST
  // /api/auth/verify thật; hàm nào ném lỗi thì bộ đếm bị roll back về 0 và vòng lặp dưới
  // đây không bao giờ đốt được mã.
  const emailC = `c-${Date.now()}@example.invalid`;
  await asRole("chronoshelf_anon", null, [
    ["SELECT app.issue_login_code($1,$2,now() + interval '10 minutes')", [emailC, mk(emailC, "333333")]],
  ]);
  for (let i = 0; i < 5; i++) {
    await asRole("chronoshelf_anon", null, [
      ["SELECT app.consume_login_code($1,$2)", [emailC, mk(emailC, "000000")]],
    ]);
  }
  const burned = await asRole("chronoshelf_anon", null, [
    ["SELECT app.consume_login_code($1,$2) AS id", [emailC, mk(emailC, "333333")]],
  ]);
  check(burned.rows[0].id === null,
    "sau 5 lần thử sai, mã ĐÚNG cũng bị từ chối (attempts tăng thật qua từng transaction)",
    `vẫn chấp nhận: ${burned.rows[0].id} — giới hạn số lần thử đang vô hiệu`);
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
  // Nền của mười phép `affected === 0` trong lib/admin/actions.ts, và lý do chúng phải
  // tồn tại: policy "admin write" LỌC DÒNG ở UPDATE chứ KHÔNG ném lỗi. Một UPDATE bị
  // policy chặn trông y hệt một UPDATE trúng slug không tồn tại — 0 dòng, im lặng — nên
  // action nào tin "không có exception = đã lưu" sẽ báo "Đã lưu." trong khi database
  // không đổi gì.
  //
  // Phép này neo nửa SQL của giả định đó. Nửa còn lại — Sequelize trả về hình dạng gì
  // cho một câu UPDATE — do lib/db/rows-affected.ts và test của nó canh.
  const r = await asRoleUndo("chronoshelf_auth", userA, ["UPDATE public.shelves SET name = name"]);
  check(r.rowCount === 0,
    "người thường UPDATE shelves: trúng 0 dòng và KHÔNG có lỗi (phải tự đếm mới biết)",
    `rowCount=${r.rowCount} — policy "admin write" không còn lọc dòng ở UPDATE`);
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
  // `completed` quyết định vật phẩm và quyển kế tiếp, nên cửa duy nhất đặt nó phải là
  // `complete_book` (SECURITY DEFINER). Hàng rào ở đây là GRANT THEO CỘT chứ không phải
  // policy: policy "own progress insert" chỉ soi `user_id`, nó không biết gì về cột
  // `completed`. Vì vậy thông điệp đúng là "permission denied for table", giống
  // `user_items` — nếu một ngày nó đổi thành "violates row-level security policy" thì
  // nghĩa là ai đó vừa nới GRANT INSERT ra cả bảng, đúng thứ phải nổ.
  //
  // INSERT chứ không phải UPDATE: dòng tiến độ CHƯA TỒN TẠI cho tới lần lưu đầu tiên,
  // nên đường đi tự nhiên vào `completed` là INSERT.
  const name = "không tự đánh dấu đọc xong (INSERT kèm cột completed)";
  try {
    await asRoleUndo("chronoshelf_auth", userA, [
      `INSERT INTO public.user_book_progress (user_id, book_slug, current_page, completed)
            VALUES ('${userA}', 'khoi-nguon-bo-coi', 1, true)`,
    ]);
    bad(name, "GHI ĐƯỢC — complete_book hết là cửa duy nhất, tự khóa được chuỗi mở khóa");
  } catch (e) {
    const intact = e.code === "42501" && e.message === "permission denied for table user_book_progress";
    check(intact, `${name} — chặn ở tầng GRANT theo cột`,
      `chờ 42501 "permission denied for table user_book_progress", nhận ${e.code} "${e.message}"`);
  }

  // Đối chứng bắt buộc: một lần REVOKE quá tay cũng làm phép trên xanh, trong khi
  // /api/me/progress đã chết. Đúng câu lệnh của app/api/me/progress/route.ts.
  try {
    const saved = await asRoleUndo("chronoshelf_auth", userA, [
      [`INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
             SELECT $1, b.slug, 3 FROM public.books b WHERE b.slug = $2
        ON CONFLICT (user_id, book_slug) DO UPDATE SET current_page = EXCLUDED.current_page`,
        [userA, "khoi-nguon-bo-coi"]],
    ]);
    check(saved.rowCount === 1, "đối chứng: vẫn lưu được current_page (/api/me/progress còn chạy)",
      `trúng ${saved.rowCount} dòng, chờ 1`);
  } catch (e) {
    bad("đối chứng: vẫn lưu được current_page (/api/me/progress còn chạy)",
      `${e.code} "${e.message}"`);
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
const MEDIA_PROBE_SHA = "a".repeat(64);
{
  // Ảnh là nội dung công khai — policy `read media USING (true)` là chủ ý. Nếu nó hỏng
  // thì mọi ảnh trong sách vỡ với đúng đối tượng chính của sản phẩm: học sinh chưa
  // đăng nhập.
  //
  // Phải là một VÒNG TRÒN admin-ghi → anon-đọc, không phải một phép đếm. `count(*)` không
  // GROUP BY luôn trả về đúng một dòng, nên `rowCount === 1` là hằng số true — nó không
  // nói gì về policy. Mà đếm số dòng đọc được cũng không cứu được: KHÔNG bước bootstrap
  // nào tạo ra dòng media (cửa duy nhất là admin tự tay tải ảnh lên lúc chạy), nên trên
  // một máy vừa clone bảng này RỖNG và "phải có > 0 dòng" sẽ báo động giả.
  //
  // Phụ thuộc mồi nhử admin `2222…` do seed tạo, giống hai phép ở trên.
  const name = "người chưa đăng nhập ĐỌC được media (ảnh phải hiện)";
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE chronoshelf_auth");
    await c.query("SELECT set_config('app.user_id', $1, true)", [ADMIN_DECOY]);
    await c.query(
      `INSERT INTO public.media (sha256, mime, bytes, byte_len)
            VALUES ('${MEDIA_PROBE_SHA}', 'image/png', decode('00','hex'), 1)`);
    // BẮT BUỘC xóa app.user_id trước khi đổi role: `app.current_user_id()` đọc
    // `nullif(current_setting('app.user_id', true), '')`, và SET LOCAL sống qua cả lần
    // SET ROLE thứ hai — để nguyên thì `is_admin()` vẫn true và phép kiểm mù trở lại.
    await c.query("SELECT set_config('app.user_id', '', true)");
    await c.query("SET LOCAL ROLE chronoshelf_anon");
    const seen = await c.query("SELECT sha256 FROM public.media WHERE sha256 = $1", [MEDIA_PROBE_SHA]);
    await c.query("ROLLBACK");
    check(seen.rowCount === 1, name,
      `anon đọc lại được ${seen.rowCount} dòng, chờ 1 — policy "read media" không còn USING (true)`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    bad(name, `truy vấn hỏng: sqlstate ${e.code} "${e.message}"`);
  }
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
  // Ràng buộc CHECK là lớp duy nhất còn đứng trước một UPDATE gõ tay qua psql, và đó
  // chính là con đường nội dung đang được sửa. Nhưng NGƯỜI THƯỜNG không bao giờ chạm
  // tới nó: Postgres chạy RLS WITH CHECK trước ràng buộc bảng, nên mọi INSERT của họ
  // dừng ở 42501 "row-level security policy" — điều mà `deniedByPolicy` ở trên đã kiểm
  // rồi. Muốn chứng minh ràng buộc THẬT SỰ cắn thì phải đi qua cửa admin.
  check((await asRole("chronoshelf_auth", ADMIN_DECOY, ["SELECT public.is_admin() AS a"])).rows[0].a === true,
    "tài khoản mồi nhử vẫn là admin (thiếu nó thì bốn phép dưới rỗng nghĩa)",
    "seed chưa chạy, hoặc dòng vai trò admin của mồi nhử đã bị 'dọn'");

  for (const [table, conname, sql] of [
    ["items", "items_image_credit_ck",
     `INSERT INTO public.items (slug, name, image_url) VALUES ('__dbcheck-img','x','/media/${FAKE_SHA}')`],
    ["books", "books_cover_credit_ck",
     `INSERT INTO public.books (slug, shelf_slug, position, title, era, cover_url)
           VALUES ('__dbcheck-bk','lich-su-viet-nam',996,'x','x','/media/${FAKE_SHA}')`],
    ["pages", "pages_image_credit_ck",
     `INSERT INTO public.pages (book_slug, position, heading, body, image_url)
           VALUES ('khoi-nguon-bo-coi',996,'x','x','/media/${FAKE_SHA}')`],
  ]) {
    const name = `admin cũng không ghi được ảnh thiếu credit vào ${table}`;
    try {
      await asRoleUndo("chronoshelf_auth", ADMIN_DECOY, [sql]);
      bad(name, "GHI ĐƯỢC — ràng buộc ảnh-phải-có-credit không chặn");
    } catch (e) {
      // Neo vào trạng thái "còn nguyên", không liệt kê trạng thái "đã hỏng": phải ĐÚNG
      // check_violation VÀ ĐÚNG tên ràng buộc. 42501 ở đây nghĩa là mồi nhử mất quyền
      // admin và phép kiểm đang đo nhầm lớp — cũng là hỏng.
      check(e.code === "23514" && e.constraint === conname, name,
        `chờ 23514 constraint=${conname}, nhận ${e.code} constraint=${e.constraint} "${e.message}"`);
    }
  }

  // Đối chứng: GRANT phải còn nguyên, nếu không thì ba phép trên đạt vì lý do sai —
  // admin thật cũng ghi hỏng — chứ không phải vì ràng buộc chặn.
  try {
    await asRoleUndo("chronoshelf_auth", ADMIN_DECOY, [
      `INSERT INTO public.items (slug, name, image_url, image_source, image_credit)
            VALUES ('__dbcheck-img-ok','x','/media/${FAKE_SHA}','src','cc')`,
    ]);
    ok("đối chứng: admin ghi ĐƯỢC dòng có đủ credit (GRANT còn nguyên)");
  } catch (e) {
    bad("đối chứng: admin ghi ĐƯỢC dòng có đủ credit (GRANT còn nguyên)",
      `${e.code} "${e.message}"`);
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

// ---------------------------------------------------------------------------
// Chuoi giu lua (content.md §6)
// ---------------------------------------------------------------------------
console.log("\n-- Chuỗi giữ lửa --");

{
  // Hàng rào ở đây là chính GRANT, y như `user_items`: KHÔNG role nào ghi được, cửa duy
  // nhất là `record_activity()` chạy SECURITY DEFINER. Nên thông điệp đúng là
  // "permission denied for table"; nếu một ngày nó đổi thành "violates row-level security
  // policy" thì nghĩa là ai đó vừa CẤP THÊM GRANT INSERT — đúng thứ phải nổ.
  const name = "không tự bịa được ngày hoạt động (INSERT thẳng user_activity)";
  try {
    await asRoleUndo("chronoshelf_auth", userA, [
      `INSERT INTO public.user_activity (user_id, active_on) VALUES ('${userA}', CURRENT_DATE - 5)`,
    ]);
    bad(name, "GHI ĐƯỢC — chuỗi giữ lửa tự bơm được");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    const intact = e.code === "42501" && e.message === "permission denied for table user_activity";
    check(intact, `${name} — chặn ở tầng GRANT, không role nào ghi được`,
      `chờ 42501 "permission denied for table user_activity", nhận ${e.code} "${e.message}"`);
  }
}

{
  // Đối chứng: cửa HỢP LỆ phải mở. Thiếu phép này thì phép trên đạt kể cả khi
  // record_activity hỏng hoàn toàn và chuỗi không bao giờ tăng được.
  const r = await asRoleUndo("chronoshelf_auth", userA, [
    "SELECT public.record_activity()",
    `SELECT count(*)::int AS n FROM public.user_activity
      WHERE user_id = '${userA}' AND active_on = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
  ]);
  check(r.rows[0].n === 1, "đối chứng: record_activity() ghi được đúng một dòng cho hôm nay",
    `chờ 1 dòng, nhận ${r.rows[0].n}`);
}

{
  // Gọi hai lần trong ngày vẫn chỉ một dòng — `ON CONFLICT DO NOTHING` phải thật sự làm
  // việc đó, nếu không mỗi lần lật trang lại nổ khóa chính và mọi lần lưu tiến độ đều hỏng.
  const r = await asRoleUndo("chronoshelf_auth", userA, [
    "SELECT public.record_activity()",
    "SELECT public.record_activity()",
    `SELECT count(*)::int AS n FROM public.user_activity WHERE user_id = '${userA}'`,
  ]);
  check(r.rows[0].n === 1, "gọi hai lần trong cùng ngày vẫn chỉ một dòng",
    `chờ 1 dòng, nhận ${r.rows[0].n}`);
}

{
  // RLS: người này không đọc được ngày hoạt động của người kia. Mồi nhử là dòng vừa ghi
  // cho A ngay trong transaction này — không có nó thì phép này luôn thấy 0 và hết nghĩa.
  await c.query("BEGIN");
  await c.query("SET LOCAL ROLE chronoshelf_auth");
  await c.query("SELECT set_config('app.user_id', $1, true)", [userA]);
  await c.query("SELECT public.record_activity()");
  await c.query("SELECT set_config('app.user_id', $1, true)", [userB]);
  const r = await c.query("SELECT count(*)::int AS n FROM public.user_activity");
  await c.query("ROLLBACK").catch(() => {});
  check(r.rows[0].n === 0, "không đọc trộm được ngày hoạt động của người khác",
    `B thấy ${r.rows[0].n} dòng, chờ 0 (A vừa được ghi một dòng ngay trước đó)`);
}

await denied(
  "người chưa đăng nhập không đọc được user_activity",
  "chronoshelf_anon",
  "SELECT 1 FROM public.user_activity",
  "permission denied for table user_activity",
);

{
  const name = "người chưa đăng nhập không gọi được record_activity";
  try {
    await asRoleUndo("chronoshelf_anon", null, ["SELECT public.record_activity()"]);
    bad(name, "GỌI ĐƯỢC");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    const intact = e.code === "42501" && e.message.startsWith("permission denied for function");
    check(intact, name, `chờ 42501 "permission denied for function…", nhận ${e.code} "${e.message}"`);
  }
}

console.log(`\n${pass} đạt / ${fail} hỏng`);
await c.end();
process.exit(fail ? 1 : 0);
