import { cache } from "react";
import { Book, Lesson } from "@/lib/db/models";
import { withRole } from "@/lib/db/tx";
import { getSessionUserId } from "@/lib/auth/session";

/**
 * Thư viện bài giảng (content.md §7).
 *
 * Đọc dưới danh tính của chính người đang xem, cùng lối với `lib/content/read.ts`: policy
 * `read published` lọc sạch bản nháp cho người thường và cho admin thấy cả nháp, nên
 * `/bai-giang` và `/quan-tri/bai-giang` dùng chung đúng một đường đọc.
 */

export const CAC_LOP = [10, 11, 12] as const;
export type Lop = (typeof CAC_LOP)[number];

export interface BaiGiang {
  slug: string;
  grade: number;
  title: string;
  summary: string;
  /** Giá trị thô của cột — form quản trị cần nó để chọn lại đúng quyển. */
  bookSlug: string | null;
  /**
   * Quyển sách gắn kèm, kèm kệ chứa nó để dựng liên kết. Null khi bài không gắn quyển
   * nào, VÀ cũng null khi quyển đó còn nháp với người đang xem — policy `read published`
   * của `books` lọc trước, nên tên sách chưa ra mắt không lọt ra qua đường này.
   */
  sach: { slug: string; title: string; shelfSlug: string } | null;
  slideUrl: string | null;
  slideFilename: string | null;
  previewUrl: string | null;
  previewSource: string | null;
  previewCredit: string | null;
  mindmapUrl: string | null;
  mindmapSource: string | null;
  mindmapCredit: string | null;
  published: boolean;
}

function toBaiGiang(row: Lesson): BaiGiang {
  return {
    slug: row.slug,
    grade: row.grade,
    title: row.title,
    summary: row.summary,
    bookSlug: row.bookSlug,
    sach: row.book
      ? { slug: row.book.slug, title: row.book.title, shelfSlug: row.book.shelfSlug }
      : null,
    slideUrl: row.slideSha256 ? `/tai-lieu/${row.slideSha256}` : null,
    slideFilename: row.slideFilename,
    previewUrl: row.previewUrl,
    previewSource: row.previewSource,
    previewCredit: row.previewCredit,
    mindmapUrl: row.mindmapUrl,
    mindmapSource: row.mindmapSource,
    mindmapCredit: row.mindmapCredit,
    published: row.published,
  };
}

/**
 * Toàn bộ bài giảng người đang xem được phép thấy, sắp theo `grade` rồi `title`.
 *
 * Không phân trang: một chương trình phổ thông ba khối là vài chục bài, và số đó không
 * tăng theo số người dùng. ponytail: thêm phân trang khi một trường thật sự đổ vào đây
 * hàng trăm bài.
 */
export const readBaiGiang = cache(async function readBaiGiang(): Promise<BaiGiang[]> {
  const userId = await getSessionUserId();
  const rows = await withRole(userId, (t) =>
    Lesson.findAll({
      // Kệ chứa quyển: cần để dựng liên kết "gắn với quyển …". Policy `read published`
      // của `books` vẫn áp ở đây, nên bài giảng trỏ vào một quyển còn nháp sẽ trả về
      // `book: null` với người thường — mất liên kết, không lộ tên sách chưa ra mắt.
      include: [{ model: Book, as: "book", attributes: ["slug", "title", "shelfSlug"] }],
      order: [
        ["grade", "ASC"],
        ["title", "ASC"],
      ],
      transaction: t,
    }),
  );
  return rows.map(toBaiGiang);
});

/** Gom theo lớp, giữ đủ ba khối kể cả khối chưa có bài nào. */
export function nhomTheoLop(bai: BaiGiang[]): { lop: Lop; bai: BaiGiang[] }[] {
  return CAC_LOP.map((lop) => ({ lop, bai: bai.filter((b) => b.grade === lop) }));
}
