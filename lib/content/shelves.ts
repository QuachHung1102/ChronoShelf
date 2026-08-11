import lichSuVietNam from "@/content/shelves/lich-su-viet-nam.json";
import type { ContentBook, ContentItem, ContentShelf } from "./types";

/**
 * Nội dung bài học là dữ liệu biên tập, không phải dữ liệu người dùng — nó nằm
 * trong repo dưới dạng JSON và được import thẳng vào bundle, nên trang kệ sách
 * và trang đọc render tĩnh được (content.md §8).
 *
 * Database chỉ giữ tiến độ đọc, kho vật phẩm, và bảng xương mở khóa sinh ra từ
 * chính các file này bằng `npm run content:sync`.
 */
const SHELVES: ContentShelf[] = [lichSuVietNam as ContentShelf];

export function getAllShelves(): ContentShelf[] {
  return [...SHELVES].sort((a, b) => a.order - b.order);
}

export function getShelf(slug: string): ContentShelf {
  const shelf = SHELVES.find((s) => s.slug === slug);
  if (!shelf) throw new Error(`Không có kệ sách "${slug}" trong content/shelves/.`);
  return shelf;
}

export function getBook(shelfSlug: string, bookSlug: string): ContentBook {
  const book = getShelf(shelfSlug).books.find((b) => b.slug === bookSlug);
  if (!book) throw new Error(`Không có quyển "${bookSlug}" trong kệ "${shelfSlug}".`);
  return book;
}

/** Tra vật phẩm theo slug trên toàn bộ các kệ (bộ vật phẩm là chung). */
export function getItem(itemSlug: string): ContentItem | null {
  for (const shelf of SHELVES) {
    const item = shelf.items.find((i) => i.slug === itemSlug);
    if (item) return item;
  }
  return null;
}
