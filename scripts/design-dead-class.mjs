#!/usr/bin/env node
/**
 * Cổng: bắt class Tailwind KHÔNG sinh ra CSS nào.
 *
 * VÌ SAO CẦN. Tailwind bỏ qua class nó không hiểu trong IM LẶNG — không cảnh báo, không
 * lỗi build. Một token bị đổi tên trong `DESIGN.md` để lại `fill-secondary`,
 * `accent-tertiary-deep`, `decoration-secondary-light` nằm nguyên trong JSX, và mọi cổng
 * đang có đều báo xanh: `design:lint` chỉ đọc DESIGN.md, `tsc` không biết gì về chuỗi
 * class, `next build` biên dịch bình thường. Thứ duy nhất lộ ra là màu biến mất trên màn
 * hình — và chỉ khi có người mở đúng màn đó ra nhìn.
 *
 * Đo thật ngày 2026-09-10, sau lượt đổi ~805 chỗ dùng token sang thế giới mực: còn sót 7
 * dòng, trong đó bản đồ chọn quốc gia ở `/quan-tri` ra `fill: rgb(0,0,0)` trên cả 705
 * `<path>` (một mảng đen, không biên giới, nước đang chọn không khác nước không chọn) và
 * ô chọn đáp án trắc nghiệm rơi về `accent-color: auto` — xanh dương hệ thống, ngoài
 * bảng màu, ngay giữa thao tác quan trọng nhất của sản phẩm.
 *
 * CÁCH ĐO. Không so với một danh sách token viết tay — danh sách viết tay chính là thứ đã
 * lỡ nhịp hai lần ở khối A của `90-verify.sql`. Thay vào đó build CSS THẬT bằng đúng
 * `tailwind.config.ts` của dự án, lấy tập class Tailwind đã sinh, rồi đòi mọi class mang
 * hình dạng "utility có token" trong mã nguồn phải nằm trong tập đó.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import postcss from "postcss";
import tailwind from "tailwindcss";

const ROOTS = ["app", "components"];

/** Tiền tố của những utility LẤY GIÁ TRỊ TỪ THEME — tức những chỗ token có thể chết. */
const PREFIXES = [
  "bg", "text", "border", "border-x", "border-y", "border-t", "border-r", "border-b", "border-l",
  "divide", "ring", "ring-offset", "outline", "shadow", "accent", "caret", "decoration",
  "placeholder", "fill", "stroke", "from", "via", "to",
  "p", "px", "py", "pt", "pr", "pb", "pl", "m", "mx", "my", "mt", "mr", "mb", "ml",
  "gap", "gap-x", "gap-y", "space-x", "space-y", "w", "h", "min-w", "min-h", "max-w", "max-h",
  "rounded", "rounded-t", "rounded-r", "rounded-b", "rounded-l",
];

/**
 * Phần đuôi phải trông như một TÊN TOKEN: chữ thường, có thể nhiều đoạn nối bằng gạch, kèm
 * hậu tố độ mờ `/50`. Loại thẳng giá trị tùy biến `[...]`, số (`p-4`, `w-1/2`) và các từ
 * khoá của Tailwind mà không cổng nào cần canh.
 */
const SHAPE = new RegExp(`^(?:${PREFIXES.join("|")})-[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:/\\d{1,3})?$`);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(p)) out.push(p);
  }
  return out;
}

/**
 * Bỏ comment trước khi quét. Bản đầu không làm việc này và báo nhầm ba lần: comment trong
 * `controls.ts` nhắc tên token cũ (`ring-on-dark`) để GIẢI THÍCH một quyết định, và một
 * comment khác nhắc `border-width` của Preflight. Cả ba đều là văn xuôi, không phải class.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Bỏ giá trị của những thuộc tính KHÔNG BAO GIỜ chứa class. Cần thật: khu quản trị đặt id
 * tiếng Việt (`id="h-moi"`, `id="p-moi"` — "học mới", "phần mới"), và chúng khớp y hệt hình
 * dạng của một utility có token.
 */
function stripNonClassAttrs(src) {
  return src.replace(
    /\b(?:id|htmlFor|name|href|form|list|type|role|(?:aria|data)-[\w-]+)=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g,
    " ",
  );
}

const css = await postcss([tailwind("./tailwind.config.ts")]).process(
  "@tailwind base;@tailwind components;@tailwind utilities;",
  { from: undefined },
);

const generated = new Set();
for (const m of css.css.matchAll(/\.((?:\\.|[^\s.,{>:[\])+~])+)/g)) {
  generated.add(m[1].replace(/\\/g, ""));
}

// Chuỗi giống class trong JSX: chữ cái mở đầu, cho phép cả `[...]` của variant tùy biến
// (`has-[:focus-visible]:ring-ring`) — thiếu vế này thì phần sau dấu `]` bị cắt rời và
// báo nhầm bốn class focus hoàn toàn hợp lệ.
const TOKENISH = /[a-zA-Z][a-zA-Z0-9_:/.%-]*(?:\[[^\]\s]*\][a-zA-Z0-9_:/.%-]*)*/g;

const deadClasses = new Map();
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = stripNonClassAttrs(stripComments(readFileSync(file, "utf8")));
    for (const m of src.matchAll(TOKENISH)) {
      const full = m[0];
      if (generated.has(full)) continue;
      // Bỏ phần variant để xét hình dạng, nhưng vẫn tra cứu bằng chuỗi ĐẦY ĐỦ ở trên.
      const bare = full.includes(":") ? full.slice(full.lastIndexOf(":") + 1) : full;
      if (!SHAPE.test(bare)) continue;
      if (generated.has(bare)) continue;
      // Utility âm (`-mb-px`): regex bỏ dấu trừ ở đầu, nên tra thêm dạng có dấu.
      if (generated.has(`-${bare}`)) continue;
      const key = bare;
      if (!deadClasses.has(key)) deadClasses.set(key, new Set());
      deadClasses.get(key).add(relative(process.cwd(), file));
    }
  }
}

if (deadClasses.size === 0) {
  console.log(`design:dead-class — 0 class chết (đối chiếu ${generated.size} utility Tailwind sinh ra)`);
  process.exit(0);
}

console.error("design:dead-class — class dùng token KHÔNG tồn tại, Tailwind bỏ qua trong im lặng:\n");
for (const [cls, files] of [...deadClasses].sort()) {
  console.error(`  ${cls}`);
  for (const f of [...files].sort()) console.error(`      ${f}`);
}
console.error(`\n${deadClasses.size} class chết. Sửa tên token theo DESIGN.md, đừng thêm token cho vừa class.`);
process.exit(1);
