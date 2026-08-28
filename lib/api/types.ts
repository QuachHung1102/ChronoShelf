import type { ContentBook, ContentItem } from "@/lib/content/types";

export type BookState = "locked" | "unlocked" | "completed";

/** Nội dung đọc từ database (server component, khóa anon), ghép với trạng thái người dùng —
 *  cũng ở DB, nhưng bắt buộc đọc phía client vì phiên đăng nhập InsForge nằm ở trình duyệt. */
export interface BookView {
  book: ContentBook;
  state: BookState;
  currentPage: number;
  /** Vật phẩm cần để mở — chỉ khác null khi state === "locked". */
  requiredItem: ContentItem | null;
}

export interface ShelfView {
  slug: string;
  name: string;
  books: BookView[];
}

export interface CompleteBookResult {
  alreadyCompleted: boolean;
  grantedItemSlug: string | null;
  nextBook: { slug: string; unlocked: boolean } | null;
}

/** Trạng thái người dùng cho một kệ — phần duy nhất đến từ database. */
export interface UserShelfState {
  ownedItemSlugs: Set<string>;
  progressByBook: Map<string, { currentPage: number; completed: boolean }>;
}
