import type { ContentBook, ContentItem, ContentShelf } from "./types";

/** Tra cứu trong một kệ ĐÃ TẢI. Không chạm database — nội dung đi xuống qua prop. */
export function findBook(shelf: ContentShelf, bookSlug: string): ContentBook | null {
  return shelf.books.find((b) => b.slug === bookSlug) ?? null;
}

export function findItem(shelf: ContentShelf, itemSlug: string): ContentItem | null {
  return shelf.items.find((i) => i.slug === itemSlug) ?? null;
}
