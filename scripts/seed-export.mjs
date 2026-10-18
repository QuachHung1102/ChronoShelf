#!/usr/bin/env node
/**
 * Xuất nội dung ĐANG CHẠY trong database ra db/seed/ — chiều ngược của `seed-content.mjs`.
 *
 * Database là nguồn sự thật: admin soạn qua /quan-tri, ảnh nằm trong bảng `media`, slide
 * trong `documents`. Không có script này thì JSON trong db/seed/ trôi lệch dần, và dựng
 * một server mới từ seed ra một bản không ảnh, không bài giảng, thiếu mọi chỉnh sửa.
 *
 *   node --env-file=.env.pgadmin scripts/seed-export.mjs
 *
 * Cần PGADMIN_URL vì phải đọc `book_questions.correct_index` — cột đó cố ý KHÔNG cấp
 * SELECT cho role ứng dụng nào (xem CLAUDE.md, quy tắc đáp án trắc nghiệm).
 *
 * Ghi ra:
 *   db/seed/<kệ>.json        — kệ, vật phẩm, sách, trang, câu hỏi
 *   db/seed/bai-giang.json   — bài giảng
 *   db/seed/media/<sha256>.<đuôi>, db/seed/tai-lieu/<sha256>.pptx — CHỈ tệp đang được
 *   tham chiếu, nên ảnh mồ côi trong bảng `media` (bảng chỉ-ghi-thêm) không theo ra repo.
 *
 * Bỏ qua: mồi nhử của db:check (slug bắt đầu bằng `__` — seed tự dựng lại chúng), người
 * dùng, tiến độ đọc và bảng tin cộng đồng — đó là dữ liệu của người dùng, không phải nội dung.
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "db", "seed");
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

const url = process.env.PGADMIN_URL;
if (!url) {
  console.error("Thiếu PGADMIN_URL. Chạy: node --env-file=.env.pgadmin scripts/seed-export.mjs");
  process.exit(1);
}

const { default: pg } = await import("pg");
const db = new pg.Client({ connectionString: url });
await db.connect();
const all = async (sql, params) => (await db.query(sql, params)).rows;

/** sha256 của mọi URL `/media/<sha>` gặp trên đường đi. */
const mediaDung = new Set();
const anh = (u) => {
  if (u?.startsWith("/media/")) mediaDung.add(u.slice(7));
  return u ?? null;
};

const shelves = await all("SELECT * FROM public.shelves ORDER BY position");
const tepKe = [];
for (const s of shelves) {
  const books = await all(
    "SELECT * FROM public.books WHERE shelf_slug = $1 AND slug NOT LIKE '\\_\\_%' ORDER BY position",
    [s.slug],
  );
  const itemSlugs = books.map((b) => b.reward_item_slug).filter(Boolean);
  const items = await all("SELECT * FROM public.items WHERE slug = ANY($1)", [itemSlugs]);
  // Giữ thứ tự vật phẩm theo thứ tự đọc — đúng thứ tự tranh ghép cắt mảnh.
  items.sort((a, b) => itemSlugs.indexOf(a.slug) - itemSlugs.indexOf(b.slug));

  const json = {
    slug: s.slug,
    name: s.name,
    order: s.position,
    countryCode: s.country_code,
    published: s.published,
    blurb: s.blurb,
    cover: anh(s.cover_url), coverSource: s.cover_source, coverCredit: s.cover_credit,
    mosaic: anh(s.mosaic_url), mosaicSource: s.mosaic_source, mosaicCredit: s.mosaic_credit,
    reward: { title: s.reward_title, body: s.reward_body },
    items: items.map((i) => ({
      slug: i.slug, name: i.name, description: i.description,
      image: anh(i.image_url), imageSource: i.image_source, imageCredit: i.image_credit,
    })),
    books: [],
  };

  for (const b of books) {
    const pages = await all("SELECT * FROM public.pages WHERE book_slug = $1 ORDER BY position", [b.slug]);
    const qs = await all("SELECT * FROM public.book_questions WHERE book_slug = $1 ORDER BY position", [b.slug]);
    json.books.push({
      slug: b.slug, title: b.title, era: b.era, published: b.published,
      cover: anh(b.cover_url), coverSource: b.cover_source, coverCredit: b.cover_credit,
      rewardItem: b.reward_item_slug,
      pages: pages.map((p) => ({
        heading: p.heading, body: p.body,
        image: anh(p.image_url), imageSource: p.image_source, imageCredit: p.image_credit,
        caption: p.caption, summary: p.summary ?? undefined,
      })),
      questions: qs.map((q) => ({ prompt: q.prompt, choices: q.choices, correct: q.correct_index })),
    });
  }
  tepKe.push([`${s.slug}.json`, json]);
}

const lessons = await all("SELECT * FROM public.lessons ORDER BY grade, created_at");
const docDung = new Set(lessons.map((l) => l.slide_sha256).filter(Boolean));
const baiGiang = lessons.map((l) => ({
  slug: l.slug, grade: l.grade, title: l.title, summary: l.summary, book: l.book_slug,
  published: l.published,
  slide: l.slide_sha256 ? { sha256: l.slide_sha256, filename: l.slide_filename } : null,
  preview: anh(l.preview_url), previewSource: l.preview_source, previewCredit: l.preview_credit,
  mindmap: anh(l.mindmap_url), mindmapSource: l.mindmap_source, mindmapCredit: l.mindmap_credit,
}));

// Ghi lại thư mục tệp từ đầu: một ảnh admin vừa thay sẽ không còn được tham chiếu, và
// phải biến khỏi repo chứ không nằm lại thành rác.
for (const sub of ["media", "tai-lieu"]) {
  await rm(join(dir, sub), { recursive: true, force: true });
  await mkdir(join(dir, sub), { recursive: true });
}
let mediaBytes = 0;
for (const r of await all("SELECT sha256, mime, bytes FROM public.media WHERE sha256 = ANY($1)", [[...mediaDung]])) {
  await writeFile(join(dir, "media", `${r.sha256}.${EXT[r.mime]}`), r.bytes);
  mediaBytes += r.bytes.length;
}
for (const r of await all("SELECT sha256, bytes FROM public.documents WHERE sha256 = ANY($1)", [[...docDung]])) {
  await writeFile(join(dir, "tai-lieu", `${r.sha256}.pptx`), r.bytes);
}

// JSON kệ cũ không còn trong DB (kệ bị xóa) phải đi theo.
for (const f of await readdir(dir)) {
  if (f.endsWith(".json") && f !== "bai-giang.json" && !tepKe.some(([n]) => n === f)) await rm(join(dir, f));
}
for (const [name, json] of tepKe) await writeFile(join(dir, name), JSON.stringify(json, null, 2) + "\n");
await writeFile(join(dir, "bai-giang.json"), JSON.stringify(baiGiang, null, 2) + "\n");
await db.end();

const mediaThieu = [...mediaDung].length - (await readdir(join(dir, "media"))).length;
console.log(
  `Đã xuất ${tepKe.length} kệ, ${baiGiang.length} bài giảng, ${mediaDung.size} ảnh ` +
    `(${(mediaBytes / 1048576).toFixed(1)} MB), ${docDung.size} bộ slide.`,
);
if (mediaThieu !== 0) {
  console.error(`${mediaThieu} URL /media/ trỏ vào ảnh không có trong bảng media.`);
  process.exitCode = 1;
}
