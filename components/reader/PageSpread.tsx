import { Image as ImageIcon } from "lucide-react";
import type { ContentPage } from "@/lib/content/types";
import s from "./reader.module.scss";

/**
 * Một trang đôi giấy da. Trang thường: ảnh minh họa bên trái, nội dung bên phải.
 * Trang cuối (có `summary`) bỏ cột ảnh, dành cả trang cho phần tổng kết.
 */
export function PageSpread({ page }: { page: ContentPage }) {
  const isSummary = Boolean(page.summary?.length);

  return (
    <article
      className={`${s.sheet} ${s.flip} flex overflow-hidden rounded-sm bg-surface shadow-2xl`}
    >
      {!isSummary && (
        <div className="flex w-1/2 flex-col gap-sm border-r border-primary-dark/10 p-xl">
          {page.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh nội dung tĩnh, kích thước do layout quyết định
            <img
              src={page.image}
              alt={page.caption ?? page.heading}
              className="aspect-[4/3] w-full rounded-sm object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-sm rounded-sm bg-neutral">
              <ImageIcon aria-hidden className="h-10 w-10 text-secondary" />
              <p className="font-body text-caption italic text-secondary">
                Ảnh minh họa sẽ được bổ sung
              </p>
            </div>
          )}
          {page.caption && (
            <p className="font-body text-caption italic text-secondary">{page.caption}</p>
          )}
        </div>
      )}

      <div
        className={`flex flex-col gap-md overflow-y-auto p-xl ${isSummary ? "w-full" : "w-1/2"}`}
      >
        <h2 className="font-heading text-headline-md text-primary-dark">{page.heading}</h2>
        <p className="font-body text-body-md text-primary-dark">{page.body}</p>

        {page.summary && (
          <ul className="flex flex-col gap-sm">
            {page.summary.map((line) => (
              <li
                key={line}
                className="border-l-2 border-tertiary-deep pl-md font-body text-body-md text-primary-dark"
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
