#!/usr/bin/env node
/**
 * Vá `lineHeight` trở lại `tailwind.theme.json`.
 *
 * VÌ SAO CẦN: `designmd export --format json-tailwind` bỏ rơi `lineHeight` — nó xuất ra
 * `fontWeight` và `letterSpacing` vào tuple fontSize nhưng KHÔNG xuất lineHeight. Hậu
 * quả im lặng và ăn xuyên toàn app: mọi chữ chạy 1.5 mặc định của Tailwind preflight
 * thay vì 1.15–1.75 như DESIGN.md đã duyệt. Tiêu đề lớn giãn 54px thay vì 41px.
 *
 * Không có gì trong `npm run check` bắt được: `design:lint` chỉ đọc DESIGN.md (nơi giá
 * trị VẪN đúng), còn `build` thì không biết thiết kế nói gì.
 *
 * VÌ SAO KHÔNG chép lineHeight vào `tailwind.config.ts`: như vậy là tách nguồn sự thật
 * làm đôi, đúng thứ CLAUDE.md cấm. DESIGN.md vẫn là nguồn duy nhất; script này chỉ
 * chuyển thứ nó đã nói sang thứ Tailwind đọc được.
 *
 * ponytail: parse YAML bằng regex thay vì thêm một dependency YAML. Trần: chỉ đọc đúng
 * khối `typography:` phẳng hai tầng của DESIGN.md. Đổi cấu trúc file đó thì script kêu
 * (xem phần khẳng định ở cuối) chứ không âm thầm bỏ qua.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const DESIGN = path.join(root, "DESIGN.md");
// Đường dẫn nhận qua argv để `design:verify` vá được vào một BẢN SAO tạm rồi đem so với
// file đang commit. Trước đây đường dẫn bị neo cứng và argv bị bỏ qua hoàn toàn, nên bản
// tạm mãi mãi thiếu lineHeight còn file thật thì bị vá — `git diff` đỏ 33 dòng ngay cả khi
// hai bên đồng bộ hoàn hảo. Một cổng luôn-đỏ còn tệ hơn không có cổng.
const THEME = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "tailwind.theme.json");

const design = await readFile(DESIGN, "utf8");

// Cắt lấy khối `typography:` — từ dòng đó tới khóa cấp 1 kế tiếp (không thụt lề).
const block = design.match(/^typography:\n([\s\S]*?)(?=^\S)/m);
if (!block) {
  console.error("Không tìm thấy khối `typography:` trong DESIGN.md.");
  process.exit(1);
}

/** { "headline-lg": "1.15", … } */
const lineHeights = {};
let current = null;
for (const line of block[1].split("\n")) {
  const token = line.match(/^ {2}([\w-]+):\s*$/);
  if (token) {
    current = token[1];
    continue;
  }
  const lh = line.match(/^ {4}lineHeight:\s*(\S+)\s*$/);
  if (lh && current) lineHeights[current] = lh[1];
}

const theme = JSON.parse(await readFile(THEME, "utf8"));
const fontSize = theme?.theme?.extend?.fontSize;
if (!fontSize) {
  console.error("tailwind.theme.json không có theme.extend.fontSize — cấu trúc đã đổi.");
  process.exit(1);
}

let patched = 0;
const missing = [];
for (const [token, tuple] of Object.entries(fontSize)) {
  const lh = lineHeights[token];
  if (!lh) {
    missing.push(token);
    continue;
  }
  // Tuple của Tailwind là [size, optionsObject]. `designmd` luôn xuất dạng này.
  if (!Array.isArray(tuple) || typeof tuple[1] !== "object" || tuple[1] === null) {
    console.error(`Token ${token}: tuple fontSize không đúng dạng [size, {…}].`);
    process.exit(1);
  }
  tuple[1].lineHeight = lh;
  patched += 1;
}

// Mọi token fontSize đều PHẢI có lineHeight. Thiếu một cái nghĩa là DESIGN.md và bản
// xuất đã lệch nhau — báo to thay vì lặng lẽ để nó chạy mặc định.
if (missing.length > 0) {
  console.error(`Thiếu lineHeight trong DESIGN.md cho: ${missing.join(", ")}`);
  process.exit(1);
}

await writeFile(THEME, JSON.stringify(theme, null, 2) + "\n");
console.log(`Đã vá lineHeight cho ${patched}/${Object.keys(fontSize).length} token chữ.`);
