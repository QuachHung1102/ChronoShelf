import { Book, Shelf } from "@/lib/db/models";
import { withRole } from "@/lib/db/tx";
import { requireAdmin } from "./gate";

/**
 * Đường ĐỌC của màn quản trị bài giảng. File riêng, KHÔNG có `"use server"`.
 *
 * Cùng lý do như `lib/admin/shelves.ts`: trong file có `"use server"`, MỌI export là một
 * endpoint POST công khai — kể cả hàm chỉ đọc. Tách đọc khỏi ghi là cách rẻ nhất để bề
 * mặt tấn công không mọc thêm chỉ vì tiện tay để chung file.
 */

export interface SachChon {
  slug: string;
  title: string;
  shelfName: string;
}

/**
 * Danh sách quyển sách để chọn khi gắn bài giảng với một chương.
 *
 * Lấy cả sách nháp: chỉ admin gọi được hàm này, và soạn bài giảng trước khi xuất bản
 * quyển sách là thứ tự làm việc bình thường.
 */
export async function listBooksForLesson(): Promise<SachChon[]> {
  const userId = await requireAdmin();

  const rows = await withRole(userId, (t) =>
    Book.findAll({
      attributes: ["slug", "title", "position"],
      include: [{ model: Shelf, as: "shelf", attributes: ["name", "position"] }],
      transaction: t,
    }),
  );

  return rows
    .map((r) => ({ slug: r.slug, title: r.title, shelfName: r.shelf?.name ?? "—" }))
    .sort((a, b) => a.shelfName.localeCompare(b.shelfName) || a.title.localeCompare(b.title));
}
