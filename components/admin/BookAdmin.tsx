import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import {
  createBook,
  deleteBook,
  moveBook,
  setBookPublished,
  updateBook,
} from "@/lib/admin/actions";
import type { AdminBookRow, AdminShelfHeader } from "@/lib/admin/books";
import type { AdminItemRow } from "@/lib/admin/items";
import {
  DANGER_BUTTON,
  FIELD,
  FOCUS_RING,
  LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
} from "@/components/ui/controls";

const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm text-secondary transition-colors " +
  "duration-200 ease-out hover:text-tertiary-deep disabled:opacity-30 disabled:hover:text-secondary " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface";

/**
 * Câu mô tả điều kiện mở của quyển thứ `index`, dạng ĐỌC-THÔI.
 *
 * Đây là bản dịch sang tiếng người của đúng ba nhánh trong `resolveState()`
 * (`lib/api/unlock.ts`). Không có `<input>` hay `<select>` nào cho "vật phẩm cần để mở",
 * và không phải vì quên: cột đó KHÔNG TỒN TẠI. Hiện nó ra bằng chữ là cách duy nhất để
 * admin hiểu cơ chế mà không tạo ra một bề mặt làm đứt chuỗi.
 */
function unlockSentence(books: AdminBookRow[], index: number): string {
  if (index === 0) return "Mở sẵn — quyển đầu kệ.";

  const prev = books[index - 1];
  if (!prev.rewardItemSlug) {
    return `Mở sẵn — quyển “${prev.title}” ngay trước không thưởng vật phẩm nào.`;
  }
  return `Mở bằng: ${prev.rewardItemName ?? prev.rewardItemSlug} — thưởng của quyển ${index} (“${prev.title}”).`;
}

export function BookAdmin({
  shelf,
  books,
  items,
}: {
  shelf: AdminShelfHeader;
  books: AdminBookRow[];
  items: AdminItemRow[];
}) {
  return (
    <div className="flex flex-col gap-lg">
      <p className="flex items-start gap-sm rounded-md bg-surface p-md font-body text-body-sm text-secondary">
        <KeyRound aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
        <span>
          Chuỗi mở khóa suy ra từ <strong className="font-semibold text-primary-dark">thứ tự</strong>
          , không có ô nào để nhập: quyển sau mở bằng vật phẩm thưởng của quyển ngay trước. Đổi thứ
          tự hoặc đổi phần thưởng thì chuỗi tự tính lại, nên nó không thể đứt.
        </span>
      </p>

      <section aria-labelledby="them-sach" className="rounded-md bg-surface p-md">
        <h2 id="them-sach" className="mb-sm font-heading text-headline-sm text-primary-dark">
          Thêm quyển sách
        </h2>
        <ActionForm action={createBook} className="flex flex-wrap items-end gap-sm">
          <input type="hidden" name="shelfSlug" value={shelf.slug} />
          <span className="flex min-w-[16rem] flex-1 flex-col gap-xs">
            <label className={LABEL} htmlFor="tieu-de-moi">
              Tiêu đề
            </label>
            <input
              id="tieu-de-moi"
              name="title"
              required
              maxLength={200}
              placeholder="Trận chiến Bạch Đằng 938"
              className={FIELD}
            />
          </span>
          <span className="flex min-w-[10rem] flex-col gap-xs">
            <label className={LABEL} htmlFor="nien-dai-moi">
              Niên đại
            </label>
            <input
              id="nien-dai-moi"
              name="era"
              required
              maxLength={60}
              placeholder="Năm 938"
              className={FIELD}
            />
          </span>
          <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang tạo…">
            <Plus aria-hidden className="h-4 w-4" />
            Tạo sách
          </SubmitButton>
          <p className="w-full font-body text-caption text-secondary">
            Đường dẫn sinh tự động từ tiêu đề. Quyển mới luôn ở dạng nháp — soạn trang rồi mới xuất
            bản được.
          </p>
        </ActionForm>
      </section>

      <section aria-labelledby="ds-sach" className="flex flex-col gap-md">
        <h2 id="ds-sach" className="font-heading text-headline-sm text-primary-dark">
          {books.length} quyển
        </h2>

        {books.length === 0 && (
          <p className="rounded-md bg-surface p-md font-body text-body-md text-secondary">
            Kệ này chưa có quyển nào. Tạo quyển đầu tiên ở trên — nó sẽ luôn mở sẵn cho học sinh.
          </p>
        )}

        {books.map((book, index) => (
          <article key={book.slug} className="rounded-md bg-surface p-md">
            <header className="mb-sm flex flex-wrap items-center justify-between gap-sm">
              <div className="flex flex-wrap items-center gap-sm">
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral font-body text-caption text-primary-dark"
                >
                  {index + 1}
                </span>
                <h3 className="font-heading text-headline-sm text-primary-dark">{book.title}</h3>
                <span
                  className={`rounded-full px-sm py-[0.15rem] font-body text-caption uppercase tracking-wide ${
                    book.published
                      ? "bg-tertiary-deep text-on-primary"
                      : "bg-neutral text-primary-dark"
                  }`}
                >
                  {book.published ? "Đã xuất bản" : "Nháp"}
                </span>
                <span className="font-body text-caption text-secondary">
                  {book.era} · {book.pageCount} trang
                </span>
              </div>

              <div className="flex items-center gap-xs">
                <ActionForm action={moveBook}>
                  <input type="hidden" name="slug" value={book.slug} />
                  <input type="hidden" name="shelfSlug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="-1" />
                  <SubmitButton className={ICON_BUTTON} disabled={index === 0} title="Lên trên">
                    <ChevronUp aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa “{book.title}” lên trên</span>
                  </SubmitButton>
                </ActionForm>
                <ActionForm action={moveBook}>
                  <input type="hidden" name="slug" value={book.slug} />
                  <input type="hidden" name="shelfSlug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="1" />
                  <SubmitButton
                    className={ICON_BUTTON}
                    disabled={index === books.length - 1}
                    title="Xuống dưới"
                  >
                    <ChevronDown aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa “{book.title}” xuống dưới</span>
                  </SubmitButton>
                </ActionForm>
              </div>
            </header>

            {/* Chuỗi mở khóa — ĐỌC-THÔI, không có ô nhập nào. */}
            <p className="mb-sm flex items-center gap-xs rounded-sm bg-neutral px-sm py-xs font-body text-caption text-secondary">
              <Unlock aria-hidden className="h-3.5 w-3.5 shrink-0 text-tertiary-deep" />
              {unlockSentence(books, index)}
            </p>

            <ActionForm action={updateBook} className="grid gap-sm sm:grid-cols-2">
              <input type="hidden" name="slug" value={book.slug} />
              <input type="hidden" name="shelfSlug" value={shelf.slug} />
              <span className="flex flex-col gap-xs">
                <label className={LABEL} htmlFor={`td-${book.slug}`}>
                  Tiêu đề
                </label>
                <input
                  id={`td-${book.slug}`}
                  name="title"
                  defaultValue={book.title}
                  required
                  maxLength={200}
                  className={FIELD}
                />
              </span>
              <span className="flex flex-col gap-xs">
                <label className={LABEL} htmlFor={`nd-${book.slug}`}>
                  Niên đại
                </label>
                <input
                  id={`nd-${book.slug}`}
                  name="era"
                  defaultValue={book.era}
                  required
                  maxLength={60}
                  className={FIELD}
                />
              </span>
              <span className="flex flex-col gap-xs sm:col-span-2">
                <label className={LABEL} htmlFor={`pt-${book.slug}`}>
                  Vật phẩm thưởng
                </label>
                <select
                  id={`pt-${book.slug}`}
                  name="rewardItemSlug"
                  defaultValue={book.rewardItemSlug ?? ""}
                  className={FIELD}
                >
                  <option value="">Không thưởng gì</option>
                  {items.map((it) => (
                    <option key={it.slug} value={it.slug}>
                      {it.name}
                    </option>
                  ))}
                </select>
                <span className="flex items-start gap-xs font-body text-caption text-secondary">
                  <Info aria-hidden className="mt-[0.15em] h-3.5 w-3.5 shrink-0" />
                  Đổi phần thưởng làm đổi luôn điều kiện mở quyển kế tiếp. Người đã nhận vật phẩm cũ
                  sẽ thấy quyển sau khóa lại.
                </span>
              </span>
              <span className="sm:col-span-2">
                <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang lưu…">
                  Lưu
                </SubmitButton>
              </span>
            </ActionForm>

            <footer className="mt-md flex flex-wrap items-center gap-md border-t border-surface-locked pt-sm">
              <Link
                href={`/quan-tri/${shelf.slug}/${book.slug}`}
                className={`inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep underline underline-offset-2 ${FOCUS_RING}`}
              >
                <FileText aria-hidden className="h-4 w-4" />
                Soạn trang ({book.pageCount})
              </Link>

              <ActionForm action={setBookPublished}>
                <input type="hidden" name="slug" value={book.slug} />
                <input type="hidden" name="shelfSlug" value={shelf.slug} />
                <input type="hidden" name="publish" value={book.published ? "0" : "1"} />
                <SubmitButton
                  className={QUIET_BUTTON}
                  disabled={!book.published && book.pageCount === 0}
                  title={
                    !book.published && book.pageCount === 0
                      ? "Soạn ít nhất một trang trước khi xuất bản"
                      : undefined
                  }
                >
                  {book.published ? (
                    <EyeOff aria-hidden className="h-4 w-4" />
                  ) : (
                    <Eye aria-hidden className="h-4 w-4" />
                  )}
                  {book.published ? "Chuyển về nháp" : "Xuất bản"}
                </SubmitButton>
              </ActionForm>

              <ActionForm
                action={deleteBook}
                confirmText={`Xóa “${book.title}”? Sẽ mất cả ${book.pageCount} trang và tiến độ đọc của học sinh. Không hoàn tác được.`}
              >
                <input type="hidden" name="slug" value={book.slug} />
                <input type="hidden" name="shelfSlug" value={shelf.slug} />
                <SubmitButton
                  className={DANGER_BUTTON}
                  disabled={book.published}
                  title={book.published ? "Chuyển về nháp trước khi xóa" : undefined}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Xóa quyển
                </SubmitButton>
              </ActionForm>
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}
