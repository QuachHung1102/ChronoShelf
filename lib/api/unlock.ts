import type { BookState } from "./types";

/**
 * Quy tắc mở khóa của cả sản phẩm, tách riêng ra khỏi `shelf.ts` vì đúng một lý do:
 * file này không import gì ngoài kiểu, nên `node --test` chạy thẳng được. Mọi module
 * đi qua alias `@/` đều không resolve dưới test runner của Node (đã thử), và quy tắc
 * này quá quan trọng để chỉ dựa vào việc bấm thử trên giao diện.
 *
 * Đây là bản chiếu phía client, dùng để vẽ kệ. Quyết định thật nằm ở RPC
 * `complete_book` trong Postgres — client không bao giờ được tự trao vật phẩm.
 *
 * `prevRewardItem` là vật phẩm thưởng của quyển NGAY TRƯỚC trong kệ. Không có cột
 * "vật phẩm cần để mở" nào trong database: nó suy ra được 100% từ vị trí, nên không
 * lưu thì chuỗi mở khóa không thể đứt.
 *
 * ponytail: khóa cứng chuỗi tuyến tính một-kệ. Muốn mở khóa chéo kệ hay phân nhánh
 * thì thêm lại cột `books.required_item_slug` nullable, null nghĩa là "vật phẩm của
 * quyển trước", rồi truyền nó vào đây thay cho `prevRewardItem`.
 */
export function resolveState(
  prevRewardItem: string | null,
  isFirstBook: boolean,
  completed: boolean,
  owned: Set<string>,
): BookState {
  if (completed) return "completed";
  // Quyển đầu mỗi kệ luôn mở sẵn để người học có điểm bắt đầu (content.md 4.1).
  if (isFirstBook || prevRewardItem === null) return "unlocked";
  return owned.has(prevRewardItem) ? "unlocked" : "locked";
}
