import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { getAdminUserId } from "./gate";

/**
 * ĐỌC dữ liệu kệ cho màn quản trị.
 *
 * File này CỐ Ý không có `"use server"`. Trong một file có directive đó, **mọi export
 * đều trở thành một endpoint POST công khai** — kể cả hàm chỉ đọc. Đặt hàm đọc chung
 * chỗ với hàm ghi là vô tình mở thêm bề mặt tấn công không ai định mở. Phần ghi nằm
 * riêng ở `shelves.actions.ts`.
 */

export interface AdminShelfRow {
  slug: string;
  name: string;
  position: number;
  countryCode: string | null;
  blurb: string;
  published: boolean;
  coverUrl: string | null;
  coverSource: string | null;
  coverCredit: string | null;
  /** Số sách trong kệ — quyết định kệ có xóa được không, và hiện ngay trên danh sách. */
  bookCount: number;
}

interface Row {
  slug: string;
  name: string;
  position: number;
  country_code: string | null;
  blurb: string;
  published: boolean;
  cover_url: string | null;
  cover_source: string | null;
  cover_credit: string | null;
  book_count: string;
}

/**
 * Trả về **mọi** kệ, kể cả chưa xuất bản — policy "read published" cho admin thấy cả
 * bản nháp vì nó có vế `OR public.is_admin()`. Người không phải admin gọi hàm này sẽ
 * chỉ thấy kệ đã xuất bản; đó không phải rò rỉ, nhưng cũng không có màn nào gọi nó.
 */
export async function listShelves(): Promise<AdminShelfRow[]> {
  const userId = await getAdminUserId();
  if (!userId) return [];

  const rows = await withRole(userId, (t) =>
    sequelize.query<Row>(
      `SELECT s.slug, s.name, s.position, s.country_code, s.blurb, s.published,
              s.cover_url, s.cover_source, s.cover_credit,
              (SELECT count(*) FROM public.books b WHERE b.shelf_slug = s.slug) AS book_count
         FROM public.shelves s
        ORDER BY s.position`,
      { transaction: t, type: QueryTypes.SELECT },
    ),
  );

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    position: r.position,
    countryCode: r.country_code,
    blurb: r.blurb,
    published: r.published,
    coverUrl: r.cover_url,
    coverSource: r.cover_source,
    coverCredit: r.cover_credit,
    // count() của Postgres là bigint; driver trả về chuỗi để không mất chính xác ở
    // số lớn. Ở đây luôn nhỏ nên ép sang number là an toàn.
    bookCount: Number(r.book_count),
  }));
}
