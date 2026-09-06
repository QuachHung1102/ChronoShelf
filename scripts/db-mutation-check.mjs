/**
 * Kiểm thử đột biến cho `db/schema/90-verify.sql`.
 *
 * Một file tự kiểm luôn xanh và một file tự kiểm đã mục ruỗng trông giống hệt nhau.
 * Dự án này đã bị chính chuyện đó cắn hai lần (xem CLAUDE.md, "Bẫy đã gặp"), nên
 * hàng rào cần một hàng rào: script này lần lượt PHÁ từng thứ mà 90-verify.sql tuyên
 * bố là mình canh, chạy lại nó, và đòi nó phải NỔ đúng chỗ. Đột biến nào lọt qua
 * nghĩa là khẳng định tương ứng đã vô nghĩa.
 *
 * MỖI ĐỘT BIẾN NẰM TRONG MỘT TRANSACTION RỒI ROLLBACK — không có cột "SQL trả lại".
 * Bản trước phá ở chế độ autocommit rồi tự trả lại bằng một câu SQL thứ hai, nên đứt
 * giữa chừng (Ctrl+C, mất kết nối, hoặc chính câu trả lại nổ) là để hở VĨNH VIỄN trên
 * database thật — đã đo: sau khi tiến trình chết, một kết nối MỚI vẫn thấy lỗ hổng, và
 * một trong bảy đột biến là `GRANT EXECUTE ON _complete_book_for` (SECURITY DEFINER,
 * nhận user_id tùy ý — đặc quyền nguy hiểm nhất của cả dự án). DDL trong Postgres là
 * transactional, nên transaction chưa commit là lưới an toàn tự động: tiến trình chết
 * giữa chừng thì Postgres tự hoàn tác lúc connection đứt. Vì vậy ở đây KHÔNG cần
 * process.on("SIGINT").
 *
 * BEGIN / phá / verify / ROLLBACK phải là NHỮNG LỜI GỌI query() RIÊNG. Gửi cả bốn như
 * MỘT chuỗi thì khi verify nổ, Postgres bỏ qua phần còn lại của cùng một simple-query
 * message — chính chữ ROLLBACK đó KHÔNG BAO GIỜ CHẠY, phiên kẹt ở 25P02 và mọi đột biến
 * sau đó hỏng dây chuyền. Đã đo cả hai nhánh.
 *
 * MỘT ĐỘT BIẾN CHỈ PHỦ ĐƯỢC MỘT KHẲNG ĐỊNH: cả 90-verify.sql chạy trong một query() và
 * Postgres dừng ở RAISE đầu tiên. Muốn phủ thêm một khẳng định thì thêm một dòng ở đây.
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

/** [tên, SQL phá, chuỗi bắt buộc có trong thông điệp lỗi] */
const MUTATIONS = [
  ["chronoshelf_app được INHERIT", "ALTER ROLE chronoshelf_app INHERIT", "đang INHERIT"],
  [
    "người chưa đăng nhập đọc được user_roles",
    "GRANT SELECT ON public.user_roles TO chronoshelf_anon",
    "người chưa đăng nhập đọc được",
  ],
  [
    'policy "own role select" nới thành USING (true)',
    `DROP POLICY "own role select" ON public.user_roles;
     CREATE POLICY "own role select" ON public.user_roles FOR SELECT USING (true)`,
    "own role select",
  ],
  [
    'policy "admin write" nới thành is_admin() OR true',
    `DROP POLICY "admin write" ON public.books;
     CREATE POLICY "admin write" ON public.books FOR ALL
       USING (public.is_admin() OR true) WITH CHECK (public.is_admin() OR true)`,
    "admin write",
  ],
  [
    "người chưa đăng nhập ghi được books",
    "GRANT INSERT ON public.books TO chronoshelf_anon",
    // KHÔNG dùng "người chưa đăng nhập ghi được": chuỗi đó khớp cả khẳng định của media.
    "ghi được books",
  ],
  [
    // Đột biến này giữ ACCESS EXCLUSIVE trên public.books suốt lượt chạy verifySql thay vì
    // nhả ngay như bản autocommit cũ. Trên DB dev là vài chục ms; nếu có ai đang mở app
    // trên cùng database thì truy vấn vào books sẽ chờ chừng đó. Chấp nhận được.
    "ràng buộc vị trí hạ xuống INITIALLY IMMEDIATE",
    `ALTER TABLE public.books DROP CONSTRAINT books_shelf_position_key;
     ALTER TABLE public.books ADD CONSTRAINT books_shelf_position_key
       UNIQUE (shelf_slug, position) DEFERRABLE INITIALLY IMMEDIATE`,
    "DEFERRABLE INITIALLY DEFERRED",
  ],
  [
    "_complete_book_for lộ EXECUTE",
    "GRANT EXECUTE ON FUNCTION public._complete_book_for(uuid, text, smallint[]) TO chronoshelf_auth",
    "lộ EXECUTE",
  ],

  // --- mục B2: bài trắc nghiệm cuối sách. Đáp án là thứ duy nhất trong nội dung phải
  // giấu, nên cả ba đường làm lộ nó đều phải có một đột biến riêng.
  [
    "đáp án được cấp SELECT cho role ứng dụng",
    "GRANT SELECT (correct_index) ON public.book_questions TO chronoshelf_auth",
    "bài trắc nghiệm chỉ còn là trang trí",
  ],
  [
    // Đúng cái bẫy mà `CREATE OR REPLACE` giăng sẵn: chữ ký mới chỉ NẠP CHỒNG, bản cũ
    // ở lại và vẫn trao vật phẩm mà không chấm bài. Không có khẳng định đếm tham số
    // thì không cổng nào thấy được cửa thứ hai này.
    "chữ ký complete_book một-tham-số sống lại",
    `CREATE FUNCTION public.complete_book(text) RETURNS jsonb
       LANGUAGE sql SECURITY DEFINER AS 'SELECT ''{}''::jsonb'`,
    "bản nạp chồng cũ",
  ],
  [
    "admin_book_questions mất dòng kiểm is_admin()",
    `CREATE OR REPLACE FUNCTION public.admin_book_questions(p_book_slug text)
       RETURNS TABLE (id uuid, "position" integer, prompt text, choices text[], correct_index smallint)
       LANGUAGE sql SECURITY DEFINER AS
       $m$ SELECT q.id, q.position, q.prompt, q.choices, q.correct_index
             FROM public.book_questions q WHERE q.book_slug = p_book_slug $m$`,
    "ai đăng nhập cũng đọc được đáp án",
  ],
  [
    "reorder_books đổi thành SECURITY DEFINER",
    "ALTER FUNCTION public.reorder_books(text, text[]) SECURITY DEFINER",
    "SECURITY DEFINER",
  ],
  [
    "bảng login_codes của luồng OTP được dựng lại",
    `CREATE TABLE public.login_codes (id uuid PRIMARY KEY DEFAULT gen_random_uuid())`,
    "login_codes vẫn còn",
  ],
  [
    "hàm OTP được dựng lại",
    `CREATE FUNCTION app.consume_login_code(text, text) RETURNS uuid
       LANGUAGE sql SECURITY DEFINER AS 'SELECT NULL::uuid'`,
    "hàm OTP vẫn còn",
  ],
  [
    "chronoshelf_auth được GRANT UPDATE trên users",
    "GRANT UPDATE ON public.users TO chronoshelf_auth",
    "tự gỡ khóa hoặc tự đổi mật khẩu người khác",
  ],
  [
    "ket_thuc_dang_nhap hạ xuống SECURITY INVOKER",
    `ALTER FUNCTION app.ket_thuc_dang_nhap(text, text) SECURITY INVOKER`,
    "không còn là SECURITY DEFINER",
  ],
  [
    "chronoshelf_auth được cấp EXECUTE hàm đăng nhập",
    "GRANT EXECUTE ON FUNCTION app.bat_dau_dang_nhap(text) TO chronoshelf_auth",
    "bề mặt thừa",
  ],
  [
    "chronoshelf_anon MẤT quyền gọi hàm đăng nhập",
    "REVOKE EXECUTE ON FUNCTION app.ket_thuc_dang_nhap(text, text) FROM chronoshelf_anon",
    "không ai đăng nhập được",
  ],
  [
    "allowlist câu hỏi bảo mật mọc thêm một mã",
    `ALTER TABLE public.users DROP CONSTRAINT users_security_question_ck;
     ALTER TABLE public.users ADD CONSTRAINT users_security_question_ck
       CHECK (security_question IN ('truong-tieu-hoc','ban-than-lop-mot','ten-thu-cung',
                                    'giao-vien-lop-mot','mon-an-ghet','bai-hat-thuoc-dau','them-mot'))`,
    "allowlist câu hỏi bảo mật",
  ],
  [
    "users mất ràng buộc bắt-buộc-có-mật-khẩu",
    "ALTER TABLE public.users DROP CONSTRAINT users_credentials_ck",
    "users_credentials_ck thiếu",
  ],

  // --- mục D: kho ảnh. Trước đây không đột biến nào chạm tới, nên cả mục chưa bao giờ
  // được chứng minh là biết kêu — và phép chống SVG thì thật sự đã mục ruỗng.
  [
    "media mất allowlist mime — SVG lọt vào",
    "ALTER TABLE public.media DROP CONSTRAINT media_mime_check",
    "allowlist mime của media",
  ],
  [
    "media không còn chỉ-ghi-thêm",
    "GRANT UPDATE ON public.media TO chronoshelf_auth",
    "chỉ-ghi-thêm",
  ],
  [
    "media.byte_len mất ràng buộc neo vào octet_length",
    "ALTER TABLE public.media DROP CONSTRAINT media_byte_len_thuc_ck",
    "trần giả",
  ],
  [
    "shelves mất ràng buộc bìa-phải-có-credit",
    "ALTER TABLE public.shelves DROP CONSTRAINT shelves_cover_credit_ck",
    "items/books/pages/shelves",
  ],
  [
    'policy "read media" bị siết lại',
    `DROP POLICY "read media" ON public.media;
     CREATE POLICY "read media" ON public.media FOR SELECT USING (public.is_admin())`,
    "ảnh sẽ vỡ hết",
  ],

  // --- mục E: tiến độ đọc + túi vật phẩm.
  [
    "chronoshelf_auth được GRANT UPDATE (completed)",
    "GRANT UPDATE (completed) ON public.user_book_progress TO chronoshelf_auth",
    "ghi được cột completed",
  ],
  [
    // Policy cũ vẫn nguyên vẹn, nên phép so khớp biểu thức vẫn xanh — chỉ phép ĐẾM bắt
    // được. Đã tái hiện thật: thêm một policy SELECT USING (true) bên cạnh thì A đọc
    // được cả dòng của B trong khi mọi khẳng định "qual còn đúng" vẫn báo đạt.
    "user_items mọc thêm một policy USING (true)",
    `CREATE POLICY "leak" ON public.user_items FOR SELECT USING (true)`,
    "chờ đúng 4",
  ],
  // --- mục F: chuỗi giữ lửa.
  [
    "chronoshelf_auth được GRANT INSERT trên user_activity",
    "GRANT INSERT ON public.user_activity TO chronoshelf_auth",
    "ghi được user_activity",
  ],
  [
    "record_activity hạ xuống SECURITY INVOKER",
    "ALTER FUNCTION public.record_activity() SECURITY INVOKER",
    "SECURITY DEFINER",
  ],

  // --- mục G: bảng tin cộng đồng.
  [
    "chronoshelf_auth được GRANT UPDATE trên community_posts",
    "GRANT UPDATE ON public.community_posts TO chronoshelf_auth",
    "chỉ-ghi-thêm",
  ],
  [
    'policy "own community post insert" nới thành WITH CHECK (true)',
    `DROP POLICY "own community post insert" ON public.community_posts;
     CREATE POLICY "own community post insert" ON public.community_posts
       FOR INSERT WITH CHECK (true)`,
    "policy bảng tin",
  ],
  [
    "community_comments mọc thêm policy SELECT",
    `CREATE POLICY "leak" ON public.community_comments FOR SELECT USING (true)`,
    "chờ đúng 4",
  ],
  [
    "community_posts đổi ràng buộc nội dung thành CHECK luôn đúng",
    `ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_body_ck;
     ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_body_ck CHECK (true)`,
    "ràng buộc CHECK của bảng tin",
  ],
  [
    "community_posts mất trigger giữ lửa",
    "DROP TRIGGER community_post_records_activity ON public.community_posts",
    "trigger giữ lửa",
  ],

  // --- mục H: thư viện bài giảng.
  [
    "chronoshelf_auth được GRANT UPDATE trên documents",
    "GRANT UPDATE ON public.documents TO chronoshelf_auth",
    "chỉ-ghi-thêm",
  ],
  [
    "documents mất allowlist mime — nhận được tệp bất kỳ",
    `ALTER TABLE public.documents DROP CONSTRAINT documents_mime_check`,
    "allowlist mime của documents",
  ],
  [
    "documents.byte_len mất ràng buộc neo vào octet_length",
    "ALTER TABLE public.documents DROP CONSTRAINT documents_byte_len_thuc_ck",
    "trần 25 MiB thành trần giả",
  ],
  [
    'policy "read documents" bị siết lại',
    `DROP POLICY "read documents" ON public.documents;
     CREATE POLICY "read documents" ON public.documents FOR SELECT USING (public.is_admin())`,
    "mọi liên kết tải về sẽ chết",
  ],
  [
    "người chưa đăng nhập mất quyền tải slide về",
    "REVOKE SELECT ON public.documents FROM chronoshelf_anon",
    "slide thành thứ phải đăng nhập mới có",
  ],
  [
    'policy "read published" của lessons nới thành USING (true)',
    `DROP POLICY "read published" ON public.lessons;
     CREATE POLICY "read published" ON public.lessons FOR SELECT USING (true)`,
    "read published",
  ],
  [
    'policy "admin write" của lessons nới thành is_admin() OR true',
    `DROP POLICY "admin write" ON public.lessons;
     CREATE POLICY "admin write" ON public.lessons FOR ALL
       USING (public.is_admin() OR true) WITH CHECK (public.is_admin() OR true)`,
    "admin write",
  ],
  [
    "lessons mất ràng buộc ảnh-phải-có-credit",
    "ALTER TABLE public.lessons DROP CONSTRAINT lessons_mindmap_credit_ck",
    "ảnh-phải-có-nguồn-và-tác-giả trên lessons",
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

for (const [name, breakSql, expect] of MUTATIONS) {
  let broke = null; // lỗi của chính câu SQL phá
  let caught = null; // thông điệp 90-verify.sql nổ ra

  await client.query("BEGIN");
  try {
    try {
      await client.query(breakSql);
    } catch (e) {
      broke = e.message;
    }
    if (broke === null) {
      try {
        await client.query(verifySql);
      } catch (e) {
        caught = e.message;
      }
    }
  } finally {
    // Hợp lệ cả khi transaction đang aborted, và là thứ DUY NHẤT trả database về nguyên trạng.
    await client.query("ROLLBACK");
  }

  if (broke !== null) {
    // Bắt riêng lỗi của breakSql. Nuốt chung vào cùng một catch thì một câu phá hỏng có
    // thể sinh thông điệp tình cờ chứa `expect` — ví dụ đột biến "SECURITY DEFINER" — và
    // phép kiểm báo PASS trong khi không hề đo được gì.
    console.log(
      `  FAIL  ${name}\n        câu SQL phá không chạy được: "${broke}"` +
        `\n        (đột biến chưa hề xảy ra — không kết luận được gì về 90-verify.sql)`,
    );
    fail++;
  } else if (caught === null) {
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

// Phép hút thuốc rẻ tiền: mọi đột biến đã nằm trong transaction bị ROLLBACK nên không còn
// gì để hoàn tác. Cái nó thật sự bắt là phiên bị kẹt ở một transaction dở dang (25P02).
try {
  await client.query(verifySql);
  console.log("\n  PASS  sau cùng: phiên vẫn dùng được, không kẹt transaction dở dang");
  pass++;
} catch (e) {
  console.log(`\n  FAIL  sau cùng: phiên không còn sạch — ${e.message}`);
  fail++;
}

console.log(`\n${pass} đạt / ${fail} hỏng`);
await client.end();
process.exit(fail ? 1 : 0);
