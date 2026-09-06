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

/**
 * Một câu hỏi trắc nghiệm cuối sách, ĐÚNG PHẦN được phép tới trình duyệt.
 *
 * Không có trường đáp án, và đó là toàn bộ điểm của kiểu này: `correct_index` không có
 * GRANT SELECT cho role nào của ứng dụng (`db/schema/05-content-rls.sql`), nên chấm bài
 * chỉ xảy ra được bên trong `complete_book`.
 */
export interface ContentQuestion {
  prompt: string;
  choices: string[];
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
  /**
   * Quyển này đã xuất bản chưa. Policy "read published" đã lọc bản nháp cho người
   * thường, nên với họ trường này LUÔN true; nó chỉ mang thông tin khi người xem là
   * admin — và đúng lúc đó kệ phải nói rõ quyển nào học sinh chưa nhìn thấy.
   */
  published: boolean;
  pages: ContentPage[];
  /**
   * Bài kiểm tra cuối sách, theo thứ tự `position` (content.md §4.3). Mảng RỖNG nghĩa là
   * quyển này không có bài kiểm tra và đọc hết trang là nhận vật phẩm — đúng hành vi cũ,
   * và là trạng thái của mọi quyển chưa được admin soạn câu hỏi.
   *
   * Thứ tự ở đây là hợp đồng: client gửi lại một mảng đáp án SONG SONG với mảng này, và
   * `complete_book` chấm theo đúng thứ tự đó chứ không theo giá trị `position`.
   */
  cauHoi: ContentQuestion[];
}

export interface ContentShelf {
  slug: string;
  name: string;
  order: number;
  /** Giới thiệu ngắn do admin soạn. Chuỗi rỗng nghĩa là chưa có. */
  blurb: string;
  /** Mã ISO-3166-1 numeric để nối với bản đồ thế giới; null nghĩa là chưa gắn. */
  countryCode: string | null;
  /** Ảnh nền của căn phòng khi vào kệ này. Không có thì phòng vẽ hoàn toàn bằng CSS. */
  cover: string | null;
  coverSource: string | null;
  coverCredit: string | null;
  items: ContentItem[];
  books: ContentBook[];
}
