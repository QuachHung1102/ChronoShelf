import type { AnhCoCredit } from "./CompareSlider";

/**
 * Bốn khối "Ngày ấy – Bây giờ" của trang chủ (content.md §5.1).
 *
 * VÌ SAO NẰM TRONG MÃ NGUỒN CHỨ KHÔNG TRONG DATABASE — đây là ngoại lệ có chủ ý với quy tắc
 * "nội dung nằm trong database" ở CLAUDE.md, và ranh giới của ngoại lệ đó rất hẹp:
 *
 *   - Quy tắc kia sinh ra cho NỘI DUNG BÀI HỌC (kệ, sách, trang, vật phẩm), thứ mà admin
 *     phải thêm sửa lúc chạy mà không cần build lại. Bốn khối này thì ngược lại: chúng là
 *     phần MỞ ĐẦU cố định của sản phẩm, đổi cùng nhịp với chính bố cục trang chủ.
 *   - Đưa chúng vào database sẽ cần thêm một bảng, một màn quản trị, và một bộ ràng buộc
 *     credit riêng — toàn bộ chỉ để sửa bốn đoạn văn mà hai năm nữa vẫn thế.
 *
 * Ngày nào trang chủ cần đổi nội dung lúc chạy thì đường nâng cấp là một bảng `home_blocks`
 * dùng lại đúng khuôn `image_url/image_source/image_credit` của `pages`, và ràng buộc
 * ảnh-phải-có-credit chép y nguyên từ `10-image-credit.sql`.
 *
 * ẢNH: tải từ Wikimedia Commons, commit sẵn trong `public/timeline/`. KHÔNG ghi vào
 * `public/` lúc chạy (bẫy đã ghi trong CLAUDE.md: `next start` trả 404). Mỗi tấm bắt buộc
 * có `credit` + `source` và cả hai được hiển thị dưới ảnh — điều kiện BY của giấy phép.
 */
export interface KhoiSoSanh {
  key: string;
  /** Mốc thời gian in ở lề trái, ví dụ "Thời tiền sử". */
  moc: string;
  chuDe: string;
  dan: string;
  xua: AnhCoCredit;
  nay: AnhCoCredit;
}

export const KHOI_SO_SANH: KhoiSoSanh[] = [
  {
    key: "am-thuc",
    moc: "Thời tiền sử → hôm nay",
    chuDe: "Ẩm thực",
    dan:
      "Tổ tiên chúng ta ăn thứ săn bắt và hái lượm được trong ngày, nướng trên lửa trại. " +
      "Bữa ăn phụ thuộc vào may rủi của một buổi đi săn. Ngày nay một bữa nóng tới tay " +
      "trong mười phút, và câu hỏi khó nhất là chọn món gì.",
    xua: {
      src: "/timeline/am-thuc-xua.jpg",
      alt: "Mô hình gia đình thời tiền sử quây quanh đống lửa trong hang, trưng bày ở bảo tàng",
      credit: "Gary Todd · CC0",
      source: "https://commons.wikimedia.org/wiki/File:Prehistoric_Family_Diorama_(10126693324).jpg",
    },
    nay: {
      src: "/timeline/am-thuc-nay.jpg",
      alt: "Người đàn ông thái rau trong một căn bếp hiện đại đầy đủ tiện nghi",
      credit: "Shixart1985 · CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Man_prepares_vegetables_in_a_modern_kitchen.jpg",
    },
  },
  {
    key: "trang-phuc",
    moc: "Thời đồ đá → thế kỷ 21",
    chuDe: "Trang phục",
    dan:
      "Quần áo đầu tiên là da thú khâu bằng gân, rồi tới vải thô dệt tay — mỗi tấm là " +
      "nhiều ngày công. Sợi tổng hợp và máy dệt đã biến thứ từng quý như của hồi môn thành " +
      "món có thể thay mỗi mùa.",
    xua: {
      src: "/timeline/trang-phuc-xua.jpg",
      alt: "Hai người mặc áo dệt thô, ngồi trên tấm da thú và xay hạt bằng đá trong một dự án tái hiện thời đồ đá",
      credit: "Bengt Fredriksson · CC BY-SA 3.0",
      source: "https://commons.wikimedia.org/wiki/File:Stone_age_projekt_in_Sweden_5.jpg",
    },
    nay: {
      src: "/timeline/trang-phuc-nay.jpg",
      alt: "Người phụ nữ chọn áo trên giá treo chật kín trong một cửa hàng quần áo",
      credit: "PattayaPatrol · CC BY-SA 4.0",
      source: "https://commons.wikimedia.org/wiki/File:DFC_0796_A_woman_browsing_shirts_on_a_crowded_clothing_rack_in_a_busy_store_with_mannequins_and_folded_garments_nearby.jpg",
    },
  },
  {
    key: "nha-o",
    moc: "Hang đá → đô thị",
    chuDe: "Nhà ở & định cư",
    dan:
      "Con người từng trú trong hang đá, rồi dựng túp lều tranh vách đất ngay cạnh nơi có " +
      "nước. Khi biết trồng trọt, chỗ ở thành nơi ở lại — và làng trở thành thành phố, rồi " +
      "thành những tòa nhà cao hơn mọi ngọn cây.",
    xua: {
      src: "/timeline/nha-o-xua.jpg",
      alt: "Nhà tròn mái tranh vách đất được phục dựng bên một nhà thờ cổ",
      credit: "Chris Morgan · CC BY-SA 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Reconstruction_of_a_roundhouse_beside_Mellor_church_-_geograph.org.uk_-_3124630.jpg",
    },
    nay: {
      src: "/timeline/nha-o-nay.jpg",
      alt: "Toàn cảnh Thành phố Hồ Chí Minh lúc hoàng hôn với nhiều tòa nhà cao tầng bên sông",
      credit: "Lê Minh Phát · CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Ho_Chi_Minh_City_panorama_2019_(cropped2).jpg",
    },
  },
  {
    key: "giao-tiep",
    moc: "Thẻ tre → tức thì",
    chuDe: "Giao tiếp",
    dan:
      "Chữ từng được khắc lên thẻ tre, viết trên lá cây, và một lá thư có thể mất hàng " +
      "tháng mới tới nơi — hoặc không bao giờ tới. Bây giờ một dòng tin đi nửa vòng Trái Đất " +
      "nhanh hơn thời gian bạn đọc hết câu này.",
    xua: {
      src: "/timeline/giao-tiep-xua.jpg",
      alt: "Cuốn sách thẻ tre trải rộng, chữ viết dọc trên từng thanh tre",
      credit: "vlasta2 (bluefootedbooby) · CC BY 2.0",
      source: "https://commons.wikimedia.org/wiki/File:Bamboo_book_-_unfolded_-_UCR.jpg",
    },
    nay: {
      src: "/timeline/giao-tiep-nay.jpg",
      alt: "Người phụ nữ đứng bên cửa sổ, hai tay bấm nhắn tin trên điện thoại thông minh",
      credit: "Kristin Hardwick · CC0",
      source: "https://commons.wikimedia.org/wiki/File:Woman_texting_on_a_smartphone.jpg",
    },
  },
];
