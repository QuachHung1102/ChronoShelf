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
import { bamMoi, bamTheoThamSo, chuanHoaDapAn } from "../lib/auth/mat-khau.ts";

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
for (const obj of [
  "public.users",
  "public.user_roles",
  "public.community_posts",
  "public.community_comments",
  "public.documents",
  "public.lessons",
]) {
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
await denied("không đọc được user_roles",  "chronoshelf_anon", "SELECT 1 FROM public.user_roles",  "permission denied for table user_roles");
await denied("không tự phong admin",       "chronoshelf_anon",
  "INSERT INTO public.user_roles (user_id, role) VALUES (gen_random_uuid(),'admin')",
  "permission denied for table user_roles");

const anonUid = (await asRole("chronoshelf_anon", null, ["SELECT app.current_user_id() AS id"])).rows[0].id;
check(anonUid === null, "app.current_user_id() là NULL khi chưa đặt app.user_id", `nhận ${anonUid}`);

console.log("\n-- Đăng nhập bằng mật khẩu (chỉ đi qua hàm SECURITY DEFINER) --");

/** Tạo một tài khoản thật qua đúng `app.dang_ky`, trả về id. */
async function taoTaiKhoan(email, matKhau, cauHoi = "ten-thu-cung", dapAn = "mun") {
  const mk = await bamMoi(matKhau);
  const da = await bamMoi(chuanHoaDapAn(dapAn));
  const r = await asRole("chronoshelf_anon", null, [
    [
      "SELECT app.dang_ky($1,$2,$3,$4,$5,$6) AS id",
      [email, mk.thamSo, mk.bam, cauHoi, da.thamSo, da.bam],
    ],
  ]);
  return r.rows[0].id;
}

/** Một lượt đăng nhập ĐẦY ĐỦ, đúng hình dạng hai request thật: hai transaction riêng. */
async function thuDangNhap(email, matKhau) {
  const ts = (
    await asRole("chronoshelf_anon", null, [["SELECT app.bat_dau_dang_nhap($1) AS ts", [email]]])
  ).rows[0].ts;
  if (!ts) return { khoa: true, id: null };
  const bam = await bamTheoThamSo(matKhau, ts);
  const r = await asRole("chronoshelf_anon", null, [
    ["SELECT app.ket_thuc_dang_nhap($1,$2) AS id", [email, bam]],
  ]);
  return { khoa: false, id: r.rows[0].id };
}

const emailA = `a-${Date.now()}@example.invalid`;
const MK_A = "mat-khau-cua-A-123";
const userA = await taoTaiKhoan(emailA, MK_A);
check(Boolean(userA), `anon đăng ký được, tạo tài khoản ${String(userA).slice(0, 8)}…`);

{
  const lai = await taoTaiKhoan(emailA, "mat-khau-khac-123");
  check(lai === null, "đăng ký lại cùng email trả NULL, không tạo tài khoản thứ hai",
    `nhận ${lai} — email không còn là duy nhất`);
}

{
  const r = await thuDangNhap(emailA, MK_A);
  check(r.id === userA, "đăng nhập đúng mật khẩu trả về đúng tài khoản", `nhận ${r.id}`);
}

{
  const r = await thuDangNhap(emailA, "sai-hoan-toan-123");
  check(r.id === null, "sai mật khẩu bị từ chối", `được chấp nhận: ${r.id}`);
}

{
  // Email KHÔNG TỒN TẠI vẫn phải trả về một chuỗi tham số. Trả NULL ở đây là biến trang
  // đăng nhập thành máy dò: gõ email vào, phản hồi nhanh nghĩa là chưa ai đăng ký.
  const ts = (
    await asRole("chronoshelf_anon", null, [
      ["SELECT app.bat_dau_dang_nhap($1) AS ts", ["khong-ai-dung-bao-gio@example.invalid"]],
    ])
  ).rows[0].ts;
  check(typeof ts === "string" && ts.startsWith("scrypt$"),
    "email không tồn tại vẫn nhận được tham số băm (không dò được ai đã đăng ký)",
    `nhận ${JSON.stringify(ts)}`);

  const r = await thuDangNhap("khong-ai-dung-bao-gio@example.invalid", "bat-ky-123");
  check(r.id === null, "…nhưng vẫn không đăng nhập được", `nhận ${r.id}`);
}

{
  // Phép DUY NHẤT chứng minh bộ đếm sống sót QUA từng transaction — và cũng là phép duy
  // nhất bắt được nếu ai đó "dọn dẹp" mấy nhánh `RETURN NULL` trong
  // `app.ket_thuc_dang_nhap` ngược lại thành RAISE. Mỗi `thuDangNhap` là hai transaction
  // riêng, đúng hình dạng một request thật; hàm nào ném lỗi thì bộ đếm bị roll back về 0
  // và vòng lặp dưới đây không bao giờ khóa được tài khoản.
  const emailC = `c-${Date.now()}@example.invalid`;
  const MK_C = "mat-khau-cua-C-123";
  await taoTaiKhoan(emailC, MK_C);

  for (let k = 0; k < 5; k++) await thuDangNhap(emailC, "sai-be-bet-123");

  const dung = await thuDangNhap(emailC, MK_C);
  check(dung.id === null,
    "sau 5 lần sai, mật khẩu ĐÚNG cũng bị từ chối (bộ đếm tăng thật qua từng transaction)",
    `vẫn chấp nhận: ${dung.id} — giới hạn số lần thử đang vô hiệu`);
  check(dung.khoa === true,
    "…và bước 1 trả NULL luôn, không tốn scrypt cho kẻ đang dò",
    "bat_dau_dang_nhap vẫn trả tham số dù tài khoản đang bị khóa");
}

console.log("\n-- Khôi phục bằng câu hỏi bảo mật --");

{
  // Câu hỏi phải trả về cho MỌI email, kể cả email chưa ai đăng ký.
  const coThat = (
    await asRole("chronoshelf_anon", null, [["SELECT app.cau_hoi_khoi_phuc($1) AS q", [emailA]]])
  ).rows[0].q;
  check(coThat === "ten-thu-cung", "email có thật trả đúng câu hỏi đã chọn", `nhận ${coThat}`);

  const khongCo = (
    await asRole("chronoshelf_anon", null, [
      ["SELECT app.cau_hoi_khoi_phuc($1) AS q", ["chua-ai-dang-ky@example.invalid"]],
    ])
  ).rows[0].q;
  check(typeof khongCo === "string" && khongCo.length > 0,
    "email KHÔNG có tài khoản cũng nhận được một câu hỏi (không dò được ai đã đăng ký)",
    `nhận ${JSON.stringify(khongCo)}`);

  const lanHai = (
    await asRole("chronoshelf_anon", null, [
      ["SELECT app.cau_hoi_khoi_phuc($1) AS q", ["chua-ai-dang-ky@example.invalid"]],
    ])
  ).rows[0].q;
  check(lanHai === khongCo,
    "…và câu hỏi mồi đó ỔN ĐỊNH qua các lần hỏi (đổi mỗi lần là tự khai nó giả)",
    `lần 1 ${khongCo}, lần 2 ${lanHai}`);
}

/** Một lượt khôi phục đầy đủ, hai transaction riêng như request thật. */
async function thuKhoiPhuc(email, dapAn, matKhauMoi) {
  const ts = (
    await asRole("chronoshelf_anon", null, [["SELECT app.bat_dau_khoi_phuc($1) AS ts", [email]]])
  ).rows[0].ts;
  if (!ts) return { khoa: true, id: null };
  const bamDA = await bamTheoThamSo(chuanHoaDapAn(dapAn), ts);
  const mk = await bamMoi(matKhauMoi);
  const r = await asRole("chronoshelf_anon", null, [
    ["SELECT app.ket_thuc_khoi_phuc($1,$2,$3,$4) AS id", [email, bamDA, mk.thamSo, mk.bam]],
  ]);
  return { khoa: false, id: r.rows[0].id };
}

{
  const emailD = `d-${Date.now()}@example.invalid`;
  const userD = await taoTaiKhoan(emailD, "mat-khau-cu-123", "truong-tieu-hoc", "Trường Kim Đồng");

  const sai = await thuKhoiPhuc(emailD, "Trường Nào Đó", "mat-khau-moi-123");
  check(sai.id === null, "đáp án sai không đặt lại được mật khẩu", `nhận ${sai.id}`);

  // Đáp án đúng nhưng gõ khác kiểu: thường, không dấu, thừa khoảng trắng.
  const dung = await thuKhoiPhuc(emailD, "  truong kim dong ", "mat-khau-moi-123");
  check(dung.id === userD,
    "đáp án đúng (khác hoa thường + không dấu) đặt lại được mật khẩu",
    `nhận ${dung.id}`);

  const cu = await thuDangNhap(emailD, "mat-khau-cu-123");
  check(cu.id === null, "mật khẩu CŨ hết tác dụng sau khi đặt lại", `vẫn vào được: ${cu.id}`);

  const moi = await thuDangNhap(emailD, "mat-khau-moi-123");
  check(moi.id === userD, "mật khẩu MỚI đăng nhập được", `nhận ${moi.id}`);
}

{
  const emailE = `e-${Date.now()}@example.invalid`;
  await taoTaiKhoan(emailE, "mat-khau-cua-E-123", "mon-an-ghet", "mắm tôm");

  for (let k = 0; k < 5; k++) await thuKhoiPhuc(emailE, "sai roi", "khong-quan-trong-123");

  const dung = await thuKhoiPhuc(emailE, "mắm tôm", "mat-khau-moi-123");
  check(dung.id === null,
    "sau 5 lần sai, đáp án ĐÚNG cũng bị từ chối (bộ đếm khôi phục tăng thật)",
    `vẫn chấp nhận: ${dung.id} — câu hỏi bảo mật thành cửa dò tự do`);
}

const emailB = `b-${Date.now()}@example.invalid`;
const userB = await taoTaiKhoan(emailB, "mat-khau-cua-B-123");

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
    return bad(name, "GHI ĐƯỢC — policy ghi không chặn");
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
  ["complete_book", "SELECT public.complete_book('khoi-nguon-bo-coi', '{}'::smallint[])"],
  ["_complete_book_for",
   `SELECT public._complete_book_for('${userA}', 'khoi-nguon-bo-coi', '{}'::smallint[])`],
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
// Bai trac nghiem cuoi sach (content.md §4.3)
// ---------------------------------------------------------------------------
console.log("\n-- Bài trắc nghiệm cuối sách --");

// Hàng rào ở đây là GRANT THEO CỘT, nên thông điệp đúng là "permission denied for
// table" — giống `user_items`, khác bốn bảng nội dung (ở đó policy mới là hàng rào).
// Chuỗi này ĐÃ ĐO trên PostgreSQL 18 ngày 2026-09-07: kể cả khi chỉ hỏi đúng một cột
// bị cấm, PG vẫn báo theo BẢNG chứ không theo cột. Đổi thành "for column" nghĩa là
// hình dạng thông điệp đã đổi, không phải hàng rào hỏng — đo lại rồi sửa hằng số này.
for (const [name, sql] of [
  ["đọc thẳng correct_index", "SELECT correct_index FROM public.book_questions"],
  ["SELECT * (đường vô ý hay gặp nhất)", "SELECT * FROM public.book_questions"],
]) {
  await denied(`người đã đăng nhập KHÔNG ${name}`, "chronoshelf_auth", sql,
    "permission denied for table book_questions");
}

// Đối chứng bắt buộc: REVOKE quá tay cũng làm hai phép trên xanh, trong khi trình đọc
// không hiện được câu hỏi nào và bài kiểm tra biến mất khỏi sản phẩm.
try {
  await asRoleUndo("chronoshelf_auth", userA, [
    "SELECT id, book_slug, position, prompt, choices FROM public.book_questions",
  ]);
  ok("đối chứng: đọc ĐƯỢC câu hỏi và các lựa chọn (GRANT theo cột còn nguyên)");
} catch (e) {
  bad("đối chứng: đọc ĐƯỢC câu hỏi và các lựa chọn (GRANT theo cột còn nguyên)",
    `${e.code} "${e.message}"`);
}

// Câu hỏi của một quyển CHƯA XUẤT BẢN không được lọt ra. Hàng rào ở đây là policy
// `read published`, KHÁC hai phép trên (ở đó hàng rào là GRANT theo cột) — nên nó phải
// được khẳng định theo đúng cơ chế của chính nó: không có lỗi nào cả, chỉ là 0 dòng.
//
// Phép này CHỈ CÓ NGHĨA nhờ dòng mồi nhử do `seed:content` tạo ra. Mọi câu hỏi thật đều
// thuộc sách đã xuất bản, nên thiếu mồi nhử thì nó luôn thấy 0 dòng và luôn báo đạt — kể
// cả khi policy bị nới thành USING (true). Đối chứng ngay dưới là thứ bắt được chuyện đó.
{
  const NHAP = "__nhap-khong-bao-gio-xuat-ban";
  const dem = async (role, userId) =>
    Number(
      (await asRoleUndo(role, userId, [
        [`SELECT count(*) AS n FROM public.book_questions WHERE book_slug = $1`, [NHAP]],
      ])).rows[0].n,
    );

  const moiNhu = Number(
    (await asRoleUndo("chronoshelf_auth", ADMIN_DECOY, [
      [`SELECT count(*) AS n FROM public.admin_book_questions($1)`, [NHAP]],
    ])).rows[0].n,
  );
  check(moiNhu > 0,
    "đối chứng: quyển nháp CÓ câu hỏi mồi nhử để mà giấu",
    `admin thấy ${moiNhu} câu — chạy lại npm run seed:content, thiếu nó thì phép dưới vô nghĩa`);

  check((await dem("chronoshelf_anon", null)) === 0,
    "người chưa đăng nhập KHÔNG đọc được câu hỏi của sách nháp");
  check((await dem("chronoshelf_auth", userA)) === 0,
    "người đã đăng nhập (không phải admin) KHÔNG đọc được câu hỏi của sách nháp");

  // Đối chứng chiều ngược: admin PHẢI thấy, nếu không thì policy đã bị siết quá tay và
  // hai phép trên đạt vì lý do sai.
  check((await dem("chronoshelf_auth", ADMIN_DECOY)) > 0,
    "đối chứng: admin ĐỌC ĐƯỢC câu hỏi của sách nháp (policy không bị siết quá tay)");
}

// `admin_book_questions` là cửa DUY NHẤT đọc được đáp án. Nó SECURITY DEFINER nên tự bỏ
// qua RLS — thứ chặn người thường là dòng `is_admin()` bên trong, và đây là phép đo nó.
{
  const name = "người thường gọi admin_book_questions KHÔNG đọc được đáp án";
  try {
    await asRoleUndo("chronoshelf_auth", userA, [
      "SELECT * FROM public.admin_book_questions('khoi-nguon-bo-coi')",
    ]);
    bad(name, "ĐỌC ĐƯỢC — đáp án của mọi quyển lộ cho bất kỳ ai đã đăng nhập");
  } catch (e) {
    check(e.code === "P0001" && e.message.includes("chỉ admin"), name,
      `chờ P0001 "…chỉ admin…", nhận ${e.code} "${e.message}"`);
  }
}

// Phép quan trọng nhất của cả mục: trả lời SAI thì KHÔNG có vật phẩm nào rơi ra.
//
// Cả khối nằm trong MỘT transaction rồi ROLLBACK, nên câu hỏi thử và vật phẩm vừa trao
// đều biến mất. `complete_book` là SECURITY DEFINER nhưng vẫn chạy trong transaction
// của người gọi, nên ROLLBACK dọn được cả phần nó ghi.
{
  const SLUG = "khoi-nguon-bo-coi";
  const name0 = "chuẩn bị: dựng bài trắc nghiệm hai câu cho một quyển thật";
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL ROLE chronoshelf_auth");

    // Dọn sạch câu hỏi CÓ SẴN của quyển này trước khi chèn hai câu thử. Không có bước
    // này thì `row_number()` đếm cả câu do seed tạo ra và mảng đáp án bên dưới lệch chỉ
    // số — phép kiểm sẽ hỏng theo nội dung, chứ không theo hàng rào.
    await c.query("SELECT set_config('app.user_id', $1, true)", [ADMIN_DECOY]);
    await c.query("DELETE FROM public.book_questions WHERE book_slug = $1", [SLUG]);
    await c.query(
      `INSERT INTO public.book_questions (book_slug, position, prompt, choices, correct_index)
       VALUES ($1, 1, 'Câu thử 1?', ARRAY['sai','ĐÚNG'], 1),
              ($1, 2, 'Câu thử 2?', ARRAY['ĐÚNG','sai','sai'], 0)`,
      [SLUG],
    );
    ok(name0);

    // Người học: đã lật tới trang cuối, chưa hoàn thành.
    await c.query("SELECT set_config('app.user_id', $1, true)", [userA]);
    await c.query(
      `INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
            SELECT $1, $2, (SELECT count(*) FROM public.pages WHERE book_slug = $2)
       ON CONFLICT (user_id, book_slug) DO UPDATE SET current_page = EXCLUDED.current_page`,
      [userA, SLUG],
    );

    const goi = async (answers) =>
      (await c.query("SELECT public.complete_book($1, $2::smallint[]) AS r", [SLUG, answers]))
        .rows[0].r;
    const soVatPham = async () =>
      Number(
        (await c.query("SELECT count(*) AS n FROM public.user_items WHERE user_id = $1", [userA]))
          .rows[0].n,
      );

    const truoc = await soVatPham();

    // 1) Sai cả hai câu.
    const sai = await goi([0, 1]);
    check(sai.quizPassed === false && sai.grantedItemSlug === null,
      "trả lời SAI: không trao vật phẩm",
      `nhận ${JSON.stringify(sai)}`);
    check(JSON.stringify(sai.wrongPositions) === "[1,2]",
      "trả lời SAI: chỉ đúng hai câu sai để học sinh biết đọc lại chỗ nào",
      `wrongPositions=${JSON.stringify(sai.wrongPositions)}, chờ [1,2]`);

    // 2) Đúng một câu, sai một câu — "gần đúng" vẫn là chưa đạt.
    const nua = await goi([1, 1]);
    check(nua.quizPassed === false && JSON.stringify(nua.wrongPositions) === "[2]",
      "đúng một nửa vẫn KHÔNG được trao vật phẩm",
      `nhận ${JSON.stringify(nua)}`);

    // 3) Bỏ trống (mảng rỗng) là SAI, không phải là được bỏ qua. Đây là đường đi tự
    //    nhiên nhất của một client cũ chưa biết gì về bài kiểm tra.
    const trong = await goi([]);
    check(trong.quizPassed === false && JSON.stringify(trong.wrongPositions) === "[1,2]",
      "không trả lời gì: tính là sai, không phải là miễn bài",
      `nhận ${JSON.stringify(trong)}`);

    check((await soVatPham()) === truoc,
      "sau ba lần trượt: túi vật phẩm KHÔNG hề nhúc nhích",
      "một lần trượt vẫn kịp trao vật phẩm — hàng rào vô nghĩa");

    // 4) Đúng hết mới trao.
    const dung = await goi([1, 0]);
    check(dung.quizPassed === true && dung.grantedItemSlug !== null,
      "trả lời ĐÚNG HẾT: mới trao vật phẩm",
      `nhận ${JSON.stringify(dung)}`);
    check((await soVatPham()) === truoc + 1,
      "trả lời ĐÚNG HẾT: túi vật phẩm tăng đúng một",
      `${truoc} → ${await soVatPham()}`);

    // 5) Quyển KHÔNG có câu hỏi nào vẫn hoàn thành được như trước — 13 quyển đang xuất
    //    bản đều đang ở trạng thái này, nên đây không phải trường hợp hiếm.
    await c.query("SELECT set_config('app.user_id', $1, true)", [ADMIN_DECOY]);
    await c.query("DELETE FROM public.book_questions WHERE book_slug = $1", [SLUG]);
    await c.query("SELECT set_config('app.user_id', $1, true)", [userB]);
    await c.query(
      `INSERT INTO public.user_book_progress (user_id, book_slug, current_page)
            SELECT $1, $2, (SELECT count(*) FROM public.pages WHERE book_slug = $2)
       ON CONFLICT (user_id, book_slug) DO UPDATE SET current_page = EXCLUDED.current_page`,
      [userB, SLUG],
    );
    const khongCauHoi = (
      await c.query("SELECT public.complete_book($1, '{}'::smallint[]) AS r", [SLUG])
    ).rows[0].r;
    check(khongCauHoi.quizPassed === true && khongCauHoi.grantedItemSlug !== null,
      "quyển KHÔNG có câu hỏi: vẫn trao vật phẩm như trước",
      `nhận ${JSON.stringify(khongCauHoi)}`);
  } catch (e) {
    bad("bài trắc nghiệm chặn được việc trao vật phẩm", `${e.code} "${e.message}"`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
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

// ---------------------------------------------------------------------------
// Bảng tin cộng đồng (content.md §6)
// ---------------------------------------------------------------------------
console.log("\n-- Bảng tin cộng đồng --");

{
  // Một vòng tròn thật auth-ghi → anon-đọc. Tạo cả bài lẫn bình luận ngay trong
  // transaction làm mồi nhử; bảng rỗng vẫn kiểm được policy đọc, không có phép đếm
  // rỗng nghĩa. INSERT bài phải tự kích hoạt ghi hoạt động; bình luận thì không.
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL ROLE chronoshelf_auth");
    await c.query("SELECT set_config('app.user_id', $1, true)", [userA]);
    const post = await c.query(
      `INSERT INTO public.community_posts (author_id, kind, body)
       VALUES ($1, 'cau-hoi', 'Trận Bạch Đằng diễn ra năm nào?') RETURNING id`,
      [userA],
    );
    const activityA = await c.query(
      `SELECT count(*)::int AS n FROM public.user_activity
       WHERE user_id=$1 AND active_on=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
      [userA],
    );

    await c.query("SELECT set_config('app.user_id', $1, true)", [userB]);
    await c.query(
      `INSERT INTO public.community_comments (post_id, author_id, body)
       VALUES ($1, $2, 'Năm 938.')`,
      [post.rows[0].id, userB],
    );
    const activityB = await c.query(
      "SELECT count(*)::int AS n FROM public.user_activity WHERE user_id=$1",
      [userB],
    );

    await c.query("SELECT set_config('app.user_id', '', true)");
    await c.query("SET LOCAL ROLE chronoshelf_anon");
    const visible = await c.query(
      `SELECT count(*)::int AS n
         FROM public.community_posts p
         JOIN public.community_comments c ON c.post_id=p.id
        WHERE p.id=$1`,
      [post.rows[0].id],
    );
    check(visible.rows[0].n === 1,
      "auth đăng bài + bình luận, rồi anon đọc lại được cả hai",
      `anon thấy ${visible.rows[0].n} cặp, chờ 1`);
    check(activityA.rows[0].n === 1,
      "đăng bài ghi đúng một ngày hoạt động cho tác giả",
      `nhận ${activityA.rows[0].n} dòng, chờ 1`);
    check(activityB.rows[0].n === 0,
      "bình luận không tự tính thành nhiệm vụ giữ chuỗi",
      `nhận ${activityB.rows[0].n} dòng, chờ 0`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
  }
}

await denied(
  "người chưa đăng nhập không đăng được bài",
  "chronoshelf_anon",
  "INSERT INTO public.community_posts (author_id,kind,body) VALUES (gen_random_uuid(),'chia-se','x')",
  "permission denied for table community_posts",
);
await denied(
  "người chưa đăng nhập không bình luận được",
  "chronoshelf_anon",
  "INSERT INTO public.community_comments (post_id,author_id,body) VALUES (gen_random_uuid(),gen_random_uuid(),'x')",
  "permission denied for table community_comments",
);

await deniedByPolicy(
  "không đăng bài mạo danh người khác",
  userA,
  `INSERT INTO public.community_posts (author_id,kind,body)
   VALUES ('${userB}','chia-se','mạo danh')`,
);

{
  const name = "không bình luận mạo danh người khác";
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL ROLE chronoshelf_auth");
    await c.query("SELECT set_config('app.user_id', $1, true)", [userA]);
    const post = await c.query(
      `INSERT INTO public.community_posts (author_id,kind,body)
       VALUES ($1,'chia-se','bài mồi') RETURNING id`,
      [userA],
    );
    await c.query(
      `INSERT INTO public.community_comments (post_id,author_id,body)
       VALUES ($1,$2,'mạo danh')`,
      [post.rows[0].id, userB],
    );
    bad(name, "GHI ĐƯỢC — policy nhận author_id từ client");
  } catch (e) {
    check(e.code === "42501" && /row-level security policy/.test(e.message), name,
      `chờ 42501 do policy, nhận ${e.code} "${e.message}"`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
  }
}

for (const [name, constraint, sql] of [
  [
    "bài chỉ có khoảng trắng bị ràng buộc DB chặn",
    "community_posts_body_ck",
    `INSERT INTO public.community_posts (author_id,kind,body)
     VALUES ('${userA}','chia-se',E'  \\n  ')`,
  ],
  [
    "loại bài ngoài allowlist bị ràng buộc DB chặn",
    "community_posts_kind_ck",
    `INSERT INTO public.community_posts (author_id,kind,body)
     VALUES ('${userA}','khac','x')`,
  ],
  [
    "bình luận quá 500 ký tự bị ràng buộc DB chặn",
    "community_comments_body_ck",
    `WITH p AS (
       INSERT INTO public.community_posts (author_id,kind,body)
       VALUES ('${userA}','chia-se','bài mồi') RETURNING id
     )
     INSERT INTO public.community_comments (post_id,author_id,body)
     SELECT id,'${userA}',repeat('x',501) FROM p`,
  ],
]) {
  try {
    await asRoleUndo("chronoshelf_auth", userA, [sql]);
    bad(name, "GHI ĐƯỢC");
  } catch (e) {
    check(e.code === "23514" && e.constraint === constraint, name,
      `chờ 23514 constraint=${constraint}, nhận ${e.code} constraint=${e.constraint} "${e.message}"`);
  }
}


// ---------------------------------------------------------------------------
// Thư viện bài giảng (content.md §7)
// ---------------------------------------------------------------------------
console.log("\n-- Thư viện bài giảng --");

/** Gói ZIP 4 byte — đúng thứ `laGoiZip()` nhận, đủ để làm mồi nhử cho `documents`. */
const ZIP4 = "\\x504b0304";
const DOC_SHA = "d".repeat(64);

{
  // Vòng tròn thật admin-ghi → anon-đọc, cho CẢ tài liệu lẫn bài giảng đã xuất bản.
  // Bảng rỗng vẫn kiểm được policy đọc, nên không có phép đếm rỗng nghĩa nào ở đây.
  await c.query("BEGIN");
  try {
    await c.query("SET LOCAL ROLE chronoshelf_auth");
    await c.query("SELECT set_config('app.user_id', $1, true)", [ADMIN_DECOY]);
    await c.query(
      `INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
       VALUES ($1, 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
               'bai-giang.pptx', $2::bytea, 4)`,
      [DOC_SHA, ZIP4],
    );
    await c.query(
      `INSERT INTO public.lessons (slug, grade, title, slide_sha256, slide_filename, published)
       VALUES ('dbcheck-bai', 10, 'Bài mồi nhử', $1, 'bai-giang.pptx', true)`,
      [DOC_SHA],
    );
    await c.query(
      `INSERT INTO public.lessons (slug, grade, title, published)
       VALUES ('dbcheck-nhap', 11, 'Bài còn nháp', false)`,
    );

    await c.query("SELECT set_config('app.user_id', '', true)");
    await c.query("SET LOCAL ROLE chronoshelf_anon");

    const doc = await c.query(
      "SELECT octet_length(bytes)::int AS n FROM public.documents WHERE sha256=$1",
      [DOC_SHA],
    );
    check(doc.rows[0]?.n === 4,
      "người chưa đăng nhập TẢI ĐƯỢC bộ slide (content.md §7: tải về miễn phí)",
      `nhận ${doc.rows[0]?.n ?? "không có dòng nào"}, chờ 4 byte`);

    const daXuatBan = await c.query(
      "SELECT count(*)::int AS n FROM public.lessons WHERE slug='dbcheck-bai'",
    );
    check(daXuatBan.rows[0].n === 1,
      "người chưa đăng nhập đọc được bài giảng đã xuất bản",
      `thấy ${daXuatBan.rows[0].n} dòng, chờ 1`);

    const conNhap = await c.query(
      "SELECT count(*)::int AS n FROM public.lessons WHERE slug='dbcheck-nhap'",
    );
    check(conNhap.rows[0].n === 0,
      "người chưa đăng nhập KHÔNG đọc được bài giảng còn nháp",
      `thấy ${conNhap.rows[0].n} dòng, chờ 0`);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
  }
}

await denied(
  "người chưa đăng nhập không tải tài liệu lên được",
  "chronoshelf_anon",
  `INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
   VALUES ('${"e".repeat(64)}',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation',
           'x.pptx', '${ZIP4}'::bytea, 4)`,
  "permission denied for table documents",
);

// Bảng CHỈ-GHI-THÊM. Hàng rào ở đây là chính GRANT, không phải policy — nên thông điệp
// đúng phải là "permission denied for table". Nếu một ngày nó đổi thành "violates
// row-level security policy" thì nghĩa là ai đó vừa CẤP THÊM GRANT UPDATE/DELETE, đúng
// thứ phải nổ. (Bài học 3 trong CLAUDE.md: mỗi hàng rào khẳng định theo cơ chế của CHÍNH NÓ.)
await denied(
  "không SỬA được dòng documents đã có — chặn ở tầng GRANT",
  "chronoshelf_auth",
  "UPDATE public.documents SET filename = 'doi.pptx'",
  "permission denied for table documents",
);
await denied(
  "không XÓA được dòng documents đã có — chặn ở tầng GRANT",
  "chronoshelf_auth",
  "DELETE FROM public.documents",
  "permission denied for table documents",
);

await deniedByPolicy(
  "người thường không tải tài liệu lên được",
  userA,
  `INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
   VALUES ('${"f".repeat(64)}',
           'application/vnd.openxmlformats-officedocument.presentationml.presentation',
           'x.pptx', '${ZIP4}'::bytea, 4)`,
);
await deniedByPolicy(
  "người thường không tạo được bài giảng",
  userA,
  "INSERT INTO public.lessons (slug, grade, title) VALUES ('dbcheck-lop', 10, 'x')",
);

// Ràng buộc dữ liệu: ĐÚNG check_violation VÀ ĐÚNG tên ràng buộc. 42501 ở đây nghĩa là
// mồi nhử mất quyền admin và phép kiểm đang đo nhầm lớp — cũng là hỏng.
for (const [name, conname, sql] of [
  [
    "admin cũng không ghi được sơ đồ tư duy thiếu credit",
    "lessons_mindmap_credit_ck",
    `INSERT INTO public.lessons (slug, grade, title, mindmap_url)
     VALUES ('dbcheck-mm', 10, 'x', '/media/${FAKE_SHA}')`,
  ],
  [
    "admin cũng không ghi được ảnh xem trước thiếu credit",
    "lessons_preview_credit_ck",
    `INSERT INTO public.lessons (slug, grade, title, preview_url)
     VALUES ('dbcheck-pv', 10, 'x', '/media/${FAKE_SHA}')`,
  ],
  [
    "khối lớp ngoài 10/11/12 bị ràng buộc DB chặn",
    "lessons_grade_check",
    "INSERT INTO public.lessons (slug, grade, title) VALUES ('dbcheck-g', 9, 'x')",
  ],
  [
    "có tệp slide mà thiếu tên tệp bị chặn — Content-Disposition không được rỗng",
    "lessons_slide_filename_ck",
    `WITH d AS (
       INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
       VALUES ('${"a".repeat(63)}9',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation',
               'x.pptx', '${ZIP4}'::bytea, 4)
       RETURNING sha256
     )
     INSERT INTO public.lessons (slug, grade, title, slide_sha256)
     SELECT 'dbcheck-sf', 10, 'x', sha256 FROM d`,
  ],
]) {
  try {
    await asRoleUndo("chronoshelf_auth", ADMIN_DECOY, [sql]);
    bad(name, "GHI ĐƯỢC — ràng buộc không chặn");
  } catch (e) {
    check(e.code === "23514" && e.constraint === conname, name,
      `chờ 23514 constraint=${conname}, nhận ${e.code} constraint=${e.constraint} "${e.message}"`);
  }
}

// Trần 25 MiB phải neo vào byte THẬT, không phải vào con số người ghi tự khai.
{
  const name = "byte_len của documents không khai man được";
  try {
    await asRoleUndo("chronoshelf_auth", ADMIN_DECOY, [
      `INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
       VALUES ('${"b".repeat(64)}',
               'application/vnd.openxmlformats-officedocument.presentationml.presentation',
               'x.pptx', '${ZIP4}'::bytea, 1)`,
    ]);
    bad(name, "GHI ĐƯỢC — trần 25 MiB là trần giả");
  } catch (e) {
    check(e.code === "23514" && e.constraint === "documents_byte_len_thuc_ck", name,
      `chờ 23514 constraint=documents_byte_len_thuc_ck, nhận ${e.code} constraint=${e.constraint}`);
  }
}

// Đối chứng: GRANT phải còn nguyên, nếu không thì mọi phép trên đạt vì lý do sai —
// admin thật cũng ghi hỏng — chứ không phải vì ràng buộc chặn.
try {
  await asRoleUndo("chronoshelf_auth", ADMIN_DECOY, [
    `INSERT INTO public.lessons (slug, grade, title, mindmap_url, mindmap_source, mindmap_credit)
     VALUES ('dbcheck-ok', 12, 'x', '/media/${FAKE_SHA}', 'src', 'cc')`,
  ]);
  ok("đối chứng: admin tạo ĐƯỢC bài giảng có đủ credit (GRANT còn nguyên)");
} catch (e) {
  bad("đối chứng: admin tạo ĐƯỢC bài giảng có đủ credit (GRANT còn nguyên)",
    `${e.code} "${e.message}"`);
}

console.log(`\n${pass} đạt / ${fail} hỏng`);
await c.end();
process.exit(fail ? 1 : 0);
