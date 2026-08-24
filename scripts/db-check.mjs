#!/usr/bin/env node
/**
 * Self-check các ranh giới bảo mật ở tầng DB, chạy bằng đúng khóa `anon` mà trình duyệt
 * cầm. Kiểm "kẻ chưa đăng nhập KHÔNG làm được gì" — phần mà `npm run check` không với tới
 * vì nó cần backend thật.
 *
 * Vì sao không phải một file .sql chạy qua MCP `run-raw-sql`: SQL chạy bằng quyền admin,
 * nên nó kiểm được `has_function_privilege` nhưng không kiểm được thứ thật sự quan trọng —
 * cái mà một request thật từ ngoài Internet làm được. Script này đi đúng đường của kẻ tấn
 * công. Nó cũng không cần MCP, nên chạy được cả khi MCP không kết nối.
 *
 *   npm run db:check
 *
 * KHÔNG nằm trong `npm run check`: cần mạng và backend sống. Chạy nó sau khi đổi bất cứ
 * thứ gì trong db/schema/ — RLS, GRANT, hay thân hàm RPC.
 */
import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !anonKey) {
  console.error(
    "Thiếu NEXT_PUBLIC_INSFORGE_BASE_URL hoặc NEXT_PUBLIC_INSFORGE_ANON_KEY.\n" +
      "Script đọc chúng từ .env.local — file đó bị gitignore nên máy mới clone phải tạo lại.",
  );
  process.exit(1);
}

const anon = createClient({ baseUrl, anonKey });

// Slug bịa để nếu một phép ghi lọt qua thì dòng rác còn nhận ra được mà xóa.
const SENTINEL = "__db_check_khong_duoc_ton_tai";
const FAKE_UUID = "00000000-0000-0000-0000-000000000000";

const results = [];
let skipped = 0;

/** `expect` mô tả điều PHẢI đúng; trả về chuỗi lý do khi sai, hoặc null khi đạt. */
async function check(name, run, expect) {
  let outcome;
  try {
    outcome = await run();
  } catch (e) {
    outcome = { error: e instanceof Error ? e : new Error(String(e)) };
  }
  const reason = expect(outcome);
  results.push({ name, ok: reason === null, reason, outcome });
}

function errorLabel(error) {
  if (!error) return "không có lỗi";
  const code = error.error ?? error.code ?? "";
  return `${code ? code + " " : ""}${error.message ?? String(error)}`.slice(0, 120);
}

// --- Phép 1 đổi bảng: book_unlocks không còn, kệ nay đọc từ `books` ------------
// (thay thế nguyên khối check "anon ĐỌC ĐƯỢC book_unlocks")
await check(
  "anon ĐỌC ĐƯỢC books đã xuất bản (kệ phải hiện ra khi chưa đăng nhập)",
  () => anon.database.from("books").select("slug, published"),
  ({ data, error }) =>
    error
      ? `bị chặn: ${errorLabel(error)}`
      : (data ?? []).length > 0
        ? null
        : "không đọc được quyển nào",
);

await check(
  "anon KHÔNG ghi được user_items (chỉ RPC SECURITY DEFINER được trao vật phẩm)",
  () =>
    anon.database
      .from("user_items")
      .insert([{ user_id: FAKE_UUID, item_slug: SENTINEL }]),
  ({ error }) => (error ? null : "GHI ĐƯỢC — ai cũng tự phát vật phẩm cho mình được"),
);

await check(
  "anon KHÔNG ghi được user_book_progress (GRANT chỉ cấp cho authenticated)",
  () =>
    anon.database
      .from("user_book_progress")
      .insert([{ user_id: FAKE_UUID, book_slug: SENTINEL }]),
  ({ error }) => (error ? null : "GHI ĐƯỢC khi chưa đăng nhập"),
);

// Slug THẬT, đã xuất bản — KHÔNG dùng slug bịa. Slug bịa (bản cũ dùng "bach-dang-938",
// không tồn tại — slug đúng là "tran-chien-bach-dang-938") khiến MỌI kết quả, kể cả một
// lời gọi đã lọt qua REVOKE, đều dừng ở "Book not found" — một lỗi có thật nhưng không
// nói lên gì về quyền — nên phép kiểm "có lỗi là đạt" báo PASS ngay cả khi lỗ nghiêm
// trọng nhất đã mở toang.
const REAL_BOOK_SLUG = "khoi-nguon-bo-coi";

/**
 * true khi lỗi ĐÚNG LÀ quyền EXECUTE bị chặn tại cổng (REVOKE hoạt động đúng) — không
 * phải BẤT KỲ lỗi nào khác phát sinh từ bên trong thân hàm.
 *
 * Bản đầu của phép kiểm này chỉ loại trừ message "Book not found", dựa trên giả định
 * lời gọi lọt qua sẽ dừng ở SELECT đầu tiên trong hàm. Giả định đó SAI: đã kiểm thực
 * nghiệm ngày 2026-08-25 bằng cách tạm `GRANT EXECUTE ... TO anon` rồi gọi lại đúng
 * phép này — với `p_user_id: FAKE_UUID` (không tồn tại trong auth.users) và slug sách
 * thật, lời gọi đi QUA khỏi "Book not found" (sách có thật) rồi mới hỏng ở bước
 * `INSERT INTO user_book_progress`, vì FAKE_UUID vi phạm khóa ngoại tới auth.users —
 * một lỗi 23503, không phải "Book not found" — nên phép kiểm bản đầu vẫn báo PASS dù
 * quyền đã lộ thật. Sửa lại theo hướng AN TOÀN HƠN: liệt kê CHÍNH XÁC lỗi được coi là
 * "quyền còn nguyên" (42501 + đúng message REVOKE tạo ra), thay vì liệt kê những lỗi bị
 * coi là "đã lộ". Bất kỳ lỗi nào khác — "Book not found", vi phạm khóa ngoại, "Not
 * authenticated", hay không có lỗi gì cả — đều là lời gọi đã chạm được logic bên trong
 * hàm, nên đều phải là FAIL.
 */
function blockedByRevoke(error) {
  const code = error?.code ?? error?.error ?? "";
  const message = error?.message ?? "";
  return code === "42501" && /permission denied for function/i.test(message);
}

await check(
  "anon KHÔNG gọi được _complete_book_for (gọi được là tự trao vật phẩm cho user bất kỳ)",
  () =>
    anon.database.rpc("_complete_book_for", {
      p_user_id: FAKE_UUID,
      p_book_slug: REAL_BOOK_SLUG,
    }),
  ({ error }) => {
    if (!error) return "GỌI ĐƯỢC — đây là lỗ nghiêm trọng nhất có thể có";
    return blockedByRevoke(error)
      ? null
      : `LỌT QUA REVOKE — chạm được logic bên trong hàm (${errorLabel(error)}), EXECUTE bị cấp nhầm cho anon`;
  },
);

await check(
  "anon KHÔNG gọi được complete_book (EXECUTE đã REVOKE khỏi anon)",
  () => anon.database.rpc("complete_book", { p_book_slug: REAL_BOOK_SLUG }),
  ({ error }) => {
    if (!error) return "GỌI ĐƯỢC khi chưa đăng nhập";
    return blockedByRevoke(error)
      ? null
      : `LỌT QUA REVOKE — chạm được logic bên trong hàm (${errorLabel(error)}), EXECUTE bị cấp nhầm cho anon`;
  },
);

await check(
  "anon đọc user_items ra rỗng (REVOKE ALL khỏi anon; đổi grant thì RLS auth.uid() = user_id vẫn lọc rỗng)",
  () => anon.database.from("user_items").select("item_slug"),
  ({ data, error }) => {
    if (!error) return (data?.length ?? 0) === 0 ? null : `đọc ra ${data.length} dòng của người khác`;
    // user_items REVOKE ALL khỏi anon ngay từ 2026-08-12-ke-sach-doc-sach.sql — anon
    // không có cả SELECT, nên đường an toàn LUÔN lỗi 42501 "permission denied for
    // table" (đã kiểm thực nghiệm 2026-08-24), không bao giờ chạy tới nhánh RLS lọc
    // rỗng ở trên. Một lỗi khác (đổi tên bảng, mất mạng, …) không chứng minh được gì
    // nên vẫn phải coi là hỏng — không tự động biến MỌI lỗi thành "đạt".
    const code = error.code ?? error.error ?? "";
    return code === "42501" ? null : `lỗi bất thường: ${errorLabel(error)}`;
  },
);

// --- Phép 7 -------------------------------------------------------------------
// Mồi nhử: một quyển CỐ Ý để nháp vĩnh viễn, tạo ở Step 1. Không có nó thì phép này
// rỗng nghĩa — mọi sách thật đều đã xuất bản nên truy vấn trả 0 dòng kể cả khi RLS
// hỏng hoàn toàn.
const DRAFT_BAIT = "__nhap-khong-bao-gio-xuat-ban";

await check(
  "anon KHÔNG đọc được sách nháp (RLS: published OR is_admin())",
  () => anon.database.from("books").select("slug, published").eq("slug", DRAFT_BAIT),
  ({ data, error }) =>
    error
      ? `lỗi bất thường: ${errorLabel(error)}`
      : (data ?? []).length === 0
        ? null
        : `lộ quyển nháp ${DRAFT_BAIT} — RLS "read published" hỏng`,
);

// --- Phép 8 -------------------------------------------------------------------
await check(
  "anon KHÔNG ghi được user_roles (không ai tự phong admin được)",
  () => anon.database.from("user_roles").insert([{ user_id: FAKE_UUID, role: "admin" }]),
  ({ error }) => (error ? null : "GHI ĐƯỢC — bất kỳ ai cũng thành admin"),
);

// --- Phép 9 -------------------------------------------------------------------
await check(
  "anon KHÔNG ghi được books (nội dung chỉ admin sửa)",
  () =>
    anon.database
      .from("books")
      .insert([{ slug: SENTINEL, shelf_slug: "lich-su-viet-nam", position: 999, title: "x", era: "x" }]),
  ({ error }) =>
    error ? null : "GHI ĐƯỢC — xóa dòng rác " + SENTINEL,
);

// --- Phép 10: phép quan trọng nhất của đợt này --------------------------------
// Đi đúng đường của kẻ tấn công CÓ TÀI KHOẢN. Phải thất bại vì POLICY chặn, chứ
// không phải vì thiếu GRANT — thiếu GRANT thì admin thật cũng ghi hỏng.
//
// CẢNH BÁO: không phân biệt được hai trường hợp đó bằng sqlstate. Postgres trả
// CHUNG mã 42501 cho cả hai, chỉ khác message ("permission denied for table" vs
// "new row violates row-level security policy"). Bắt buộc soi message.
//
// Kiểm hai thứ trong một phiên: không sửa được nội dung, và không tự phong admin.
//
// Khối này BẮT BUỘC nằm CUỐI file: nó tạo một client đã đăng nhập, và đặt nó
// trước các phép dùng `anon` sẽ mở đường cho việc phiên rò sang client kia.
const SENTINEL_AUTH = SENTINEL + "_authed";
const testEmail = process.env.DB_CHECK_USER_EMAIL;
const testPassword = process.env.DB_CHECK_USER_PASSWORD;

if (!testEmail || !testPassword) {
  // 4 phép ghi nội dung (shelves/items/books/pages) + user_items + tự phong admin.
  skipped = 6;
  console.warn(
    "\n!!  BỎ QUA 6 phép cần đăng nhập — thiếu DB_CHECK_USER_EMAIL / DB_CHECK_USER_PASSWORD\n" +
      "!!  trong .env.local. Đây là các hàng rào QUAN TRỌNG NHẤT của tầng nội dung: người\n" +
      "!!  dùng thường không được sửa shelves/items/books/pages, không tự trao được vật\n" +
      "!!  phẩm qua user_items, và không tự phong admin được. Chúng đang KHÔNG được kiểm.\n",
  );
} else {
  const user = createClient({ baseUrl, anonKey });
  const signIn = await user.auth.signInWithPassword({ email: testEmail, password: testPassword });

  // Whole-branch review 2026-08-24, finding E.2: trước đây phép này chỉ thử ghi
  // `books`. Cả 4 bảng nội dung dùng CHUNG policy "admin write" (is_admin() ở cả
  // USING lẫn WITH CHECK — xem tự kiểm Task 2 trong schema) nên hàng rào PHẢI giống
  // hệt nhau ở cả 4 bảng — nhưng một sai lệch riêng ở `shelves`/`items`/`pages` (quên
  // áp policy khi thêm bảng, gõ nhầm tên bảng...) trước đây không bị bất cứ npm script
  // nào bắt: chỉ có khối `DO $$` chạy tay qua MCP soi được tên/biểu thức policy, và nó
  // chạy bằng quyền admin nên không kiểm được thứ một request HTTP THẬT làm được — đúng
  // thứ dòng rủi ro "Người dùng thường sửa được nội dung" trong CLAUDE.md cần. Lặp qua
  // cả 4 bảng để một script duy nhất phủ hết.
  const CONTENT_WRITE_PROBES = [
    { table: "shelves", row: { slug: SENTINEL_AUTH, name: "x", position: 997, published: true } },
    // items không có cột `published` — mọi dòng luôn đọc được (policy "read items"
    // USING (true)), nên không cần mẹo `published: true` để buộc một cú ghi lọt qua
    // phải hiện ra ở bước đọc lại.
    { table: "items", row: { slug: SENTINEL_AUTH, name: "x" } },
    {
      table: "books",
      row: {
        slug: SENTINEL_AUTH,
        shelf_slug: "lich-su-viet-nam",
        position: 998,
        title: "x",
        era: "x",
        // `published: true` KHÔNG phải trang trí — nó là thứ làm phép kiểm này có nghĩa.
        // Nếu thiếu, cột mặc định `false`, và policy đọc `published OR is_admin()` khiến
        // chính phiên non-admin này KHÔNG thấy dòng nó vừa ghi. Khi đó một policy ghi bị
        // hở sẽ cho INSERT thành công không lỗi, đọc lại ra 0 dòng, và phép kiểm báo ĐẠT
        // đúng vào lúc hàng rào bị phá. Ở trạng thái đúng thì `WITH CHECK` chặn trước
        // khi giá trị này kịp có ý nghĩa, nên nó vô hại.
        published: true,
      },
    },
    // pages không có `published` riêng — nó ăn theo published của book cha (policy
    // "read pages"). Trỏ vào một book THẬT đã published (khoi-nguon-bo-coi) vì cùng lý
    // do trên: một cú ghi lọt qua phải đọc lại được bằng đúng phiên non-admin này.
    { table: "pages", row: { book_slug: "khoi-nguon-bo-coi", position: 9998, heading: "x", body: "x" } },
  ];

  for (const { table, row } of CONTENT_WRITE_PROBES) {
    await check(
      `authenticated (không phải admin) KHÔNG ghi được ${table}`,
      async () => {
        if (signIn.error) return { signInError: signIn.error };
        const insert = await user.database.from(table).insert([row]);
        // Lọc đọc lại bằng ĐÚNG mọi cột vừa ghi — `pages` không có cột định danh riêng
        // như `slug`, nên chỉ tổ hợp (book_slug, position) — vốn UNIQUE — mới khớp
        // đúng dòng vừa chèn chứ không phải trang thật nào khác của cùng cuốn sách.
        let readBack = user.database.from(table).select("*");
        for (const [col, val] of Object.entries(row)) readBack = readBack.eq(col, val);
        const back = await readBack;
        return { insert, rows: back.data ?? [], readError: back.error };
      },
      ({ signInError, insert, rows, readError, error }) => {
        // `error` là ngoại lệ do chính `check` bắt, khác với lỗi trong {data,error} của SDK.
        if (error) return `lỗi bất thường: ${errorLabel(error)}`;
        if (signInError) return `không đăng nhập được tài khoản test: ${errorLabel(signInError)}`;
        if ((rows ?? []).length > 0) return `GHI ĐƯỢC — xóa dòng rác khỏi ${table}`;
        // Đọc lại mà lỗi thì "0 dòng" không chứng minh được gì — đừng coi là đạt.
        if (readError) return `không đọc lại được để kiểm chứng: ${errorLabel(readError)}`;
        // Tới đây `insert` không lỗi VÀ đọc lại thành công ra 0 dòng — payload đã được
        // dựng để một cú ghi lọt qua chắc chắn hiện ra ở nhánh trên, nên trường hợp này
        // là policy chặn mà driver không báo lỗi.
        if (!insert?.error) return null;
        const code = insert.error.code ?? insert.error.error ?? "";
        const message = insert.error.message ?? "";
        // Postgres dùng CHUNG sqlstate 42501 cho cả "thiếu GRANT" (message "permission
        // denied for table") lẫn "RLS WITH CHECK chặn" (message "new row violates
        // row-level security policy") — đã kiểm thực nghiệm 2026-08-24 ngay trên backend
        // này: anon (thật sự 0 GRANT) và authenticated (có GRANT, bị policy admin write
        // chặn) đều trả về đúng code "42501", chỉ khác ở message. Không thể phân biệt
        // hai trường hợp bằng code, bắt buộc phải soi message.
        const isRlsCheckFailure = /row-level security/i.test(message);
        return code === "42501" && !isRlsCheckFailure
          ? `bị chặn bằng 42501 không phải RLS (${message}) — nghi thiếu GRANT trên ${table}, admin thật cũng ghi hỏng`
          : null;
      },
    );
  }

  // Phần 3, mục 4 của đợt review toàn nhánh 2026-08-24: ranh giới "chỉ RPC
  // SECURITY DEFINER mới ghi được user_items" đã được test ở góc độ CHƯA đăng nhập
  // (phép "anon KHÔNG ghi được user_items" ở trên), nhưng CLAUDE.md gọi đây là quy tắc
  // bắt buộc cho cả role `authenticated` — và cho tới giờ không có phép nào thử góc độ
  // đó. Hàng rào giữ bằng HAI lớp độc lập (2026-08-12-ke-sach-doc-sach.sql): không có
  // GRANT INSERT nào cho `authenticated` trên `user_items`, VÀ RLS bật nhưng không có
  // policy INSERT nào — nhưng CHƯA từng có gì tự động phát hiện nếu một trong hai lớp
  // đó bị vô tình gỡ. Phiên đã đăng nhập đã có sẵn ở đây nên tiện thử luôn.
  await check(
    "authenticated KHÔNG ghi được user_items (chỉ RPC SECURITY DEFINER được trao vật phẩm)",
    async () => {
      if (signIn.error) return { signInError: signIn.error };
      const me = await user.auth.getCurrentUser();
      const insert = await user.database
        .from("user_items")
        .insert([{ user_id: me.data?.user?.id, item_slug: SENTINEL_AUTH }]);
      // Đọc lại bằng chính phiên này: policy "own items select" (auth.uid() = user_id)
      // cho phép user đọc dòng CỦA CHÍNH MÌNH, nên nếu insert lỡ lọt qua thì đọc lại
      // chắc chắn thấy — không có chỗ cho "ghi được nhưng RLS giấu mất" như ở books.
      const readBack = await user.database
        .from("user_items")
        .select("item_slug")
        .eq("item_slug", SENTINEL_AUTH);
      return { insert, rows: readBack.data ?? [], readError: readBack.error };
    },
    ({ signInError, insert, rows, readError, error }) => {
      if (error) return `lỗi bất thường: ${errorLabel(error)}`;
      if (signInError) return `không đăng nhập được tài khoản test: ${errorLabel(signInError)}`;
      if ((rows ?? []).length > 0) return "GHI ĐƯỢC — xóa dòng rác " + SENTINEL_AUTH + " khỏi user_items";
      if (readError) return `không đọc lại được để kiểm chứng: ${errorLabel(readError)}`;
      return insert?.error ? null : "insert không báo lỗi mà cũng không thấy dòng — kiểm tay";
    },
  );

  // Phép này bắt HAI thứ trong một truy vấn đọc lại:
  //   a) không tự ghi được dòng admin cho chính mình;
  //   b) không đọc trộm được dòng của NGƯỜI KHÁC — dòng mồi nhử tạo ở Step 1c
  //      (Task 3's cấp admin thật là tùy chọn nên không dựa vào nó), và tài khoản
  //      test phải thấy ĐÚNG 0 dòng.
  // Vế (b) là thứ duy nhất chứng minh policy "own role select" thật sự lọc theo
  // auth.uid(); `has_table_privilege` trong khối tự kiểm SQL không với tới được.
  await check(
    "authenticated KHÔNG tự phong admin, cũng KHÔNG đọc được vai trò người khác",
    async () => {
      if (signIn.error) return { signInError: signIn.error };
      const me = await user.auth.getCurrentUser();
      const insert = await user.database
        .from("user_roles")
        .insert([{ user_id: me.data?.user?.id, role: "admin" }]);
      const readBack = await user.database.from("user_roles").select("user_id, role");
      return {
        insert,
        rows: readBack.data ?? [],
        readError: readBack.error,
        myId: me.data?.user?.id,
      };
    },
    ({ signInError, insert, rows, readError, myId, error }) => {
      if (error) return `lỗi bất thường: ${errorLabel(error)}`;
      if (signInError) return `không đăng nhập được tài khoản test: ${errorLabel(signInError)}`;
      if (readError) return `không đọc lại được để kiểm chứng: ${errorLabel(readError)}`;
      const seen = rows ?? [];
      if (seen.some((r) => r.user_id === myId)) {
        return "TỰ PHONG ADMIN ĐƯỢC — xóa dòng trong user_roles ngay";
      }
      if (seen.length > 0) {
        return `đọc được ${seen.length} dòng vai trò của người khác — policy "own role select" không lọc theo auth.uid()`;
      }
      return insert?.error ? null : "insert không báo lỗi mà cũng không thấy dòng — kiểm tay";
    },
  );

  if (!signIn.error) await user.auth.signOut();
}

let failed = 0;
for (const r of results) {
  const detail = r.ok
    ? r.outcome?.error
      ? `(${errorLabel(r.outcome.error)})`
      : `(${r.outcome?.data?.length ?? 0} dòng)`
    : `→ ${r.reason}`;
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n        ${detail}`);
  if (!r.ok) failed++;
}

console.log(
  failed === 0
    ? `\nOK — ${results.length}/${results.length} ranh giới còn nguyên.` +
        (skipped > 0 ? ` (${skipped} PHÉP BỊ BỎ QUA — xem cảnh báo phía trên.)` : "")
    : `\n${failed}/${results.length} KIỂM TRA HỎNG. Đừng deploy cho tới khi sửa xong.`,
);
process.exit(failed === 0 ? 0 : 1);
