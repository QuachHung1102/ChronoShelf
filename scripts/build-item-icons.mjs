/**
 * Sinh `public/items/<slug>.svg` cho 13 vật phẩm từ bộ Game-icons.net.
 *
 * CHẠY MỘT LẦN, KHÔNG nằm trong `npm run check`. Cần gói icon, và gói đó **không** phải
 * devDependency vì nó nặng 6,2 MB cho 4.134 icon trong khi ta chỉ lấy ra 17 KB đường path:
 *
 *   npm i --no-save @iconify-json/game-icons
 *   node scripts/build-item-icons.mjs
 *
 * Cùng lối với `scripts/build-world-map.mjs` — kết quả được commit, công cụ thì không.
 *
 * VÌ SAO KHÔNG TỰ VẼ NỮA: năm file cũ trong `public/items/` là hình do chính dự án vẽ
 * tay, và chúng mang HAI vấn đề. Thứ nhất, mã màu nằm cứng trong file (`#F6ECDA`,
 * `#E8622C`) — đúng thứ `DESIGN.md` cấm, mà lại nằm ngoài tầm với của mọi cổng kiểm tra
 * vì không cổng nào soi file `.svg`. Thứ hai, tám vật phẩm còn lại chưa ai vẽ, nên tủ
 * kính có 5 món có hình và 8 món trống — không phải một bộ.
 *
 * VÌ SAO KHÔNG DÙNG ẢNH CHỤP THẬT: `media` chỉ nhận ảnh raster và CỐ Ý chặn SVG (nó là
 * XML, phục vụ cùng origin thì thành stored XSS — xem `db/schema/09-media.sql`). Ảnh chụp
 * bảo tàng cho 13 hiện vật sẽ là 13 dòng `media` với 13 dòng ghi công riêng, 13 nền ảnh
 * khác nhau, và vẫn phải qua tay người tải lên. Bộ icon một màu thì đồng bộ tuyệt đối,
 * ăn token màu qua `currentColor`, và nằm trong `public/` nên đi thẳng vào đường
 * `/items/<slug>.svg` mà `readImageFields()` đã mở sẵn.
 *
 * GIẤY PHÉP: CC BY 3.0. Điều kiện BY được thỏa bằng hai cột `image_source`/`image_credit`
 * của bảng `items` — ràng buộc `items_image_credit_ck` bắt buộc có đủ khi có ảnh, và
 * `GhiCongAnh` hiển thị chúng ra. Giá trị nằm ngay dưới đây, seed đọc từ `db/seed/*.json`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let bo;
try {
  bo = require("@iconify-json/game-icons/icons.json");
} catch {
  console.error(
    "Thiếu bộ icon. Chạy: npm i --no-save @iconify-json/game-icons\n" +
      "(cố ý không phải devDependency — xem chú thích đầu file)",
  );
  process.exit(1);
}

/**
 * Vật phẩm → icon. Ánh xạ này là một quyết định BIÊN TẬP, không phải kỹ thuật; sửa ở đây
 * rồi chạy lại là đổi được hình mà không đụng một dòng mã giao diện nào.
 */
const ANH_XA = {
  "trong-dong": "drum",
  // Bãi cọc Bạch Đằng: một hàng cọc gỗ vót nhọn cắm dưới lòng sông. `palisade` chứ
  // KHÔNG phải `spikes` — `spikes` vẽ ra một chùm tia tỏa tròn, nhìn ra là ngôi sao
  // chứ không phải cọc gỗ.
  "coc-go-bach-dang": "palisade",
  // Ấn tín là con dấu — vật để đóng, không phải vết sáp đã đóng (`wax-seal`).
  "an-tin-dong-a": "stamper",
  "ao-bao-quang-trung": "cape",
  "la-co-quyet-chien": "flying-flag",
  "vien-da-giza": "stone-block",
  // Aquila — con đại bàng trên đầu cán cờ của mỗi quân đoàn La Mã.
  "huy-hieu-quan-doan": "eagle-emblem",
  "la-ban-hang-hai": "compass",
  "mo-hinh-dau-may": "steam-locomotive",
  "dong-xu-co": "two-coins",
  "qua-bong-da": "soccer-ball",
  "ta-ao-dai": "ample-dress",
  "bong-den-soi-dot": "light-bulb",
};

const THU_MUC = "public/items";

await mkdir(THU_MUC, { recursive: true });

let n = 0;
for (const [slug, ten] of Object.entries(ANH_XA)) {
  const icon = bo.icons[ten];
  if (!icon) {
    console.error(`Bộ icon không có "${ten}" (cho ${slug}) — sai tên hoặc bộ đã đổi.`);
    process.exit(1);
  }

  const w = icon.width ?? bo.width ?? 512;
  const h = icon.height ?? bo.height ?? 512;

  // `fill="currentColor"` đã nằm sẵn trong thân icon của Iconify, và giữ nguyên là CỐ Ý:
  // nhờ nó file này KHÔNG chứa một mã màu nào, nên màu do token quyết định chứ không do
  // tấm ảnh. Đó chính là thứ năm file vẽ tay cũ làm sai.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `fill="currentColor" role="img" aria-hidden="true">` +
    `<title>${slug}</title>` +
    `<!-- game-icons.net "${ten}" · CC BY 3.0 · sinh bởi scripts/build-item-icons.mjs -->` +
    icon.body +
    `</svg>\n`;

  await writeFile(`${THU_MUC}/${slug}.svg`, svg, "utf8");
  n += 1;
}

console.log(`Đã sinh ${n} icon vật phẩm vào ${THU_MUC}/.`);
console.log('Nhớ: nguồn "https://game-icons.net/", ghi công "Game-icons.net · CC BY 3.0".');
