import Link from "next/link";
import { ArrowDown, ArrowUp, BookOpen, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ADMIN_CARD, CARD_DIVIDER, CardDisclosure, ORDER_BUTTON, PublishBadge } from "./card";
import { CountryPicker } from "./CountryPicker";
import { ImageField } from "./ImageField";
import {
  createShelf,
  deleteShelf,
  moveShelf,
  setShelfPublished,
  updateShelf,
} from "@/lib/admin/actions";
import type { AdminShelfRow } from "@/lib/admin/shelves";
import {
  DANGER_BUTTON,
  FIELD,
  LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
  QUIET_BUTTON_ON_SURFACE,
} from "@/components/ui/controls";

/**
 * Màn `/quan-tri`: danh sách kệ + form sửa từng kệ. Server Component — không có
 * JavaScript nào của riêng nó gửi xuống trình duyệt ngoài `ActionForm`/`SubmitButton`.
 *
 * Mỗi hàng là vài `<form>` nhỏ độc lập thay vì một form lớn có JavaScript điều phối.
 * Đổi lại: một hàng hỏng không kéo cả trang theo, và trạng thái đang-gửi của từng nút
 * tách bạch — bấm mũi tên ở hàng ba không làm mờ nút Lưu ở hàng một.
 *
 * Mỗi thẻ có ba tầng, xếp theo thứ tự admin cần tới chúng:
 *  1. `<header>` — nhận diện và đổi thứ tự. Luôn hiện.
 *  2. Hàng điều hướng — vào sách con, xuất bản/về nháp. Luôn hiện.
 *  3. `<CardDisclosure>` — biểu mẫu soạn thảo + nút xóa. **Gập mặc định.**
 * Nút xóa nằm trong tầng 3 chứ không đứng cạnh "Xuất bản" ở tầng 2: hai nút đó trước
 * đây cùng cỡ chữ, cùng gạch chân, cách nhau 16px và chỉ khác nhau sắc đỏ — ở 13px thì
 * mắt không tách được. Nay chúng không còn đứng cạnh nhau nữa.
 */
export function ShelfAdmin({ shelves }: { shelves: AdminShelfRow[] }) {
  return (
    <div className="flex flex-col gap-lg">
      <section aria-labelledby="them-ke" className={ADMIN_CARD}>
        <h2 id="them-ke" className="mb-sm font-heading text-headline-sm text-primary-dark">
          Thêm kệ mới
        </h2>
        <ActionForm action={createShelf} className="flex flex-wrap items-end gap-sm">
          <span className="flex min-w-[18rem] flex-1 flex-col gap-xs">
            {/* `them-ke-ten`, không phải `ten-ke-moi`: id của hàng sửa là `ten-${slug}`,
                nên một kệ có slug `ke-moi` sinh ra đúng `ten-ke-moi` và trang có hai id
                trùng nhau — `<label htmlFor>` khi đó trỏ vào ô đầu tiên trong DOM, tức là
                nhãn của form tạo nhảy sang ô của hàng sửa. Slug là `text PRIMARY KEY`
                không có CHECK và nội dung còn sửa được bằng SQL tay, nên không có gì cấm
                slug đó tồn tại. Tiền tố `them-` là không gian tên mà không hàng nào với
                tới: hàng sửa chỉ sinh `ten-`, `qg-`, `gt-`. */}
            <label className={LABEL} htmlFor="them-ke-ten">
              Tên kệ
            </label>
            <input
              id="them-ke-ten"
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
          <p className="w-full max-w-measure font-body text-caption text-secondary">
            Đường dẫn sinh tự động từ tên. Kệ mới luôn ở dạng nháp cho tới khi bạn xuất bản.
          </p>
        </ActionForm>
      </section>

      <section aria-labelledby="ds-ke" className="flex flex-col gap-md">
        <h2 id="ds-ke" className="font-heading text-headline-sm text-primary-dark">
          {shelves.length} kệ
        </h2>

        {shelves.length === 0 && (
          <p className={`${ADMIN_CARD} font-body text-body-md text-secondary`}>
            Chưa có kệ nào. Tạo kệ đầu tiên ở trên.
          </p>
        )}

        {shelves.map((shelf, index) => (
          <article key={shelf.slug} className={ADMIN_CARD}>
            <header className="flex flex-wrap items-center justify-between gap-sm">
              <div className="flex flex-wrap items-center gap-sm">
                <h3 className="font-heading text-headline-sm text-primary-dark">{shelf.name}</h3>
                <PublishBadge published={shelf.published} />
                <span className="font-body text-caption text-secondary">
                  /{shelf.slug} · {shelf.bookCount} quyển
                </span>
              </div>

              {/* Mũi tên, KHÔNG phải chevron. Chevron là glyph gập/mở thẻ — và từ khi thân
                  thẻ thật sự gập được thì hai nghĩa đó đứng cạnh nhau trên cùng header;
                  người lần đầu vào màn này thấy cặp `^ v` ở góc thẻ sẽ đoán nó thu gọn
                  thẻ, bấm thử, và thứ đổi lại là thứ tự đọc của học sinh.
                  Nhãn "Thứ tự" hiện ra bằng mắt vì tên của hai nút này trước đó chỉ nằm
                  trong `title=` (phải rê chuột chờ) và trong `sr-only`. */}
              <div className="flex items-center gap-xs">
                <span className="font-body text-caption text-secondary">Thứ tự</span>
                <ActionForm action={moveShelf} quietStatus>
                  <input type="hidden" name="slug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="-1" />
                  <button
                    type={index === 0 ? "button" : "submit"}
                    aria-disabled={index === 0 || undefined}
                    className={ORDER_BUTTON}
                    title="Lên trên"
                  >
                    <ArrowUp aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa kệ {shelf.name} lên trên</span>
                  </button>
                </ActionForm>
                <ActionForm action={moveShelf} quietStatus>
                  <input type="hidden" name="slug" value={shelf.slug} />
                  <input type="hidden" name="direction" value="1" />
                  <button
                    type={index === shelves.length - 1 ? "button" : "submit"}
                    aria-disabled={index === shelves.length - 1 || undefined}
                    className={ORDER_BUTTON}
                    title="Xuống dưới"
                  >
                    <ArrowDown aria-hidden className="h-5 w-5" />
                    <span className="sr-only">Đưa kệ {shelf.name} xuống dưới</span>
                  </button>
                </ActionForm>
              </div>
            </header>

            <div className={`mt-sm flex flex-wrap items-center gap-md border-t ${CARD_DIVIDER} pt-sm`}>
              <Link
                href={`/quan-tri/${shelf.slug}`}
                className={QUIET_BUTTON_ON_SURFACE}
              >
                <BookOpen aria-hidden className="h-4 w-4" />
                Quản lý sách ({shelf.bookCount})
              </Link>

              <ActionForm action={setShelfPublished} quietStatus>
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
            </div>

            <CardDisclosure label="Sửa kệ">
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
                <CountryPicker
                  id={`qg-${shelf.slug}`}
                  name="countryCode"
                  defaultValue={shelf.countryCode ?? ""}
                  className="sm:col-span-2"
                />
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
                  <ImageField
                    prefix="cover"
                    label="Ảnh bìa kệ"
                    hint="Ảnh nền của kệ trên trang học sinh. PNG, JPEG, WebP hoặc GIF, tối đa 2 MB."
                    defaultUrl={shelf.coverUrl}
                    defaultSource={shelf.coverSource}
                    defaultCredit={shelf.coverCredit}
                  />
                </span>
                <span className="sm:col-span-2">
                  <ImageField
                    prefix="mosaic"
                    label="Bức tranh toàn cảnh (ghép từ các mảnh)"
                    hint="Mỗi vật phẩm của kệ là một dải dọc của bức tranh này; học sinh sưu tầm đủ thì tranh liền lại. Ảnh NGANG cho đẹp. Bỏ trống thì kệ không có tranh ghép."
                    defaultUrl={shelf.mosaicUrl}
                    defaultSource={shelf.mosaicSource}
                    defaultCredit={shelf.mosaicCredit}
                  />
                </span>
                {/* Phần thưởng trọn bộ (content.md §4.5). Hai ô này CHỈ hiện ra với học
                    sinh khi họ đã có đủ mọi vật phẩm của kệ — `readTuiHanhTrang()` cắt ở
                    tầng đọc, nên đừng viết vào đây thứ gì không chịu được việc bị đoán. */}
                <span className="flex flex-col gap-xs sm:col-span-2">
                  <label className={LABEL} htmlFor={`dh-${shelf.slug}`}>
                    Danh hiệu khi sưu tầm trọn bộ
                  </label>
                  <input
                    id={`dh-${shelf.slug}`}
                    name="rewardTitle"
                    defaultValue={shelf.rewardTitle}
                    maxLength={120}
                    placeholder="Người giữ ký ức Đại Việt"
                    className={FIELD}
                  />
                </span>
                <span className="flex flex-col gap-xs sm:col-span-2">
                  <label className={LABEL} htmlFor={`nt-${shelf.slug}`}>
                    Nội dung thưởng
                  </label>
                  <textarea
                    id={`nt-${shelf.slug}`}
                    name="rewardBody"
                    defaultValue={shelf.rewardBody}
                    rows={4}
                    maxLength={2000}
                    className={FIELD}
                  />
                  <span className="font-body text-caption text-secondary">
                    Bài viết mở rộng hiện ra cùng danh hiệu. Để trống cũng được — khi đó
                    phần thưởng chỉ là danh hiệu. Có nội dung thì bắt buộc có danh hiệu.
                  </span>
                </span>
                <span className="sm:col-span-2">
                  <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang lưu…">
                    Lưu
                  </SubmitButton>
                </span>
              </ActionForm>

              <div className={`mt-md border-t ${CARD_DIVIDER} pt-sm`}>
                <ActionForm
                  action={deleteShelf}
                  confirmText={`Xóa kệ "${shelf.name}"? Không hoàn tác được.`}
                >
                  <input type="hidden" name="slug" value={shelf.slug} />
                  <SubmitButton
                    className={DANGER_BUTTON}
                    disabled={shelf.bookCount > 0}
                    title={shelf.bookCount > 0 ? "Gỡ hết sách khỏi kệ rồi mới xóa được" : undefined}
                    pendingLabel="Đang xóa…"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Xóa kệ
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
