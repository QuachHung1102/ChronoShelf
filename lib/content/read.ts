import { insforge } from "@/lib/insforge/client";
import type { ContentBook, ContentItem, ContentPage, ContentShelf } from "./types";

/**
 * Nội dung bài học nằm TRONG DATABASE (spec 2026-08-24 §2.1) — admin sửa xong là
 * thấy ngay, không cần build lại.
 *
 * Dữ liệu này public nên server component đọc được bằng khóa anon; RLS tự lọc bản
 * nháp cho ai không phải admin. Chỉ TRẠNG THÁI NGƯỜI DÙNG mới bắt buộc chạy phía
 * client, vì phiên InsForge nằm ở trình duyệt — ranh giới đó giữ nguyên như cũ.
 *
 * Một truy vấn lồng ba tầng shelves → books → pages. PostgREST làm được (đã kiểm
 * bằng request thật ngày 2026-08-24), nên trang kệ chỉ tốn một round-trip.
 */
// Ba hằng số tách riêng (thay vì nối bằng `+`) vì lý do KIỂU, không phải đọc cho dễ:
// `+` giữa hai chuỗi luôn cho ra type `string`, PostgREST-js parse `select` bằng
// template literal type nên `string` (không phải literal) rơi vào nhánh
// `GenericStringError` — `shelfRes.data` mất hết kiểu cụ thể. Ghép bằng `${}` giữa
// các hằng số literal thì TypeScript suy literal type xuyên suốt, đúng như khi viết
// liền một chuỗi.
const PAGE_SELECT = "position, heading, body, image_url, caption, summary";
const BOOK_SELECT = `slug, title, era, cover_url, position, reward_item_slug, pages(${PAGE_SELECT})`;
const SHELF_SELECT = `slug, name, position, country_code, books(${BOOK_SELECT})`;

interface PageRow {
  position: number;
  heading: string;
  body: string;
  image_url: string | null;
  caption: string | null;
  summary: string[] | null;
}

interface BookRow {
  slug: string;
  title: string;
  era: string;
  cover_url: string | null;
  position: number;
  reward_item_slug: string | null;
  pages: PageRow[];
}

interface ShelfRow {
  slug: string;
  name: string;
  position: number;
  country_code: string | null;
  books: BookRow[];
}

interface ItemRow {
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
}

export interface ShelfSummary {
  slug: string;
  name: string;
  countryCode: string | null;
}

const byPosition = <T extends { position: number }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.position - b.position);

function toPage(row: PageRow): ContentPage {
  return {
    heading: row.heading,
    body: row.body,
    image: row.image_url,
    caption: row.caption,
    ...(row.summary?.length ? { summary: row.summary } : {}),
  };
}

function toBook(row: BookRow): ContentBook {
  return {
    slug: row.slug,
    title: row.title,
    era: row.era,
    cover: row.cover_url,
    rewardItem: row.reward_item_slug,
    pages: byPosition(row.pages ?? []).map(toPage),
  };
}

function toItem(row: ItemRow): ContentItem {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.image_url,
  };
}

/** Trả về null khi không có kệ nào mang slug đó, hoặc kệ đó chưa xuất bản. */
export async function readShelf(slug: string): Promise<ContentShelf | null> {
  // Vật phẩm là bảng dùng chung cho mọi kệ nên không lồng được vào truy vấn trên;
  // hai request này độc lập, chạy song song.
  const [shelfRes, itemsRes] = await Promise.all([
    insforge.database.from("shelves").select(SHELF_SELECT).eq("slug", slug).maybeSingle(),
    insforge.database.from("items").select("slug, name, description, image_url"),
  ]);

  if (shelfRes.error || !shelfRes.data) return null;
  const row = shelfRes.data as ShelfRow;

  return {
    slug: row.slug,
    name: row.name,
    order: row.position,
    countryCode: row.country_code,
    items: ((itemsRes.data ?? []) as ItemRow[]).map(toItem),
    books: byPosition(row.books ?? []).map(toBook),
  };
}

/** Danh sách kệ đã xuất bản, cho thanh điều hướng và bản đồ. */
export async function readShelfList(): Promise<ShelfSummary[]> {
  const { data, error } = await insforge.database
    .from("shelves")
    .select("slug, name, position, country_code")
    .order("position");
  if (error) return [];
  // Kiểu riêng, KHÔNG dùng lại ShelfRow: truy vấn này không lấy `books`.
  type ShelfListRow = Omit<ShelfRow, "books">;
  return ((data ?? []) as ShelfListRow[]).map((row) => ({
    slug: row.slug,
    name: row.name,
    countryCode: row.country_code,
  }));
}
