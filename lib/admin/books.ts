import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { getAdminUserId } from "./gate";

/**
 * ĐỌC dữ liệu sách của một kệ. Không có `"use server"` — xem `shelves.ts`.
 */

export interface AdminBookRow {
  slug: string;
  title: string;
  era: string;
  position: number;
  rewardItemSlug: string | null;
  /** Tên vật phẩm thưởng, để hiện chuỗi mở khóa mà không phải tra lại danh sách. */
  rewardItemName: string | null;
  published: boolean;
  pageCount: number;
}

export interface AdminShelfHeader {
  slug: string;
  name: string;
  published: boolean;
}

interface BookRow {
  slug: string;
  title: string;
  era: string;
  position: number;
  reward_item_slug: string | null;
  reward_item_name: string | null;
  published: boolean;
  page_count: string;
}

/** Trả về `null` khi kệ không tồn tại (hoặc người gọi không phải admin). */
export async function readShelfHeader(shelfSlug: string): Promise<AdminShelfHeader | null> {
  const userId = await getAdminUserId();
  if (!userId) return null;

  const rows = await withRole(userId, (t) =>
    sequelize.query<AdminShelfHeader>(
      "SELECT slug, name, published FROM public.shelves WHERE slug = $1",
      { bind: [shelfSlug], transaction: t, type: QueryTypes.SELECT },
    ),
  );
  return rows[0] ?? null;
}

export async function listBooks(shelfSlug: string): Promise<AdminBookRow[]> {
  const userId = await getAdminUserId();
  if (!userId) return [];

  const rows = await withRole(userId, (t) =>
    sequelize.query<BookRow>(
      `SELECT b.slug, b.title, b.era, b.position, b.reward_item_slug, b.published,
              i.name AS reward_item_name,
              (SELECT count(*) FROM public.pages p WHERE p.book_slug = b.slug) AS page_count
         FROM public.books b
         LEFT JOIN public.items i ON i.slug = b.reward_item_slug
        WHERE b.shelf_slug = $1
        ORDER BY b.position`,
      { bind: [shelfSlug], transaction: t, type: QueryTypes.SELECT },
    ),
  );

  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    era: r.era,
    position: r.position,
    rewardItemSlug: r.reward_item_slug,
    rewardItemName: r.reward_item_name,
    published: r.published,
    pageCount: Number(r.page_count),
  }));
}
