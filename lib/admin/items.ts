import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { getAdminUserId } from "./gate";

/**
 * ĐỌC dữ liệu vật phẩm cho màn quản trị.
 *
 * Không có `"use server"` — cùng lý do như `shelves.ts`: trong file có directive đó, MỌI
 * export thành endpoint POST công khai, kể cả hàm chỉ đọc.
 */

export interface AdminItemRow {
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageSource: string | null;
  imageCredit: string | null;
  /** Tiêu đề những quyển đang lấy vật phẩm này làm phần thưởng. Quyết định xóa được hay
   *  không, và cho phép nêu đích danh trong thông báo lỗi thay vì nói chung chung. */
  usedByBooks: string[];
}

interface Row {
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  image_source: string | null;
  image_credit: string | null;
  used_by: string[] | null;
}

export async function listItems(): Promise<AdminItemRow[]> {
  const userId = await getAdminUserId();
  if (!userId) return [];

  const rows = await withRole(userId, (t) =>
    sequelize.query<Row>(
      `SELECT i.slug, i.name, i.description, i.image_url, i.image_source, i.image_credit,
              ARRAY(SELECT b.title FROM public.books b
                     WHERE b.reward_item_slug = i.slug
                     ORDER BY b.shelf_slug, b.position) AS used_by
         FROM public.items i
        ORDER BY i.name`,
      { transaction: t, type: QueryTypes.SELECT },
    ),
  );

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    imageUrl: r.image_url,
    imageSource: r.image_source,
    imageCredit: r.image_credit,
    usedByBooks: r.used_by ?? [],
  }));
}
