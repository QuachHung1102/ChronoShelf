"use client";

import { resolveState } from "./unlock";
import { findItem } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
import type { BookView, CompleteBookResult, ShelfView, UserShelfState } from "./types";

/**
 * Trạng thái người dùng và các hành động lên nó, nhìn từ trình duyệt.
 *
 * Mọi thứ ở đây đi qua Route Handler chứ không chạm database: phiên nằm trong cookie
 * `httpOnly`, và quan trọng hơn — quyết định trao vật phẩm phải ở phía máy chủ.
 */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: unknown })?.error;
    throw new Error(typeof msg === "string" ? msg : "Không kết nối được máy chủ.");
  }
  return data as T;
}

interface StateResponse {
  ownedItemSlugs: string[];
  progress: { bookSlug: string; currentPage: number; completed: boolean }[];
  streak: number;
}

/**
 * Đọc vật phẩm đang sở hữu và tiến độ đọc.
 * Chưa đăng nhập thì trả về rỗng — kệ sách vẫn xem được, chỉ quyển đầu mở.
 */
export async function getUserShelfState(): Promise<UserShelfState> {
  const data = await req<StateResponse>("/api/me/state");
  return {
    // Máy chủ tính chuỗi, client chỉ hiển thị. Tính ở client thì đồng hồ máy khách sửa
    // được — và chuỗi giữ lửa là thứ sẽ gắn với danh hiệu và phần thưởng (§6).
    streak: data.streak ?? 0,
    ownedItemSlugs: new Set(data.ownedItemSlugs),
    progressByBook: new Map(
      data.progress.map((p) => [p.bookSlug, { currentPage: p.currentPage, completed: p.completed }]),
    ),
  };
}

/** Ghép nội dung (đã tải từ server component) với trạng thái người dùng. */
export function buildShelfView(shelf: ContentShelf, state: UserShelfState): ShelfView {
  return {
    slug: shelf.slug,
    name: shelf.name,
    blurb: shelf.blurb,
    cover: shelf.cover,
    coverSource: shelf.coverSource,
    coverCredit: shelf.coverCredit,
    books: shelf.books.map((book, index): BookView => {
      const progress = state.progressByBook.get(book.slug);
      // Vật phẩm mở quyển này = vật phẩm thưởng của quyển ngay trước (spec §2.2).
      const prevRewardItem = index === 0 ? null : shelf.books[index - 1].rewardItem;
      const bookState = resolveState(
        prevRewardItem,
        index === 0,
        progress?.completed ?? false,
        state.ownedItemSlugs,
      );
      return {
        book,
        state: bookState,
        currentPage: progress?.currentPage ?? 1,
        requiredItem:
          bookState === "locked" && prevRewardItem ? findItem(shelf, prevRewardItem) : null,
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
  const data = await req<{ saved: boolean }>("/api/me/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookSlug, page }),
  });
  return data.saved;
}

/**
 * Chốt hoàn thành quyển sách. Máy chủ quyết định vật phẩm và việc mở khóa —
 * client chỉ báo "đã đọc xong quyển này" và nộp bài kiểm tra.
 * An toàn để gọi lại: hàm idempotent, gọi hai lần không nhân đôi vật phẩm.
 *
 * `answers` là chỉ số lựa chọn đã chọn (0-based), SONG SONG với `book.cauHoi` — phần tử
 * thứ i là đáp án cho câu hỏi thứ i. Câu chưa chọn thì để `-1`: máy chủ coi mọi thứ
 * khác đáp án đúng là sai, nên chỗ trống không được lặng lẽ thành "miễn bài". Quyển
 * không có câu hỏi nào thì truyền mảng rỗng.
 *
 * Chấm bài KHÔNG xảy ra ở đây và không thể xảy ra ở đây: đáp án không có `GRANT SELECT`
 * cho role nào của ứng dụng, nên nó chưa từng rời khỏi database.
 */
export async function completeBook(
  bookSlug: string,
  answers: number[],
): Promise<CompleteBookResult> {
  return req<CompleteBookResult>("/api/me/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookSlug, answers }),
  });
}
