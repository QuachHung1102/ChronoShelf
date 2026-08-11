import { insforge } from "./client";
import { getItem, getShelf } from "@/lib/content/shelves";
import type { BookState, BookView, CompleteBookResult, ShelfView, UserShelfState } from "./types";

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await insforge.auth.getCurrentUser();
  return data?.user?.id ?? null;
}

/**
 * Đọc phần duy nhất nằm trong database: vật phẩm đang sở hữu và tiến độ đọc.
 * Chưa đăng nhập thì trả về rỗng — kệ sách vẫn xem được, chỉ quyển đầu mở.
 */
export async function getUserShelfState(): Promise<UserShelfState> {
  const empty: UserShelfState = { ownedItemSlugs: new Set(), progressByBook: new Map() };
  if (!(await getCurrentUserId())) return empty;

  const [items, progress] = await Promise.all([
    insforge.database.from("user_items").select("item_slug"),
    insforge.database.from("user_book_progress").select("book_slug, current_page, completed"),
  ]);
  if (items.error || progress.error) return empty;

  return {
    ownedItemSlugs: new Set(
      ((items.data ?? []) as { item_slug: string }[]).map((r) => r.item_slug),
    ),
    progressByBook: new Map(
      ((progress.data ?? []) as { book_slug: string; current_page: number; completed: boolean }[])
        .map((r) => [r.book_slug, { currentPage: r.current_page, completed: r.completed }]),
    ),
  };
}

function resolveState(
  requiredItem: string | null,
  isFirstBook: boolean,
  completed: boolean,
  owned: Set<string>,
): BookState {
  if (completed) return "completed";
  // Quyển đầu mỗi kệ luôn mở sẵn để người học có điểm bắt đầu (content.md 4.1).
  if (isFirstBook || requiredItem === null) return "unlocked";
  return owned.has(requiredItem) ? "unlocked" : "locked";
}

/** Ghép nội dung tĩnh với trạng thái người dùng thành view của kệ sách. */
export function buildShelfView(shelfSlug: string, state: UserShelfState): ShelfView {
  const shelf = getShelf(shelfSlug);
  return {
    slug: shelf.slug,
    name: shelf.name,
    books: shelf.books.map((book, index): BookView => {
      const progress = state.progressByBook.get(book.slug);
      const bookState = resolveState(
        book.requiredItem,
        index === 0,
        progress?.completed ?? false,
        state.ownedItemSlugs,
      );
      return {
        book,
        state: bookState,
        currentPage: progress?.currentPage ?? 1,
        requiredItem:
          bookState === "locked" && book.requiredItem ? getItem(book.requiredItem) : null,
      };
    }),
  };
}

/**
 * Lưu trang đang đọc. Không đi qua RPC vì đây không phải điểm chống gian lận —
 * nó chỉ quyết định lần sau mở lại vào trang nào.
 * Trả về false khi chưa đăng nhập (tiến độ không lưu được, không phải lỗi).
 */
export async function setCurrentPage(bookSlug: string, page: number): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const existing = await insforge.database
    .from("user_book_progress")
    .select("id")
    .eq("book_slug", bookSlug)
    .maybeSingle();

  const res = existing.data
    ? await insforge.database
        .from("user_book_progress")
        .update({ current_page: page })
        .eq("book_slug", bookSlug)
    : await insforge.database
        .from("user_book_progress")
        .insert([{ user_id: userId, book_slug: bookSlug, current_page: page }]);

  if (res.error) throw new Error("Không lưu được tiến độ đọc.");
  return true;
}

/**
 * Chốt hoàn thành quyển sách. Máy chủ quyết định vật phẩm và việc mở khóa —
 * client chỉ báo "đã đọc xong quyển này".
 * An toàn để gọi lại: hàm idempotent, gọi hai lần không nhân đôi vật phẩm.
 */
export async function completeBook(bookSlug: string): Promise<CompleteBookResult> {
  const { data, error } = await insforge.database.rpc("complete_book", {
    p_book_slug: bookSlug,
  });
  if (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`Không ghi nhận được kết quả đọc: ${message}`);
  }
  return data as CompleteBookResult;
}
