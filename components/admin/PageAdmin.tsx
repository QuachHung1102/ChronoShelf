import Link from "next/link";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Info, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ADMIN_CARD, CARD_DIVIDER, CardDisclosure, ORDER_BUTTON } from "./card";
import { ImageField } from "./ImageField";
import { createPage, deletePage, movePage, updatePage } from "@/lib/admin/actions";
import type { AdminBookHeader, AdminPageRow } from "@/lib/admin/pages";
import {
  DANGER_BUTTON,
  FIELD,
  FOCUS_RING,
  LABEL,
  PRIMARY_BUTTON,
} from "@/components/ui/controls";

const SUMMARY_HINT =
  "Mỗi ý một dòng, 3–5 ý. Chỉ trang CUỐI mới hiện phần này cho học sinh (content.md 4.3) — " +
  "để trống ở các trang giữa.";

/**
 * Chip thông tin trong header thẻ trang. Viền `secondary` là bắt buộc: `bg-neutral` đặt
 * trên thẻ `bg-surface` chỉ đạt 1.16:1, tức viên thuốc không tồn tại về mặt thị giác —
 * đúng lỗi đã sửa cho huy hiệu "Nháp" ở `card.tsx`.
 */
const PAGE_CHIP =
  "rounded-full border border-secondary bg-neutral px-sm py-[0.15rem] font-body text-caption " +
  "uppercase tracking-wide text-primary-dark";

export function PageAdmin({ book, pages }: { book: AdminBookHeader; pages: AdminPageRow[] }) {
  const last = pages.length - 1;

  return (
    <div className="flex flex-col gap-lg">
      <div className={`flex flex-wrap items-center justify-between gap-md ${ADMIN_CARD}`}>
        <p className="flex max-w-measure items-start gap-sm font-body text-body-sm text-secondary">
          <Info aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
          <span>
            Học sinh lật từng trang theo thứ tự dưới đây. Đọc hết trang cuối mới nhận được vật phẩm.
          </span>
        </p>
        {/* Không dựng một trình xem trước riêng: `readShelf()` đã chạy dưới danh tính người
            xem nên admin mở thẳng trang thật là thấy CẢ bản nháp. Một bản xem trước riêng
            sẽ trôi lệch khỏi trình đọc thật, còn cái này thì không thể lệch. */}
        <Link
          href={`/${book.shelfSlug}`}
          className={`inline-flex shrink-0 items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep underline underline-offset-2 ${FOCUS_RING}`}
        >
          <ExternalLink aria-hidden className="h-4 w-4" />
          Xem như học sinh
        </Link>
      </div>

      <section aria-labelledby="ds-trang" className="flex flex-col gap-md">
        <h2 id="ds-trang" className="font-heading text-headline-sm text-primary-dark">
          {pages.length} trang
        </h2>

        {pages.length === 0 && (
          <p className={`flex items-center gap-sm font-body text-body-md text-secondary ${ADMIN_CARD}`}>
            <FileText aria-hidden className="h-5 w-5" />
            Quyển này chưa có trang nào. Thêm trang đầu tiên ở dưới — chưa có trang thì không xuất
            bản được.
          </p>
        )}

        {pages.map((page, index) => {
          // Ý chính chỉ hiện cho học sinh ở trang CUỐI. Một trang giữa còn ý chính gần như
          // luôn là trang cuối cũ vừa bị đẩy lên — nội dung đó nay vô hình với học sinh, nên
          // phải nói ra ngay ở header (chỗ duy nhất còn nhìn thấy khi thẻ đang gập).
          const summaryHidden = index !== last && page.summary.length > 0;

          return (
            <article key={page.id} className={ADMIN_CARD}>
              <header className="flex flex-wrap items-center justify-between gap-sm">
                <div className="flex flex-wrap items-center gap-sm">
                  <span
                    aria-hidden
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-secondary bg-neutral font-body text-caption text-primary-dark"
                  >
                    {index + 1}
                  </span>
                  <h3 className="font-heading text-headline-sm text-primary-dark">{page.heading}</h3>
                  {index === last && <span className={PAGE_CHIP}>Trang cuối</span>}
                  {summaryHidden && (
                    <span className="rounded-full border border-destructive bg-neutral px-sm py-[0.15rem] font-body text-caption uppercase tracking-wide text-destructive">
                      Ý chính bị ẩn
                    </span>
                  )}
                </div>

                {/* Mũi tên, KHÔNG phải chevron — chevron là glyph gập/mở, và thân thẻ nay
                    gập được thật, nên hai nghĩa đó sẽ đứng cạnh nhau trên cùng header. Nhãn
                    "Thứ tự" hiện ra bằng mắt vì tên hai nút này trước đó chỉ nằm trong
                    `title=` và trong `sr-only`.
                    `aria-disabled` + `type="button"` thay cho `disabled` — xem chú thích dài
                    ở `components/admin/card.tsx`. */}
                <div className="flex items-center gap-xs">
                  <span className="font-body text-caption text-secondary">Thứ tự</span>
                  <ActionForm action={movePage} quietStatus>
                    <input type="hidden" name="id" value={page.id} />
                    <input type="hidden" name="bookSlug" value={book.slug} />
                    <input type="hidden" name="shelfSlug" value={book.shelfSlug} />
                    <input type="hidden" name="direction" value="-1" />
                    <button
                      type={index === 0 ? "button" : "submit"}
                      aria-disabled={index === 0 || undefined}
                      className={ORDER_BUTTON}
                      title="Lên trên"
                    >
                      <ArrowUp aria-hidden className="h-5 w-5" />
                      <span className="sr-only">Đưa trang {index + 1} lên trên</span>
                    </button>
                  </ActionForm>
                  <ActionForm action={movePage} quietStatus>
                    <input type="hidden" name="id" value={page.id} />
                    <input type="hidden" name="bookSlug" value={book.slug} />
                    <input type="hidden" name="shelfSlug" value={book.shelfSlug} />
                    <input type="hidden" name="direction" value="1" />
                    <button
                      type={index === last ? "button" : "submit"}
                      aria-disabled={index === last || undefined}
                      className={ORDER_BUTTON}
                      title="Xuống dưới"
                    >
                      <ArrowDown aria-hidden className="h-5 w-5" />
                      <span className="sr-only">Đưa trang {index + 1} xuống dưới</span>
                    </button>
                  </ActionForm>
                </div>
              </header>

              <CardDisclosure label={`Sửa nội dung trang ${index + 1}`}>
                <ActionForm action={updatePage} className="flex flex-col gap-sm">
                  <input type="hidden" name="id" value={page.id} />
                  <input type="hidden" name="bookSlug" value={book.slug} />
                  <input type="hidden" name="shelfSlug" value={book.shelfSlug} />

                  <span className="flex flex-col gap-xs">
                    <label className={LABEL} htmlFor={`h-${page.id}`}>
                      Tiêu đề trang
                    </label>
                    <input
                      id={`h-${page.id}`}
                      name="heading"
                      defaultValue={page.heading}
                      required
                      maxLength={200}
                      className={FIELD}
                    />
                  </span>

                  <span className="flex flex-col gap-xs">
                    <label className={LABEL} htmlFor={`b-${page.id}`}>
                      Nội dung
                    </label>
                    <textarea
                      id={`b-${page.id}`}
                      name="body"
                      defaultValue={page.body}
                      required
                      rows={8}
                      className={`${FIELD} font-body leading-relaxed`}
                    />
                  </span>

                  <ImageField
                    prefix="image"
                    label="Ảnh minh họa"
                    hint="Không bắt buộc. PNG, JPEG, WebP hoặc GIF, tối đa 2 MB."
                    defaultUrl={page.imageUrl}
                    defaultSource={page.imageSource}
                    defaultCredit={page.imageCredit}
                  />

                  <span className="flex flex-col gap-xs">
                    <label className={LABEL} htmlFor={`c-${page.id}`}>
                      Chú thích ảnh
                    </label>
                    <input
                      id={`c-${page.id}`}
                      name="caption"
                      defaultValue={page.caption ?? ""}
                      maxLength={300}
                      className={FIELD}
                    />
                  </span>

                  <span className="flex flex-col gap-xs">
                    <label className={LABEL} htmlFor={`s-${page.id}`}>
                      Ý chính{" "}
                      {index === last && <span className="text-tertiary-deep">(trang cuối)</span>}
                    </label>
                    {/* Ô cao 4 dòng ở trang CUỐI — nơi ý chính thật sự được dùng — và 2 dòng
                        ở các trang giữa, nơi nó phải để trống. Trước đây mọi trang đều 4
                        dòng, tức mỗi trang giữa cõng thêm một khoảng chết bằng hai dòng. */}
                    <textarea
                      id={`s-${page.id}`}
                      name="summary"
                      defaultValue={page.summary.join("\n")}
                      rows={index === last ? 4 : 2}
                      className={FIELD}
                    />
                    {summaryHidden ? (
                      <span className="max-w-measure font-body text-caption text-destructive">
                        Trang này không phải trang cuối nên học sinh KHÔNG thấy phần ý chính đang
                        lưu ở đây. Xóa đi, hoặc đưa trang này xuống cuối.
                      </span>
                    ) : (
                      index === last && (
                        <span className="max-w-measure font-body text-caption text-secondary">
                          {SUMMARY_HINT}
                        </span>
                      )
                    )}
                  </span>

                  <SubmitButton className={`w-fit ${PRIMARY_BUTTON}`} pendingLabel="Đang lưu…">
                    Lưu trang {index + 1}
                  </SubmitButton>
                </ActionForm>

                <div className={`mt-md border-t ${CARD_DIVIDER} pt-sm`}>
                  <ActionForm
                    action={deletePage}
                    confirmText={`Xóa trang ${index + 1} (“${page.heading}”)? Không hoàn tác được.`}
                  >
                    <input type="hidden" name="id" value={page.id} />
                    <input type="hidden" name="bookSlug" value={book.slug} />
                    <input type="hidden" name="shelfSlug" value={book.shelfSlug} />
                    <SubmitButton className={DANGER_BUTTON} pendingLabel="Đang xóa…">
                      <Trash2 aria-hidden className="h-4 w-4" />
                      Xóa trang
                    </SubmitButton>
                  </ActionForm>
                </div>
              </CardDisclosure>
            </article>
          );
        })}
      </section>

      {/* Form thêm nằm CUỐI danh sách, không phải đầu: trang mới luôn nối vào cuối, nên
          đặt nút ở đúng chỗ nó sẽ xuất hiện. Khác với màn kệ/vật phẩm — ở đó danh sách
          không có thứ tự tường thuật nên form đứng đầu là hợp lý.
          Và đây là biểu mẫu DUY NHẤT mở sẵn trên màn này: mọi thẻ trang đã gập, nên chỗ
          gõ chữ không phải đi tìm. */}
      <section aria-labelledby="them-trang" className={ADMIN_CARD}>
        <h2 id="them-trang" className="mb-sm font-heading text-headline-sm text-primary-dark">
          Thêm trang {pages.length + 1}
        </h2>
        <ActionForm action={createPage} className="flex flex-col gap-sm">
          <input type="hidden" name="bookSlug" value={book.slug} />
          <input type="hidden" name="shelfSlug" value={book.shelfSlug} />

          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="h-moi">
              Tiêu đề trang
            </label>
            <input
              id="h-moi"
              name="heading"
              required
              maxLength={200}
              placeholder="Thế trận cọc gỗ"
              className={FIELD}
            />
          </span>

          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="b-moi">
              Nội dung
            </label>
            <textarea
              id="b-moi"
              name="body"
              required
              rows={8}
              placeholder="Kể lại diễn biến bằng giọng văn dành cho học sinh…"
              className={`${FIELD} font-body leading-relaxed`}
            />
          </span>

          <ImageField
            prefix="image"
            label="Ảnh minh họa"
            hint="Không bắt buộc. PNG, JPEG, WebP hoặc GIF, tối đa 2 MB."
            defaultUrl={null}
            defaultSource={null}
            defaultCredit={null}
          />

          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="c-moi">
              Chú thích ảnh
            </label>
            <input id="c-moi" name="caption" maxLength={300} className={FIELD} />
          </span>

          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="s-moi">
              Ý chính
            </label>
            <textarea id="s-moi" name="summary" rows={4} className={FIELD} />
            <span className="max-w-measure font-body text-caption text-secondary">
              {SUMMARY_HINT}
            </span>
          </span>

          <SubmitButton className={`w-fit ${PRIMARY_BUTTON}`} pendingLabel="Đang thêm…">
            <Plus aria-hidden className="h-4 w-4" />
            Thêm trang
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
