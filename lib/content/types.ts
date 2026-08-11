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
  cover: string | null;
  requiredItem: string | null;
  rewardItem: string | null;
  pages: ContentPage[];
}

export interface ContentShelf {
  slug: string;
  name: string;
  order: number;
  items: ContentItem[];
  books: ContentBook[];
}
