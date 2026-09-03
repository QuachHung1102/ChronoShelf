/**
 * Sinh `public/world-countries.json` từ TopoJSON của `world-atlas`.
 *
 * CHẠY MỘT LẦN, KHÔNG nằm trong `npm run check`. Hai dependency dưới đây CỐ Ý không có
 * trong package.json — chúng chỉ cần lúc sinh file, không cần lúc chạy ứng dụng:
 *
 *   npm i --no-save d3-geo topojson-client
 *   node scripts/build-world-map.mjs
 *
 * Vì sao dùng world-atlas chứ không phải bản đồ SVG của Wikimedia: world-atlas đánh id
 * bằng **ISO-3166-1 numeric**, đúng thứ `shelves.country_code` đang lưu. Bản Wikimedia
 * dùng alpha-2 nên sẽ phải kèm một bảng tra 249 dòng — thêm một chỗ để sai.
 */
import { writeFileSync } from "node:fs";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const SRC = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const W = 1000;
const H = 500;

const topo = await (await fetch(SRC)).json();
const geo = feature(topo, topo.objects.countries);

const projection = geoNaturalEarth1().fitSize([W, H], geo);
// 1 chữ số thập phân: ở bề ngang 1000px thì 0,1px nằm dưới ngưỡng nhìn thấy, mà file nhỏ
// đi đáng kể so với mặc định (6 chữ số).
const path = geoPath(projection).digits(1);

// Gộp theo id: một mã ISO có thể ứng với nhiều feature rời (Australia và đảo Ashmore
// cùng mang mã 036). Để nguyên thì `country_code` trỏ tới hai <path>, và bản đồ có hai
// vùng bật/tắt độc lập cho cùng một nước.
const theoId = new Map();
for (const f of geo.features) {
  const id = String(f.id);
  const d = path(f);
  if (!d || !/^\d{1,3}$/.test(id)) continue;
  const cu = theoId.get(id);
  if (!cu) theoId.set(id, { id, name: f.properties.name, d });
  // Tên giữ lại là tên của mảnh có đường biên dài nhất — mảnh chính, không phải đảo lẻ.
  else
    theoId.set(id, {
      id,
      name: d.length > cu.d.length ? f.properties.name : cu.name,
      d: cu.d + d,
    });
}

const countries = [...theoId.values()].sort((a, b) => a.name.localeCompare(b.name));

// Nằm trong `public/` chứ không phải `lib/`: file hơn 1 MB mà `import` thì nó vào thẳng
// bundle client của màn quản trị. Ở `public/` thì trình duyệt tự cache và trang vẫn nhẹ.
// File này COMMIT SẴN nên `next start` phục vụ được — bẫy "ghi vào public/ lúc chạy"
// không áp dụng ở đây.
writeFileSync("public/world-countries.json", JSON.stringify({ viewBox: `0 0 ${W} ${H}`, countries }));
console.log(`${countries.length} quốc gia -> public/world-countries.json`);
