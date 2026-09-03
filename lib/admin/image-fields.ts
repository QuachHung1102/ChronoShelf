/**
 * Luật "có ảnh thì bắt buộc có nguồn + tác giả", đọc từ FormData.
 *
 * File RIÊNG, không nhét vào `actions.ts`, vì hai lý do độc lập:
 *
 *  1. **Kỹ thuật, đã kiểm thực nghiệm:** trong file có `"use server"`, một export KHÔNG
 *     async bị Next 16.3 gỡ sạch và build hỏng với `The module has no exports at all`.
 *     Hàm này đồng bộ nên không sống được ở đó.
 *  2. Thuần + import tương đối ⇒ `node --test` chạy được. `FormData` có sẵn ở Node 24.
 *
 * `required` của HTML ở `ImageField` chỉ là phép lịch sự với người dùng. Hàm này mới là
 * LUẬT, vì Server Action là endpoint POST công khai — ai cũng gửi thẳng vào được. Và dưới
 * nữa còn một lớp không quên gọi được: CHECK constraint ở `db/schema/10-image-credit.sql`.
 */

/** Ảnh đã tải lên: `/media/<sha256>`. */
const UPLOADED = /^\/media\/[0-9a-f]{64}$/;

/**
 * Năm vật phẩm seed dùng SVG do chính dự án vẽ, commit sẵn trong `public/items/`.
 *
 * Phải chấp nhận, nếu không admin mở một vật phẩm cũ ra sửa TÊN thôi cũng bị chặn vì
 * đường dẫn ảnh không đổi vẫn trượt validate. Mẫu vẫn chặt: không có `..`, không có dấu
 * hai chấm, nên không mở lại được lỗ traversal hay `javascript:`.
 *
 * ponytail: nhánh này biến mất khi spec §6 được làm đủ (thay bằng ảnh Wikimedia thật).
 */
const SEEDED = /^\/items\/[a-z0-9-]+\.svg$/;

export type ImageFieldsResult =
  | { error: string }
  | { url: string | null; source: string | null; credit: string | null };

/** Bốn tiền tố ảnh có thật trong schema: `image_*` (items, pages), `cover_*` (books,
 *  shelves), `preview_*` và `mindmap_*` (lessons). Union chứ không phải `string` để gõ
 *  sai là hỏng lúc biên dịch chứ không phải lúc chạy. */
export type ImagePrefix = "image" | "cover" | "preview" | "mindmap";

export function readImageFields(fd: FormData, prefix: ImagePrefix): ImageFieldsResult {
  const get = (suffix: string): string => String(fd.get(prefix + suffix) ?? "").trim();

  const url = get("Url");
  const source = get("Source");
  const credit = get("Credit");

  // Không có ảnh ⇒ cả ba về NULL. Gỡ ảnh gỡ luôn credit trong cùng một lần ghi; không có
  // trạng thái nửa vời "đã xóa ảnh nhưng credit còn treo lại".
  if (!url) return { url: null, source: null, credit: null };

  // Chặn hai thứ mà không ai nghĩ tới cho tới khi nó xảy ra: admin dán `javascript:...`
  // vào ô đường dẫn, và admin hotlink thẳng ảnh Wikimedia (spec §6 cấm — link ngoài chết
  // là ảnh biến mất khỏi bài học).
  if (!UPLOADED.test(url) && !SEEDED.test(url)) {
    return { error: "Đường dẫn ảnh không hợp lệ — hãy tải ảnh lên thay vì dán liên kết." };
  }

  if (!source || !credit) {
    return {
      error: "Có ảnh thì bắt buộc điền cả nguồn và tác giả + giấy phép (điều kiện của CC BY-SA).",
    };
  }

  return { url, source, credit };
}
