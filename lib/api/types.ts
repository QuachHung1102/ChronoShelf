import type { ContentBook, ContentItem } from "@/lib/content/types";

export type BookState = "locked" | "unlocked" | "completed";

/** Nội dung đọc từ database ở server component, ghép với trạng thái người dùng — cũng ở
 *  DB, nhưng đọc phía client để làm mới được ngay sau khi đọc xong một quyển. */
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
  /** Ảnh nền căn phòng + ghi công của nó. Đi thẳng từ `ContentShelf`, không phụ thuộc
   *  trạng thái người dùng — nhưng `BookShelf` chỉ nhận `ShelfView` nên phải qua đây. */
  cover: string | null;
  coverSource: string | null;
  coverCredit: string | null;
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
  /** Số ngày học liên tục, do máy chủ tính (content.md §6). */
  streak: number;
}
