import type { ContentPage } from "@/lib/content/types";
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
      className={`flex h-full w-full flex-col overflow-hidden py-lg ${
        gutter === "left" ? "pl-[64px] pr-xl" : "pl-xl pr-[64px]"
      }`}
    >
      <p className={`${s.runningHead} font-body text-caption text-secondary`}>{bookTitle}</p>

      <h2 className="mt-md font-heading text-headline-sm text-primary-dark">{page.heading}</h2>
      <span aria-hidden className={s.headingRule} />

      {page.image && (
        <figure className="mb-md flex flex-col gap-xs">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nội dung tĩnh trong public/ */}
          <img
            src={page.image}
            alt={page.caption ?? page.heading}
            className="aspect-[4/3] w-full rounded-sm object-cover"
          />
          {/* Một `<figure>` chỉ được có ĐÚNG MỘT `<figcaption>`, nên chú thích và dòng ghi
              công nằm chung một thẻ chứ không phải hai. */}
          {(page.caption || page.imageCredit) && (
            <figcaption className="font-body text-caption text-secondary">
              {page.caption && <span className="italic">{page.caption}</span>}
              {/* Nguồn hiển thị dưới dạng VĂN BẢN THƯỜNG, cố ý không bọc `<a href>`: giá trị
                  thật trong DB là chuỗi mô tả có khoảng trắng và gạch ngang dài
                  ("https://github.com/…/ChronoShelf — public/items/x.svg"), bọc vào liên kết
                  chỉ ra một link chết 404. Điều kiện BY của CC BY-SA đòi ghi công và nêu
                  nguồn, không đòi nguồn phải bấm được. */}
              {page.imageCredit && (
                <span className="block">
                  Ảnh: {page.imageCredit}
                  {page.imageSource && <> — Nguồn: {page.imageSource}</>}
                </span>
              )}
            </figcaption>
          )}
        </figure>
      )}

      <p className={`${s.body} font-body text-body-book leading-[1.75] text-primary-dark`}>
        {page.body}
      </p>

      {page.summary && (
        <ul className={`${s.summary} mt-md flex flex-col gap-sm`}>
          {page.summary.map((line) => (
            <li key={line} className="font-body text-body-md leading-[1.7] text-primary-dark">
              {line}
            </li>
          ))}
        </ul>
      )}

      <span className={`${s.folio} mt-auto pt-md`}>{pageNumber}</span>
    </div>
  );
}
