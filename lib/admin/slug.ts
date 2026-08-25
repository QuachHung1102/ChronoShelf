/**
 * Sinh slug từ tiêu đề admin gõ vào. Thuần, import tương đối — đó là điều kiện để
 * `node --test` chạy được nó (alias `@/` không resolve dưới test runner của Node),
 * và cũng là lý do file này tách khỏi `lib/admin/shelves.ts`.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    // Dải dấu kết hợp U+0300–U+036F — sau NFD thì "ạ" thành "a" + U+0323.
    // Viết bằng escape chứ không phải ký tự thô: ký tự kết hợp là VÔ HÌNH trong hầu
    // hết editor, nên một lần copy-paste hỏng sẽ không ai nhìn ra.
    .replace(/[̀-ͯ]/g, "")
    // `đ` KHÔNG tách được bằng NFD: nó là ký tự riêng chứ không phải d + dấu, nên
    // không có dòng này thì "Bạch Đằng" ra "bach-ng" — chữ đ bị lọc mất luôn.
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug là khóa chính nên phải duy nhất. `taken` là tập slug đang có, do phía gọi
 * đọc từ database — hàm này không chạm mạng để test được.
 *
 * ponytail: đếm tuyến tính, đủ cho vài trăm quyển. Nhiều hơn thì để database tự lo
 * bằng cách bắt lỗi trùng khóa chính và thử lại.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
