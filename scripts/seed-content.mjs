#!/usr/bin/env node
/**
 * Bootstrap MỘT CHIỀU: đổ nội dung từ db/seed/*.json vào các bảng nội dung.
 *
 * Sau khi chạy, DATABASE LÀ NGUỒN SỰ THẬT. Sửa JSON KHÔNG làm đổi nội dung đang chạy —
 * muốn sửa nội dung thì vào /quan-tri. File JSON chỉ còn để dựng lại một DB dev từ số
 * không.
 *
 * Chạy thẳng vào PostgreSQL cục bộ:
 *   PGADMIN_URL=postgres://postgres:...@127.0.0.1:5432/chronoshelf npm run seed:content
 *
 * Cần quyền superuser vì nó ghi vào bảng nội dung, mà bảng nội dung chỉ admin mới
 * ghi được — và lúc bootstrap thì chưa có admin nào.
 *
 * Idempotent: chạy lại nhiều lần cho cùng một kết quả.
 */
import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bamMoi } from "../lib/auth/mat-khau.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "db", "seed");

/** Mã ISO-3166-1 numeric mà world-atlas dùng làm id quốc gia (chặng D cần). */
const COUNTRY_CODE = { "lich-su-viet-nam": "704" };

const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const qArray = (a) => (a?.length ? `ARRAY[${a.map(q).join(", ")}]::text[]` : "NULL");

const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("Không tìm thấy file nội dung nào trong " + dir);
  process.exit(1);
}

const shelves = [];
for (const file of files) shelves.push(JSON.parse(await readFile(join(dir, file), "utf8")));

// Không phát `BEGIN;`/`COMMIT;` ở đây: script tự bọc cả lô trong MỘT transaction bên
// dưới, nên seed hỏng giữa chừng sẽ roll back sạch thay vì để lại nửa quyển sách.
const out = [];

for (const shelf of shelves) {
  out.push(
    // `blurb`, `reward_title` và `reward_body` chỉ ghi lúc CHÈN MỚI, và cố ý vắng mặt
    // trong `DO UPDATE`: ba cột đó là chỗ admin soạn qua `/quan-tri`, còn seed là bootstrap
    // MỘT CHIỀU. Đưa chúng vào DO UPDATE là biến mỗi lần chạy `seed:content` thành một
    // lần xóa trắng công biên tập của admin.
    `INSERT INTO public.shelves\n` +
      `  (slug, name, position, country_code, blurb, reward_title, reward_body, published)\n` +
      `VALUES\n` +
      `  (${q(shelf.slug)}, ${q(shelf.name)}, ${shelf.order}, ` +
      `${q(COUNTRY_CODE[shelf.slug] ?? null)}, '', ` +
      `${q(shelf.reward?.title ?? "")}, ${q(shelf.reward?.body ?? "")}, true)\n` +
      `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position,\n` +
      `  country_code = EXCLUDED.country_code, published = EXCLUDED.published;`,
  );

  // items trước books: books.reward_item_slug tham chiếu tới nó.
  //
  // `imageSource`/`imageCredit` PHẢI đi kèm mỗi khi có `image`: ràng buộc
  // `items_image_credit_ck` (db/schema/10-image-credit.sql) cưỡng chế điều đó, nên bỏ
  // hai cột này ra khỏi câu INSERT là seed nổ 23514 trên mọi database trống.
  for (const item of shelf.items) {
    out.push(
      `INSERT INTO public.items (slug, name, description, image_url, image_source, image_credit) VALUES\n` +
        `  (${q(item.slug)}, ${q(item.name)}, ${q(item.description)}, ${q(item.image)},\n` +
        `   ${q(item.imageSource)}, ${q(item.imageCredit)})\n` +
        `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,\n` +
        `  description = EXCLUDED.description, image_url = EXCLUDED.image_url,\n` +
        `  image_source = EXCLUDED.image_source, image_credit = EXCLUDED.image_credit;`,
    );
  }

  shelf.books.forEach((book, i) => {
    // book.requiredItem trong JSON bị BỎ QUA có chủ đích — chuỗi mở khóa nay suy ra
    // từ vị trí chứ không lưu (spec §2.2).
    out.push(
      `INSERT INTO public.books\n` +
        `  (slug, shelf_slug, position, title, era, cover_url, reward_item_slug, published) VALUES\n` +
        `  (${q(book.slug)}, ${q(shelf.slug)}, ${i + 1}, ${q(book.title)}, ${q(book.era)}, ` +
        `${q(book.cover)}, ${q(book.rewardItem)}, true)\n` +
        `ON CONFLICT (slug) DO UPDATE SET shelf_slug = EXCLUDED.shelf_slug,\n` +
        `  position = EXCLUDED.position, title = EXCLUDED.title, era = EXCLUDED.era,\n` +
        `  cover_url = EXCLUDED.cover_url, reward_item_slug = EXCLUDED.reward_item_slug,\n` +
        `  published = EXCLUDED.published, updated_at = now();`,
    );

    // pages không có khóa tự nhiên nào ngoài (book_slug, position); xóa sạch rồi chèn
    // lại là cách duy nhất giữ seed idempotent mà không phải đoán id.
    out.push(`DELETE FROM public.pages WHERE book_slug = ${q(book.slug)};`);

    book.pages.forEach((page, p) => {
      out.push(
        `INSERT INTO public.pages\n` +
          `  (book_slug, position, heading, body, image_url, caption, summary) VALUES\n` +
          `  (${q(book.slug)}, ${p + 1}, ${q(page.heading)}, ${q(page.body)}, ` +
          `${q(page.image)}, ${q(page.caption)}, ${qArray(page.summary)});`,
      );
    });

    // Bài trắc nghiệm cuối sách (content.md §4.3). Cùng cách giữ idempotent như `pages`:
    // xóa sạch rồi chèn lại, vì (book_slug, position) là khóa tự nhiên duy nhất.
    //
    // `correct` trong JSON là CHỈ SỐ 0-based trong mảng `choices`, không phải bản sao
    // chuỗi đáp án — đúng thứ database lưu, nên không có bước dịch nào để mà dịch sai.
    out.push(`DELETE FROM public.book_questions WHERE book_slug = ${q(book.slug)};`);

    (book.questions ?? []).forEach((cauHoi, k) => {
      out.push(
        `INSERT INTO public.book_questions\n` +
          `  (book_slug, position, prompt, choices, correct_index) VALUES\n` +
          `  (${q(book.slug)}, ${k + 1}, ${q(cauHoi.prompt)}, ` +
          `${qArray(cauHoi.choices)}, ${Number(cauHoi.correct)});`,
      );
    });
  });
}

// ---------------------------------------------------------------------------
// Hai dòng MỒI NHỬ cho `npm run db:check`. Chúng KHÔNG phải nội dung thật và
// không được "dọn dẹp": thiếu chúng thì hai phép kiểm vẫn chạy, vẫn báo đạt, nhưng hết
// nghĩa — mọi sách thật đều đã xuất bản nên phép "không đọc được sách nháp" luôn thấy 0
// dòng, và user_roles không còn dòng "của người khác" nào nên phép "không đọc trộm được
// vai trò người khác" cũng luôn thấy 0 dòng, kể cả khi RLS hỏng hoàn toàn.
const BAIT_USER = "22222222-2222-2222-2222-222222222222";
const baitPass = await bamMoi(randomBytes(32).toString("hex"));
const baitAns = await bamMoi(randomBytes(32).toString("hex"));
out.push(
  "INSERT INTO public.books (slug, shelf_slug, position, title, era, published) VALUES\n" +
    "  ('__nhap-khong-bao-gio-xuat-ban', 'lich-su-viet-nam', 900,\n" +
    "   'Mồi nhử cho db:check — đừng xuất bản', '—', false)\n" +
    "ON CONFLICT (slug) DO UPDATE SET published = false;",
  // Quyển nháp phải CÓ một câu hỏi, nếu không phép kiểm "không đọc được câu hỏi của sách
  // nháp" luôn thấy 0 dòng và luôn báo đạt — kể cả khi policy `read published` của
  // `book_questions` bị nới thành USING (true). Đúng cùng một lý do như chính quyển nháp
  // này: mọi sách THẬT đều đã xuất bản nên không còn dòng nào để mà soi.
  //
  // `WHERE NOT EXISTS` chứ KHÔNG `ON CONFLICT (book_slug, position)`: ràng buộc UNIQUE của
  // bảng này là DEFERRABLE, mà Postgres từ chối dùng ràng buộc deferrable làm trọng tài cho
  // ON CONFLICT — sqlstate 55000, "does not support deferrable unique constraints as
  // arbiters". Đã đo thật ngày 2026-09-07. Đây cũng đúng lý do vòng lặp phía trên xóa-rồi-
  // chèn-lại thay vì upsert.
  "INSERT INTO public.book_questions (book_slug, position, prompt, choices, correct_index)\n" +
    "SELECT '__nhap-khong-bao-gio-xuat-ban', 1,\n" +
    "       'Mồi nhử cho db:check — câu hỏi này không được lộ ra ngoài',\n" +
    "       ARRAY['mồi nhử A', 'mồi nhử B']::text[], 0\n" +
    " WHERE NOT EXISTS (SELECT 1 FROM public.book_questions\n" +
    "                    WHERE book_slug = '__nhap-khong-bao-gio-xuat-ban');",
  // Mồi nhử phải có mật khẩu: `15-mat-khau.sql` XÓA mọi tài khoản không có
  // `password_hash` (người dùng đã chọn "xóa làm lại"), nên thiếu mấy cột này thì mồi
  // nhử biến mất ngay lần `db:migrate` kế tiếp và hai phép kiểm phụ thuộc nó hết nghĩa.
  //
  // Bản băm sinh từ 32 byte ngẫu nhiên KHÔNG ĐƯỢC GHI LẠI Ở ĐÂU: không ai — kể cả script
  // này — biết mật khẩu tương ứng, nên tài khoản mồi nhử không đăng nhập được. Nó tồn tại
  // để `db:check` có một dòng "của người khác" mà soi, không phải để dùng.
  "INSERT INTO public.users\n" +
    "  (id, email, email_verified, password_params, password_hash,\n" +
    "   security_question, answer_params, answer_hash) VALUES\n" +
    "  ('" + BAIT_USER + "', '__moi-nhu-vai-tro@example.invalid', false,\n" +
    "   " + q(baitPass.thamSo) + ", " + q(baitPass.bam) + ",\n" +
    "   'ten-thu-cung', " + q(baitAns.thamSo) + ", " + q(baitAns.bam) + ")\n" +
    "ON CONFLICT (id) DO NOTHING;",
  "INSERT INTO public.user_roles (user_id, role) VALUES ('" + BAIT_USER + "', 'admin')\n" +
    "ON CONFLICT (user_id) DO UPDATE SET role = 'admin';",
);

const url = process.env.PGADMIN_URL;
if (!url) {
  console.error(
    "Thiếu PGADMIN_URL — chuỗi kết nối quyền superuser. Ví dụ:\n" +
      "  PGADMIN_URL=postgres://postgres:...@127.0.0.1:5432/chronoshelf npm run seed:content",
  );
  process.exit(1);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  for (const stmt of out) await client.query(stmt);
  await client.query("COMMIT");
  const { rows } = await client.query(
    "SELECT (SELECT count(*) FROM public.shelves) AS shelves," +
      " (SELECT count(*) FROM public.items) AS items," +
      " (SELECT count(*) FROM public.books) AS books," +
      " (SELECT count(*) FROM public.pages) AS pages," +
      " (SELECT count(*) FROM public.book_questions) AS questions",
  );
  const c = rows[0];
  console.log(
    "Seed xong: " + c.shelves + " kệ, " + c.items + " vật phẩm, " +
      c.books + " sách (kể cả 1 mồi nhử chưa xuất bản), " + c.pages + " trang, " +
      c.questions + " câu hỏi.",
  );
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Seed hỏng, đã roll back:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
