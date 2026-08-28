import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import {
  createShelf,
  deleteShelf,
  moveShelf,
  setShelfPublished,
  updateShelf,
} from "@/lib/admin/actions";
import type { AdminShelfRow } from "@/lib/admin/shelves";
import { DANGER_BUTTON, FIELD, LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm text-secondary transition-colors " +
  "duration-200 ease-out hover:text-tertiary-deep disabled:opacity-30 disabled:hover:text-secondary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface";

/**
 * Màn `/quan-tri`: danh sách kệ + form sửa từng kệ. Server Component — không có
 * JavaScript nào của riêng nó gửi xuống trình duyệt ngoài `ActionForm`/`SubmitButton`.
 *
 * Mỗi hàng là vài `<form>` nhỏ độc lập thay vì một form lớn có JavaScript điều phối.
 * Đổi lại: một hàng hỏng không kéo cả trang theo, và trạng thái đang-gửi của từng nút
 * tách bạch — bấm ▲ ở hàng ba không làm mờ nút Lưu ở hàng một.
 */
export function ShelfAdmin({ shelves }: { shelves: AdminShelfRow[] }) {
  return (
    <div className="flex flex-col gap-lg">
      <section aria-labelledby="them-ke" className="rounded-md bg-surface p-md">
        <h2 id="them-ke" className="mb-sm font-heading text-headline-sm text-primary-dark">
          Thêm kệ mới
        </h2>
        <ActionForm action={createShelf} className="flex flex-wrap items-end gap-sm">
          <span className="flex min-w-[18rem] flex-1 flex-col gap-xs">
            <label className={LABEL} htmlFor="ten-ke-moi">
              Tên kệ
            </label>
            <input
              id="ten-ke-moi"
              name="name"
              required
              maxLength={120}
              placeholder="Lịch sử thế giới"
              className={FIELD}
            />
          </span>
          <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang tạo…">
            <Plus aria-hidden className="h-4 w-4" />
            Tạo kệ
          </SubmitButton>
          {/* Slug sinh tự động từ tên nên không có ô nhập: một slug gõ tay sai chính tả
              là một URL sai vĩnh viễn, mà sửa slug sau đó thì gãy mọi liên kết đã chia sẻ. */}
          <p className="w-full font-body text-caption text-secondary">
            Đường dẫn sinh tự động từ tên. Kệ mới luôn ở dạng nháp cho tới khi bạn xuất bản.
          </p>
        </ActionForm>
      </section>

      <section aria-labelledby="ds-ke" className="flex flex-col gap-md">
        <h2 id="ds-ke" className="font-heading text-headline-sm text-primary-dark">
          {shelves.length} kệ
        </h2>

        {shelves.length === 0 && (
          <p className="rounded-md bg-surface p-md font-body text-body-md text-secondary">
            Chưa có kệ nào. Tạo kệ đầu tiên ở trên.
          </p>
        )}

        {shelves.map((shelf, index) => (
          <article key={shelf.slug} className="rounded-md bg-surface p-md">
            <header className="mb-sm flex flex-wrap items-center justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <h3 className="font-heading text-headline-sm text-primary-dark">{shelf.name}</h3>
                <span
                  className={`rounded-full px-sm py-[0.15rem] font-body text-caption uppercase tracking-wide ${
                    shelf.published
                      ? "bg-tertiary-deep text-on-primary"
                      : "bg-surface-locked text-secondary"
                  }`}
                >
                  {shelf.published ? "Đã xuất bản" : "Nháp"}
                </span>
                <span className="font-body text-caption text-secondary">
                  /{shelf.slug} · {shelf.bookCount} quyển
                </span>
              </div>

              <div className="flex items-center gap-xs">
                <ActionForm action={moveShelf}>
                  <input type="hidden" name="slug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="-1" />
                  <SubmitButton className={ICON_BUTTON} disabled={index === 0} title="Lên trên">
                    <ChevronUp aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa kệ {shelf.name} lên trên</span>
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={moveShelf}>
                  <input type="hidden" name="slug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="1" />
                  <SubmitButton
                    className={ICON_BUTTON}
                    disabled={index === shelves.length - 1}
                    title="Xuống dưới"
                  >
                    <ChevronDown aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa kệ {shelf.name} xuống dưới</span>
                  </SubmitButton>
                </ActionForm>
              </div>
            </header>

            <ActionForm action={updateShelf} className="grid gap-sm sm:grid-cols-2">
              <input type="hidden" name="slug" value={shelf.slug} />
              <span className="flex flex-col gap-xs">
                <label className={LABEL} htmlFor={`ten-${shelf.slug}`}>
                  Tên kệ
                </label>
                <input
                  id={`ten-${shelf.slug}`}
                  name="name"
                  defaultValue={shelf.name}
                  required
                  maxLength={120}
                  className={FIELD}
                />
              </span>
              <span className="flex flex-col gap-xs">
                <label className={LABEL} htmlFor={`qg-${shelf.slug}`}>
                  Mã quốc gia (ISO-3166-1 numeric)
                </label>
                <input
                  id={`qg-${shelf.slug}`}
                  name="countryCode"
                  defaultValue={shelf.countryCode ?? ""}
                  inputMode="numeric"
                  pattern="\d{1,3}"
                  maxLength={3}
                  placeholder="704"
                  className={FIELD}
                />
                <span className="font-body text-caption text-secondary">
                  Để nối với bản đồ thế giới ở chặng sau. 704 = Việt Nam. Bỏ trống cũng được.
                </span>
              </span>
              <span className="flex flex-col gap-xs sm:col-span-2">
                <label className={LABEL} htmlFor={`gt-${shelf.slug}`}>
                  Giới thiệu ngắn
                </label>
                <textarea
                  id={`gt-${shelf.slug}`}
                  name="blurb"
                  defaultValue={shelf.blurb}
                  rows={2}
                  maxLength={500}
                  className={FIELD}
                />
              </span>
              <span className="sm:col-span-2">
                <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang lưu…">
                  Lưu
                </SubmitButton>
              </span>
            </ActionForm>

            <footer className="mt-md flex flex-wrap items-center gap-md border-t border-surface-locked pt-sm">
              <ActionForm action={setShelfPublished}>
                <input type="hidden" name="slug" value={shelf.slug} />
                <input type="hidden" name="publish" value={shelf.published ? "0" : "1"} />
                <SubmitButton className={QUIET_BUTTON}>
                  {shelf.published ? (
                    <EyeOff aria-hidden className="h-4 w-4" />
                  ) : (
                    <Eye aria-hidden className="h-4 w-4" />
                  )}
                  {shelf.published ? "Chuyển về nháp" : "Xuất bản"}
                </SubmitButton>
              </ActionForm>

              <ActionForm
                action={deleteShelf}
                confirmText={`Xóa kệ "${shelf.name}"? Không hoàn tác được.`}
              >
                <input type="hidden" name="slug" value={shelf.slug} />
                <SubmitButton
                  className={DANGER_BUTTON}
                  disabled={shelf.bookCount > 0}
                  title={shelf.bookCount > 0 ? "Gỡ hết sách khỏi kệ rồi mới xóa được" : undefined}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Xóa kệ
                </SubmitButton>
              </ActionForm>
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}
