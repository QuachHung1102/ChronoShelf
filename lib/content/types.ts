export interface ContentItem {
  slug: string;
  name: string;
  image: string | null;
  /**
   * Cùng lý do như `ContentPage.imageSource`/`imageCredit` — ràng buộc
   * `items_image_credit_ck` bắt buộc có cả hai khi `image` khác null, nên chúng phải đi
   * tới tận màn hình. Đây còn là chỗ DUY NHẤT hiện đang thật sự có ảnh trong database.
   */
  imageSource: string | null;
  imageCredit: string | null;
  description: string;
}

export interface ContentPage {
  heading: string;
  image: string | null;
  caption: string | null;
  /**
   * Nguồn ảnh và dòng ghi công (tác giả + giấy phép). DB bắt buộc có cả hai khi `image`
   * khác null — ràng buộc `pages_image_credit_ck` trong `db/schema/10-image-credit.sql`.
   * Ràng buộc đó dựng lên vì điều kiện BY của CC BY-SA, nên hai trường này PHẢI đi tới
   * tận người đọc; thiếu chỗ hiển thị thì cả ràng buộc lẫn công thu thập đều vô nghĩa.
   */
  imageSource: string | null;
  imageCredit: string | null;
  body: string;
  /** Chỉ có ở trang cuối — 3-5 ý chính (content.md 4.3). */
  summary?: string[];
}

export interface ContentBook {
  slug: string;
  title: string;
  /** Niên đại dập trên bìa sách — chuỗi ngắn, ví dụ "Năm 938". */
  era: string;
  cover: string | null;
  /** Ghi công ảnh bìa. Ràng buộc `books_cover_credit_ck` đòi có đủ khi `cover` khác null. */
  coverSource: string | null;
  coverCredit: string | null;
  /**
   * Vật phẩm nhận được khi đọc xong. Đây cũng là thứ mở khóa quyển kế tiếp —
   * không có trường `requiredItem`, xem lib/api/unlock.ts.
   */
  rewardItem: string | null;
  /**
   * Bài giảng đã xuất bản gắn với quyển này (content.md §7, "liên kết chéo"). Gắn sẵn ở
   * đây thay vì hỏi thêm một request lúc đọc xong: màn "đọc xong" đã nhận cả kệ, nên
   * liên kết chỉ hiện khi thật sự có chỗ để tới.
   */
  baiGiang: { slug: string; title: string; grade: number }[];
  pages: ContentPage[];
}

export interface ContentShelf {
  slug: string;
  name: string;
  order: number;
  /** Mã ISO-3166-1 numeric để nối với bản đồ thế giới; null nghĩa là chưa gắn. */
  countryCode: string | null;
  /** Ảnh nền của căn phòng khi vào kệ này. Không có thì phòng vẽ hoàn toàn bằng CSS. */
  cover: string | null;
  coverSource: string | null;
  coverCredit: string | null;
  items: ContentItem[];
  books: ContentBook[];
}
