import type { ContentPage } from "@/lib/content/types";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import s from "./reader.module.scss";

/**
 * Nội dung một mặt giấy. Nền giấy, rãnh gáy và bóng đổ do `.face` trong reader.module.scss
 * lo — ở đây chỉ có chữ, để cùng một khối nội dung dùng được cho cả mặt trước lẫn mặt sau
 * của tờ giấy.
 *
 * Trang được xếp theo lối sách in chứ không theo lối thẻ giao diện: tên sách chạy đầu trang,
 * chữ cái đầu đoạn được thả to xuống hai dòng, số trang nằm giữa chân trang. Bản trước xếp
 * theo lối thẻ (tiêu đề → ảnh → đoạn văn) nên tờ giấy đọc ra là một cái card đặt trên nền
 * giấy, không phải một trang sách.
 *
 * Lề phía gáy phải rộng hơn: chữ sát vào rãnh gáy sẽ chìm vào bóng. Mặt trước của tờ giấy
 * là trang bên phải nên gáy ở bên trái; mặt sau bị xoay 180° nên trong hệ tọa độ riêng của
 * nó, cạnh gáy lại nằm ở bên phải.
 */
export function BookPage({
  page,
  pageNumber,
  gutter,
  bookTitle,
}: {
  page: ContentPage;
  pageNumber: number;
  gutter: "left" | "right";
  bookTitle: string;
}) {
  return (
    <div
      // `overflow-y-auto` chứ KHÔNG phải `overflow-hidden`. Bản trước cắt cụt nội dung
      // trong im lặng — không thanh cuộn, không dấu hiệu gì — và nó đang cắt thật: đo
      // trên chính app này ở 1024×768, 7/52 trang vượt quá 580px chiều cao mặt giấy.
      // Nặng nhất là "Từ vỏ sò đến tiền giấy" trang 4: cần 666px, mất 86px, tức gạch đầu
      // dòng cuối của phần TỔNG KẾT đứt ngang giữa dòng và số trang biến mất hẳn.
      //
      // ponytail: đây là cầm máu, không phải chữa gốc. Gốc là trang tổng kết được nhét
      // vào đuôi trang cuối thay vì là một mặt giấy riêng — `content.md` §4.3 gọi nó là
      // MỘT TRANG. Đường nâng cấp: thêm `kind: "summary"` vào `Face` trong
      // `BookReaderModal.buildFaces()`. Cùng đường đó chữa luôn chuyện một tấm ảnh minh
      // họa (tốn 366px) không nhét vừa bất kỳ trang nào trong kho.
      className={`flex h-full w-full flex-col overflow-y-auto py-lg ${
        gutter === "left" ? "pl-3xl pr-xl" : "pl-xl pr-3xl"
      }`}
    >
      <p className={`${s.runningHead} font-ui text-caption text-ink-dilute`}>{bookTitle}</p>

      <h2 className="mt-md font-ui text-title-md text-primary">{page.heading}</h2>
      <span aria-hidden className={s.headingRule} />

      {page.image && (
        <figure className="mb-md flex flex-col gap-xs">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nằm trong bảng `media`, phục vụ qua /media/[id] chứ không qua loader của next/image */}
          <img
            src={page.image}
            alt={page.caption ?? page.heading}
            className="aspect-[4/3] w-full rounded-sm object-cover"
          />
          {/* Một `<figure>` chỉ được có ĐÚNG MỘT `<figcaption>`, nên chú thích và dòng ghi
              công nằm chung một thẻ. Ghi công đi qua `GhiCongAnh`: nguồn là URL thì thành một
              chữ "Nguồn" bấm được — in nguyên URL Wikimedia (hơn 100 ký tự, không khoảng
              trắng) từng tràn ra khỏi mép giấy và đẩy chữ bài học xuống nửa trang. */}
          {(page.caption || page.imageCredit) && (
            <figcaption className="font-ui text-caption text-ink-dilute">
              {page.caption && <span className="block italic">{page.caption}</span>}
              <GhiCongAnh credit={page.imageCredit} nguon={page.imageSource} className="break-words text-ink-dilute" />
            </figcaption>
          )}
        </figure>
      )}

      {/* Không viết `leading-[…]` cạnh một token cỡ chữ: token `body-book` đã mang sẵn giãn
          dòng 1.75 và `body-md` mang 1.6, nên một giá trị viết tay hoặc là nhân đôi nguồn sự
          thật, hoặc là một con số nằm ngoài DESIGN.md (bản trước để `leading-[1.7]` ở khối ý
          chính — 1.7 không tồn tại trong hệ). */}
      <p className={`${s.body} font-ui text-reading text-primary`}>{page.body}</p>

      {page.summary && (
        <ul className={`${s.summary} mt-md flex flex-col gap-sm`}>
          {page.summary.map((line) => (
            <li key={line} className="font-ui text-body-md text-primary">
              {line}
            </li>
          ))}
        </ul>
      )}

      <span className={`${s.folio} mt-auto pt-md`}>{pageNumber}</span>
    </div>
  );
}
