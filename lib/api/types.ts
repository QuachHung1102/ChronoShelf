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
  /** Giới thiệu ngắn của kệ. Chuỗi rỗng nghĩa là admin chưa soạn. */
  blurb: string;
  /** Ảnh nền căn phòng + ghi công của nó. Đi thẳng từ `ContentShelf`, không phụ thuộc
   *  trạng thái người dùng — nhưng `BookShelf` chỉ nhận `ShelfView` nên phải qua đây. */
  cover: string | null;
  coverSource: string | null;
  coverCredit: string | null;
  books: BookView[];
}

export interface CompleteBookResult {
  /**
   * `false` nghĩa là bài kiểm tra cuối sách còn câu sai — KHÔNG có vật phẩm nào được
   * trao và `user_book_progress.completed` vẫn nguyên. Quyển không có câu hỏi nào thì
   * trường này luôn `true`.
   *
   * Cố ý để phẳng thay vì dựng union theo `quizPassed`: ba trường dưới đây có giá trị
   * "không có gì" hợp lệ sẵn (false / null / null), nên một union chỉ đổi lấy sự an
   * toàn kiểu bằng một đống thu hẹp kiểu ở mọi chỗ dùng.
   */
  quizPassed: boolean;
  /**
   * Vị trí (đánh số từ 1) của những câu trả lời sai, theo đúng thứ tự `ContentBook.cauHoi`
   * mà client đã nhận. Rỗng khi `quizPassed`.
   *
   * Máy chủ nói RÕ câu nào sai, không chỉ "sai rồi": bài kiểm tra này là hàng rào sư phạm
   * chứ không phải hàng rào bảo mật — nội dung sách vốn công khai và đáp án đoán được
   * bằng cách thử — nên giấu đi chỉ làm học sinh bế tắc chứ không chặn được ai.
   */
  wrongPositions: number[];
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
