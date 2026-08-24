export interface ContentItem {
  slug: string;
  name: string;
  image: string | null;
  description: string;
}

export interface ContentPage {
  heading: string;
  image: string | null;
  caption: string | null;
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
  /**
   * Vật phẩm nhận được khi đọc xong. Đây cũng là thứ mở khóa quyển kế tiếp —
   * không có trường `requiredItem`, xem lib/insforge/unlock.ts.
   */
  rewardItem: string | null;
  pages: ContentPage[];
}

export interface ContentShelf {
  slug: string;
  name: string;
  order: number;
  /** Mã ISO-3166-1 numeric để nối với bản đồ thế giới; null nghĩa là chưa gắn. */
  countryCode: string | null;
  items: ContentItem[];
  books: ContentBook[];
}
