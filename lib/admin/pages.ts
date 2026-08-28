import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { getAdminUserId } from "./gate";

/**
 * ĐỌC dữ liệu trang của một quyển. Không có `"use server"` — xem `shelves.ts`.
 */

export interface AdminPageRow {
  id: string;
  position: number;
  heading: string;
  body: string;
  imageUrl: string | null;
  imageSource: string | null;
  imageCredit: string | null;
  caption: string | null;
  /** `text[]` của Postgres. Chỉ trang cuối mới hiện ra với học sinh (content.md 4.3). */
  summary: string[];
}

export interface AdminBookHeader {
  slug: string;
  title: string;
  era: string;
  published: boolean;
  shelfSlug: string;
  shelfName: string;
}

interface PageRow {
  id: string;
  position: number;
  heading: string;
  body: string;
  image_url: string | null;
  image_source: string | null;
  image_credit: string | null;
  caption: string | null;
  summary: string[] | null;
}

/** Trả về `null` khi quyển không tồn tại, không thuộc kệ đó, hoặc người gọi không phải admin. */
export async function readBookHeader(
  shelfSlug: string,
  bookSlug: string,
): Promise<AdminBookHeader | null> {
  const userId = await getAdminUserId();
  if (!userId) return null;

  const rows = await withRole(userId, (t) =>
    sequelize.query<AdminBookHeader>(
      `SELECT b.slug, b.title, b.era, b.published,
              b.shelf_slug AS "shelfSlug", s.name AS "shelfName"
         FROM public.books b
         JOIN public.shelves s ON s.slug = b.shelf_slug
        WHERE b.slug = $2 AND b.shelf_slug = $1`,
      { bind: [shelfSlug, bookSlug], transaction: t, type: QueryTypes.SELECT },
    ),
  );
  return rows[0] ?? null;
}

export async function listPages(bookSlug: string): Promise<AdminPageRow[]> {
  const userId = await getAdminUserId();
  if (!userId) return [];

  const rows = await withRole(userId, (t) =>
    sequelize.query<PageRow>(
      `SELECT id, position, heading, body, image_url, image_source, image_credit, caption, summary
         FROM public.pages
        WHERE book_slug = $1
        ORDER BY position`,
      { bind: [bookSlug], transaction: t, type: QueryTypes.SELECT },
    ),
  );

  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    heading: r.heading,
    body: r.body,
    imageUrl: r.image_url,
    imageSource: r.image_source,
    imageCredit: r.image_credit,
    caption: r.caption,
    summary: r.summary ?? [],
  }));
}
