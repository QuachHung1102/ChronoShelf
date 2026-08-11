#!/usr/bin/env node
/**
 * Chiếu content/shelves/*.json xuống bảng public.book_unlocks.
 *
 * JSON là nguồn sự thật. Bảng xương chỉ tồn tại vì quyết định trao vật phẩm phải
 * chạy trong Postgres (backend không có service_role nên Next.js không đủ quyền
 * ghi user_items). In ra SQL để chạy qua MCP `run-raw-sql`.
 *
 *   node scripts/content-sync.mjs            # in SQL
 *   node scripts/content-sync.mjs --check    # chỉ kiểm tra tính toàn vẹn
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "content", "shelves");

const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("Không tìm thấy file nội dung nào trong content/shelves/");
  process.exit(1);
}

const shelves = [];
for (const file of files) {
  shelves.push(JSON.parse(await readFile(join(dir, file), "utf8")));
}

// --- Kiểm tra toàn vẹn trước khi sinh SQL ---------------------------------
const problems = [];
const allItemSlugs = new Set(shelves.flatMap((s) => s.items.map((i) => i.slug)));

for (const shelf of shelves) {
  const seen = new Set();
  shelf.books.forEach((book, index) => {
    if (seen.has(book.slug)) problems.push(`${shelf.slug}: trùng slug sách "${book.slug}"`);
    seen.add(book.slug);

    if (!book.pages?.length) problems.push(`${book.slug}: không có trang nào`);

    if (index === 0 && book.requiredItem !== null) {
      problems.push(`${book.slug}: quyển đầu kệ phải có requiredItem = null (điểm bắt đầu)`);
    }
    for (const [field, slug] of [
      ["requiredItem", book.requiredItem],
      ["rewardItem", book.rewardItem],
    ]) {
      if (slug && !allItemSlugs.has(slug)) {
        problems.push(`${book.slug}: ${field} "${slug}" không có trong items`);
      }
    }
    // Chuỗi mở khóa phải liền mạch: quyển n cần đúng vật phẩm quyển n-1 trao.
    if (index > 0) {
      const prev = shelf.books[index - 1];
      if (book.requiredItem !== prev.rewardItem) {
        problems.push(
          `${book.slug}: requiredItem "${book.requiredItem}" không khớp rewardItem ` +
            `"${prev.rewardItem}" của quyển trước — chuỗi mở khóa bị đứt`,
        );
      }
    }
  });
}

if (problems.length > 0) {
  console.error("Nội dung không hợp lệ:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

if (process.argv.includes("--check")) {
  const books = shelves.reduce((n, s) => n + s.books.length, 0);
  console.log(`OK — ${shelves.length} kệ, ${books} quyển, chuỗi mở khóa liền mạch.`);
  process.exit(0);
}

// --- Sinh SQL -------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const rows = shelves.flatMap((shelf) =>
  shelf.books.map((book, index) =>
    `  (${q(book.slug)}, ${q(shelf.slug)}, ${index}, ${book.pages.length}, ` +
    `${q(book.requiredItem)}, ${q(book.rewardItem)})`,
  ),
);

console.log(`INSERT INTO public.book_unlocks
  (book_slug, shelf_slug, position, page_count, required_item_slug, reward_item_slug)
VALUES
${rows.join(",\n")}
ON CONFLICT (book_slug) DO UPDATE SET
  shelf_slug         = EXCLUDED.shelf_slug,
  position           = EXCLUDED.position,
  page_count         = EXCLUDED.page_count,
  required_item_slug = EXCLUDED.required_item_slug,
  reward_item_slug   = EXCLUDED.reward_item_slug;

DELETE FROM public.book_unlocks
 WHERE book_slug NOT IN (${shelves.flatMap((s) => s.books.map((b) => q(b.slug))).join(", ")});`);
