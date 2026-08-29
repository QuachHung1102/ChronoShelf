import { LockOpen, Sparkles } from "lucide-react";
import { findBook, findItem } from "@/lib/content/find";
import type { ContentShelf } from "@/lib/content/types";
import type { CompleteBookResult } from "@/lib/api/types";
import s from "./reader.module.scss";

/**
 * Màn hình sau khi đọc xong: vật phẩm rơi ra, rồi báo quyển kế tiếp đã mở khóa.
 * Đọc lại một quyển đã hoàn thành (`alreadyCompleted`) thì bỏ toàn bộ hoạt cảnh
 * nhưng vẫn hiện đủ thông tin — không được mất thông báo nào (DESIGN.md § Motion).
 */
export function ItemDropOverlay({
  result,
  shelf,
  onClose,
}: {
  result: CompleteBookResult;
  shelf: ContentShelf;
  onClose: () => void;
}) {
  const item = result.grantedItemSlug ? findItem(shelf, result.grantedItemSlug) : null;
  const nextBook = result.nextBook ? findBook(shelf, result.nextBook.slug) : null;
  const replay = result.alreadyCompleted;
  const anim = (className: string) => (replay ? "" : className);

  return (
    <div className="flex flex-col items-center gap-lg px-page-margin text-center">
      {item && (
        <>
          <div
            className={`${s.itemGlow} ${anim(s.dropItem)} flex h-40 w-40 items-center justify-center rounded-full`}
          >
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- ảnh vật phẩm tĩnh trong public/
              <img src={item.image} alt="" className="h-24 w-24 object-contain" />
            ) : (
              <Sparkles aria-hidden className="h-16 w-16 text-tertiary-light" />
            )}
          </div>

          <div className={anim(s.dropText)}>
            <p className="font-heading text-headline-md text-on-primary">
              {replay ? `Vật phẩm đã có: ${item.name}` : `Bạn nhận được: ${item.name}`}
            </p>
            <p className="mt-sm max-w-xl font-body text-body-md text-secondary-light">
              {item.description}
            </p>
            {/* Ghi công ảnh vật phẩm. Đây là chỗ DUY NHẤT trong giao diện học sinh đang
                thật sự có ảnh kèm credit (5/5 dòng `items`), nên nếu thiếu dòng này thì
                điều kiện BY của CC BY-SA không được thỏa ở đúng chỗ nó có hiệu lực.
                Là văn bản thường chứ không phải liên kết — cùng lý do như `BookPage`. */}
            {item.image && item.imageCredit && (
              <p className="mt-xs font-body text-caption text-secondary">
                Ảnh: {item.imageCredit}
                {item.imageSource && <> — Nguồn: {item.imageSource}</>}
              </p>
            )}
          </div>
        </>
      )}

      <div className={`${anim(s.dropUnlock)} flex flex-col items-center gap-md`}>
        {nextBook && (
          <p className="flex items-center gap-sm font-body text-body-md text-tertiary-light">
            <LockOpen aria-hidden className="h-5 w-5" />
            {result.nextBook?.unlocked
              ? `“${nextBook.title}” đã mở khóa trên kệ.`
              : `“${nextBook.title}” vẫn cần vật phẩm khác để mở.`}
          </p>
        )}
        {!nextBook && (
          <p className="font-body text-body-md text-tertiary-light">
            Bạn đã đọc hết kệ sách này.
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-reader"
        >
          Quay lại kệ sách
        </button>
      </div>
    </div>
  );
}
