import { cache } from "react";
import { Book, Item, Page, Shelf } from "@/lib/db/models";
import { withRole } from "@/lib/db/tx";
import { getSessionUserId } from "@/lib/auth/session";
import type { ContentBook, ContentItem, ContentPage, ContentShelf } from "./types";

/**
 * Nội dung bài học nằm TRONG DATABASE (spec 2026-08-24 §2.1) — admin sửa xong là thấy
 * ngay, không cần build lại.
 *
 * Đọc dưới danh tính của chính người đang xem: với người thường, policy "read
 * published" lọc sạch bản nháp; với admin, cùng policy đó cho thấy cả nháp. Nhờ vậy
 * `/quan-tri` sau này dùng lại đúng hàm này, không cần một đường đọc thứ hai.
 *
 * Đọc được danh tính ở đây là nhờ phiên nằm trong cookie `httpOnly` — nó đi kèm mọi
 * request nên server component biết ai đang xem, không cần đẩy việc này xuống client.
 */

export interface ShelfSummary {
  slug: string;
  name: string;
  countryCode: string | null;
}

/** Sắp theo `position` ở phía JS thay vì trong truy vấn: cú pháp `order` lồng nhau của
 *  Sequelize cho quan hệ hai tầng dài và dễ viết sai hơn hẳn ba dòng này, mà số phần tử
 *  thì luôn nhỏ (một kệ vài chục quyển, một quyển vài chục trang). */
const byPosition = <T extends { position: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.position - b.position);

function toPage(row: Page): ContentPage {
  return {
    heading: row.heading,
    body: row.body,
    image: row.imageUrl,
    caption: row.caption,
    imageSource: row.imageSource,
    imageCredit: row.imageCredit,
    ...(row.summary?.length ? { summary: row.summary } : {}),
  };
}

function toBook(row: Book): ContentBook {
  return {
    slug: row.slug,
    title: row.title,
    era: row.era,
    cover: row.coverUrl,
    rewardItem: row.rewardItemSlug,
    pages: byPosition(row.pages ?? []).map(toPage),
  };
}

function toItem(row: Item): ContentItem {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.imageUrl,
    imageSource: row.imageSource,
    imageCredit: row.imageCredit,
  };
}

/**
 * Trả về null khi không có kệ nào mang slug đó, hoặc kệ đó chưa xuất bản (và người xem
 * không phải admin) — đây là câu trả lời "rỗng" THẬT, và `/[shelf]` 404 đúng trên nó.
 *
 * Database không trả lời được thì NỔ bằng exception, không được trả về null: null ở đây
 * có nghĩa "404", nên một lần database sập sẽ bị hiểu nhầm thành slug không tồn tại thay
 * vì báo lỗi thật. Đó là lý do không có `try/catch` nào ở đây.
 *
 * Bọc bằng `cache()` của React vì `app/[shelf]/page.tsx` gọi hàm này ở CẢ
 * `generateMetadata` lẫn thân trang; thiếu lớp này thì mỗi lượt xem tốn hai lượt truy
 * vấn database.
 */
export const readShelf = cache(async function readShelf(slug: string): Promise<ContentShelf | null> {
  const userId = await getSessionUserId();

  return withRole(userId, async (t) => {
    // Vật phẩm là bảng dùng chung cho mọi kệ nên không lồng vào truy vấn kệ được. Hai
    // truy vấn nằm trong CÙNG transaction nên phải chạy tuần tự — `Promise.all` trên
    // một transaction của Sequelize sẽ gửi hai câu lệnh chồng lên nhau trên một
    // connection và hỏng.
    const shelf = await Shelf.findByPk(slug, {
      include: [{ model: Book, as: "books", include: [{ model: Page, as: "pages" }] }],
      transaction: t,
    });
    if (!shelf) return null;

    const items = await Item.findAll({ transaction: t });

    return {
      slug: shelf.slug,
      name: shelf.name,
      order: shelf.position,
      countryCode: shelf.countryCode,
      items: items.map(toItem),
      books: byPosition(shelf.books ?? []).map(toBook),
    };
  });
});

/**
 * Danh sách kệ đã xuất bản, cho thanh điều hướng và bản đồ.
 *
 * Bọc `cache()` cùng lý do như `readShelf`: hàm này được gọi từ nhiều nơi trong cùng
 * một request (trang, layout, nav).
 */
export const readShelfList = cache(async function readShelfList(): Promise<ShelfSummary[]> {
  const userId = await getSessionUserId();

  const rows = await withRole(userId, (t) =>
    Shelf.findAll({
      attributes: ["slug", "name", "countryCode", "position"],
      order: [["position", "ASC"]],
      transaction: t,
    }),
  );

  return rows.map((r) => ({ slug: r.slug, name: r.name, countryCode: r.countryCode }));
});

export interface ShelfChain extends ShelfSummary {
  /** Theo đúng thứ tự `position`. `rewardItemSlug` là vật phẩm quyển đó THƯỞNG. */
  books: { slug: string; rewardItemSlug: string | null }[];
}

/**
 * Kệ kèm chuỗi sách, đủ để tính "đã mở mấy trên mấy" — không hơn.
 *
 * Cố ý KHÔNG dùng `readShelf()` cho việc này dù nó trả về nhiều hơn: trang chủ có ba kệ,
 * mà `readShelf` nạp cả `pages` (mỗi quyển vài nghìn chữ) chỉ để đếm. Ở đây chỉ cần hai
 * cột của `books`.
 *
 * Trạng thái mở/khóa KHÔNG tính ở đây: nó phụ thuộc túi vật phẩm, mà túi thì nằm sau
 * `/api/me/state` và đổi ngay khi người dùng đọc xong một quyển. Server trả phần TĨNH
 * (chuỗi sách), client ghép phần ĐỘNG (vật phẩm đang có) bằng `resolveState`.
 */
export const readShelfChains = cache(async function readShelfChains(): Promise<ShelfChain[]> {
  const userId = await getSessionUserId();

  const rows = await withRole(userId, (t) =>
    Shelf.findAll({
      attributes: ["slug", "name", "countryCode", "position"],
      include: [{ model: Book, as: "books", attributes: ["slug", "position", "rewardItemSlug"] }],
      order: [["position", "ASC"]],
      transaction: t,
    }),
  );

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    countryCode: r.countryCode,
    books: byPosition(r.books ?? []).map((b) => ({
      slug: b.slug,
      rewardItemSlug: b.rewardItemSlug,
    })),
  }));
});
