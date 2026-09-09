import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
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
import { ADMIN_CARD, CARD_DIVIDER, CardDisclosure, ORDER_BUTTON, PublishBadge } from "./card";
import { ImageField } from "./ImageField";
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
  LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
  QUIET_BUTTON_ON_SURFACE,
} from "@/components/ui/controls";

/**
 * Câu mô tả điều kiện mở của quyển thứ `index`, dạng ĐỌC-THÔI.
 *
 * Đây là bản dịch sang tiếng người của đúng ba nhánh trong `resolveState()`
 * (`lib/api/unlock.ts`). Không có `<input>` hay `<select>` nào cho "vật phẩm cần để mở",
 * và không phải vì quên: cột đó KHÔNG TỒN TẠI. Hiện nó ra bằng chữ là cách duy nhất để
 * admin hiểu cơ chế mà không tạo ra một bề mặt làm đứt chuỗi.
 *
 * Chuỗi tính trên ĐÚNG tập mà học sinh thấy — chỉ sách đã xuất bản. Danh sách này còn
 * kèm cả sách nháp, nên "quyển ngay trước" của admin không phải "quyển ngay trước" của
 * học sinh: một quyển nháp chen vào giữa sẽ làm hai bên nói hai câu khác nhau. Vì thế
 * cũng không đánh số "quyển {index}" nữa — số thứ tự hiển thị đếm cả nháp.
 */
function unlockSentence(books: AdminBookRow[], index: number): string {
  const book = books[index];
  if (!book.published) return "Còn nháp — chưa nằm trong chuỗi của học sinh.";

  const prev = books.slice(0, index).filter((b) => b.published).at(-1);
  if (!prev) return "Mở sẵn — quyển đầu kệ (tính trên sách đã xuất bản).";
  if (!prev.rewardItemSlug) {
    return `Mở sẵn — quyển “${prev.title}” ngay trước không thưởng vật phẩm nào.`;
  }
  return `Mở bằng: ${prev.rewardItemName ?? prev.rewardItemSlug} — thưởng của “${prev.title}”.`;
}

/**
 * Màn `/quan-tri/[shelf]`. Cùng ba tầng với `ShelfAdmin`, và cố ý giống hệt nó:
 *  1. `<header>` — nhận diện + đổi thứ tự. Luôn hiện.
 *  2. Dải "mở bằng gì" và hàng điều hướng (soạn trang, xuất bản). Luôn hiện.
 *  3. `<CardDisclosure>` — biểu mẫu sửa + nút xóa. **Gập mặc định.**
 *
 * Nút "Xóa quyển" nằm ở tầng 3 chứ không đứng cạnh "Xuất bản" như trước: hai nút đó cùng
 * `text-body-sm`, cùng gạch chân, cách nhau đúng 16px và chỉ khác nhau ở sắc đỏ — ở 13px
 * thì mắt không tách được, mà một cái ẩn sách còn cái kia xóa cả tiến độ đọc của học sinh.
 */
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
      <p className={`flex items-start gap-sm font-ui text-body-sm text-ink-dilute ${ADMIN_CARD}`}>
        <KeyRound aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-son" />
        <span>
          Chuỗi mở khóa suy ra từ <strong className="font-semibold text-primary">thứ tự</strong>
          , không có ô nào để nhập: quyển sau mở bằng vật phẩm thưởng của quyển ngay trước. Đổi thứ
          tự hoặc đổi phần thưởng thì chuỗi tự tính lại, nên nó không thể đứt.
        </span>
      </p>

      <section aria-labelledby="them-sach" className={ADMIN_CARD}>
        <h2 id="them-sach" className="mb-sm font-ui text-title-md text-primary">
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
          <p className="w-full max-w-measure font-ui text-caption text-ink-dilute">
            Đường dẫn sinh tự động từ tiêu đề. Quyển mới luôn ở dạng nháp — soạn trang rồi mới xuất
            bản được.
          </p>
        </ActionForm>
      </section>

      <section aria-labelledby="ds-sach" className="flex flex-col gap-md">
        <h2 id="ds-sach" className="font-ui text-title-md text-primary">
          {books.length} quyển
        </h2>

        {books.length === 0 && (
          <p className={`font-ui text-body-md text-ink-dilute ${ADMIN_CARD}`}>
            Kệ này chưa có quyển nào. Tạo quyển đầu tiên ở trên — nó sẽ luôn mở sẵn cho học sinh.
          </p>
        )}

        {books.map((book, index) => (
          <article key={book.slug} className={ADMIN_CARD}>
            <header className="flex flex-wrap items-center justify-between gap-sm">
              <div className="flex flex-wrap items-center gap-sm">
                {/* Viền `secondary` là bắt buộc: `bg-paper` đặt trên thẻ `bg-surface` chỉ
                    đạt 1.16:1, tức cái vòng tròn số thứ tự không tồn tại về mặt thị giác. */}
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-mist bg-paper font-ui text-caption text-primary"
                >
                  {index + 1}
                </span>
                <h3 className="font-ui text-title-md text-primary">{book.title}</h3>
                <PublishBadge published={book.published} />
                <span className="font-ui text-caption text-ink-dilute">
                  {book.era} · {book.pageCount} trang
                </span>
              </div>

              {/* Mũi tên, KHÔNG phải chevron — cùng lý do đã ghi ở `ShelfAdmin`: chevron là
                  glyph gập/mở, và từ khi thân thẻ gập được thì hai nghĩa đó đứng cạnh nhau
                  trên cùng một header. Nhãn "Thứ tự" hiện ra bằng mắt vì tên hai nút này
                  trước đó chỉ nằm trong `title=` và trong `sr-only`.
                  `aria-disabled` + `type="button"` thay cho `disabled` — xem chú thích dài
                  ở `components/admin/card.tsx`. */}
              <div className="flex items-center gap-xs">
                <span className="font-ui text-caption text-ink-dilute">Thứ tự</span>
                <ActionForm action={moveBook} quietStatus>
                  <input type="hidden" name="slug" value={book.slug} />
                  <input type="hidden" name="shelfSlug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="-1" />
                  <button
                    type={index === 0 ? "button" : "submit"}
                    aria-disabled={index === 0 || undefined}
                    className={ORDER_BUTTON}
                    title="Lên trên"
                  >
                    <ArrowUp aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa “{book.title}” lên trên</span>
                  </button>
                </ActionForm>
                <ActionForm action={moveBook} quietStatus>
                  <input type="hidden" name="slug" value={book.slug} />
                  <input type="hidden" name="shelfSlug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="1" />
                  <button
                    type={index === books.length - 1 ? "button" : "submit"}
                    aria-disabled={index === books.length - 1 || undefined}
                    className={ORDER_BUTTON}
                    title="Xuống dưới"
                  >
                    <ArrowDown aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa “{book.title}” xuống dưới</span>
                  </button>
                </ActionForm>
              </div>
            </header>

            {/* Chuỗi mở khóa — ĐỌC-THÔI, không có ô nhập nào. Ở lại tầng LUÔN HIỆN vì đây
                là thứ admin cần đọc khi lướt cả kệ, không phải khi đang sửa một quyển. */}
            <p className="mt-sm flex items-center gap-xs rounded-sm border border-mist bg-paper px-sm py-xs font-ui text-caption text-primary">
              <Unlock aria-hidden className="h-3.5 w-3.5 shrink-0 text-son" />
              {unlockSentence(books, index)}
            </p>

            <div className={`mt-sm flex flex-wrap items-center gap-md border-t ${CARD_DIVIDER} pt-sm`}>
              <Link
                href={`/quan-tri/${shelf.slug}/${book.slug}`}
                className={QUIET_BUTTON_ON_SURFACE}
              >
                <FileText aria-hidden className="h-4 w-4" />
                Soạn trang ({book.pageCount})
              </Link>

              <ActionForm action={setBookPublished} quietStatus>
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
            </div>

            <CardDisclosure label="Sửa quyển">
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
                  {/* Chưa có vật phẩm nào thì ô này chỉ còn đúng một lựa chọn "Không thưởng
                      gì" — một ngõ cụt câm không nói thiếu gì và không chỉ đi đâu. Câu nhắc
                      "tạo vật phẩm trước" chỉ tồn tại ở màn /quan-tri/vat-pham, tức đúng chỗ
                      admin chưa tới. Không có vật phẩm thưởng thì quyển kế tiếp không bao giờ
                      mở được, nên đây không phải chuyện nhỏ. */}
                  <span className="flex max-w-measure items-start gap-xs font-ui text-caption text-ink-dilute">
                    <Info aria-hidden className="mt-[0.15em] h-3.5 w-3.5 shrink-0" />
                    {items.length === 0 ? (
                      <span>
                        Chưa có vật phẩm nào để thưởng. Quyển kế tiếp chỉ mở ra khi quyển này có
                        phần thưởng, nên hãy{" "}
                        <Link href="/quan-tri/vat-pham" className={QUIET_BUTTON}>
                          tạo vật phẩm trước
                        </Link>
                        .
                      </span>
                    ) : (
                      <span>
                        Đổi phần thưởng làm đổi luôn điều kiện mở quyển kế tiếp. Người đã nhận vật
                        phẩm cũ sẽ thấy quyển sau khóa lại.
                      </span>
                    )}
                  </span>
                </span>
                <span className="sm:col-span-2">
                  <ImageField
                    prefix="cover"
                    label="Ảnh bìa sách"
                    hint="Hiện trên gáy sách ở kệ. Không tải ảnh thì bìa vẽ bằng CSS như hiện nay."
                    defaultUrl={book.coverUrl}
                    defaultSource={book.coverSource}
                    defaultCredit={book.coverCredit}
                  />
                </span>
                <span className="sm:col-span-2">
                  <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang lưu…">
                    Lưu
                  </SubmitButton>
                </span>
              </ActionForm>

              <div className={`mt-md border-t ${CARD_DIVIDER} pt-sm`}>
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
                    pendingLabel="Đang xóa…"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Xóa quyển
                  </SubmitButton>
                </ActionForm>
              </div>
            </CardDisclosure>
          </article>
        ))}
      </section>
    </div>
  );
}
