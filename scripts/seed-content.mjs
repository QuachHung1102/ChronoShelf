#!/usr/bin/env node
/**
 * Bootstrap MỘT CHIỀU: đổ nội dung từ db/seed/*.json vào các bảng nội dung.
 *
 * Sau khi chạy, DATABASE LÀ NGUỒN SỰ THẬT. Sửa JSON KHÔNG làm đổi nội dung đang chạy —
 * muốn sửa nội dung thì vào /quan-tri. File JSON chỉ còn để dựng lại một DB dev từ số
 * không.
 *
 * In ra SQL để chạy qua MCP `run-raw-sql`:
 *   node scripts/seed-content.mjs
 *
 * Idempotent: chạy lại nhiều lần cho cùng một kết quả.
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

// KHÔNG phát `BEGIN;`/`COMMIT;`: MCP `run-raw-sql` từ chối lệnh điều khiển transaction
// tường minh, và nó không cần — proxy đã tự bọc cả batch trong một transaction. Đã kiểm
// bằng thực nghiệm ngày 2026-08-24: một batch có `CREATE TABLE` rồi một `INSERT` trùng
// khóa làm cả batch roll back, bảng vừa tạo cũng biến mất. Thêm `BEGIN;` vào chỉ khiến
// output không dán thẳng vào MCP được, đúng lỗi đã vấp lần đầu.
const out = [];

for (const shelf of shelves) {
  out.push(
    `INSERT INTO public.shelves (slug, name, position, country_code, blurb, published) VALUES\n` +
      `  (${q(shelf.slug)}, ${q(shelf.name)}, ${shelf.order}, ` +
      `${q(COUNTRY_CODE[shelf.slug] ?? null)}, '', true)\n` +
      `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position,\n` +
      `  country_code = EXCLUDED.country_code, published = EXCLUDED.published;`,
  );

  // items trước books: books.reward_item_slug tham chiếu tới nó.
  for (const item of shelf.items) {
    out.push(
      `INSERT INTO public.items (slug, name, description, image_url) VALUES\n` +
        `  (${q(item.slug)}, ${q(item.name)}, ${q(item.description)}, ${q(item.image)})\n` +
        `ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,\n` +
        `  description = EXCLUDED.description, image_url = EXCLUDED.image_url;`,
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
  });
}

console.log(out.join("\n\n"));
