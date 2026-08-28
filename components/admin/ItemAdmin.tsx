import { Info, Package, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ImageField } from "./ImageField";
import { createItem, deleteItem, updateItem } from "@/lib/admin/actions";
import type { AdminItemRow } from "@/lib/admin/items";
import { DANGER_BUTTON, FIELD, LABEL, PRIMARY_BUTTON } from "@/components/ui/controls";

/**
 * Màn `/quan-tri/vat-pham`.
 *
 * KHÔNG có đổi thứ tự và KHÔNG có xuất bản: bảng `items` không có cột `position` cũng
 * không có `published`, nên hai hành động đó không có gì để bám vào. Vật phẩm hiện ra khi
 * quyển sách thưởng nó được xuất bản — trạng thái của nó thuộc về quyển sách, không thuộc
 * về chính nó.
 */
export function ItemAdmin({ items }: { items: AdminItemRow[] }) {
  return (
    <div className="flex flex-col gap-lg">
      <p className="flex items-start gap-sm rounded-md bg-surface p-md font-body text-body-sm text-secondary">
        <Info aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
        <span>
          Vật phẩm là thứ mở khóa quyển sách kế tiếp. Tạo vật phẩm{" "}
          <strong className="font-semibold text-primary-dark">trước</strong> khi tạo sách, vì mỗi
          quyển chọn phần thưởng từ danh sách này.
        </span>
      </p>

      <section aria-labelledby="them-vp" className="rounded-md bg-surface p-md">
        <h2 id="them-vp" className="mb-sm font-heading text-headline-sm text-primary-dark">
          Thêm vật phẩm
        </h2>
        <ActionForm action={createItem} className="flex flex-col gap-sm">
          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="ten-vp-moi">
              Tên vật phẩm
            </label>
            <input
              id="ten-vp-moi"
              name="name"
              required
              maxLength={120}
              placeholder="Trống đồng Đông Sơn"
              className={FIELD}
            />
          </span>
          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="mo-ta-vp-moi">
              Mô tả ngắn
            </label>
            <textarea
              id="mo-ta-vp-moi"
              name="description"
              rows={2}
              maxLength={500}
              placeholder="Hiện ra khi học sinh đọc xong quyển sách thưởng vật phẩm này."
              className={FIELD}
            />
          </span>
          <ImageField
            prefix="image"
            label="Ảnh vật phẩm"
            defaultUrl={null}
            defaultSource={null}
            defaultCredit={null}
          />
          <SubmitButton className={`w-fit ${PRIMARY_BUTTON}`} pendingLabel="Đang tạo…">
            <Plus aria-hidden className="h-4 w-4" />
            Tạo vật phẩm
          </SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="ds-vp" className="flex flex-col gap-md">
        <h2 id="ds-vp" className="font-heading text-headline-sm text-primary-dark">
          {items.length} vật phẩm
        </h2>

        {items.length === 0 && (
          <p className="flex items-center gap-sm rounded-md bg-surface p-md font-body text-body-md text-secondary">
            <Package aria-hidden className="h-5 w-5" />
            Chưa có vật phẩm nào. Tạo cái đầu tiên ở trên.
          </p>
        )}

        {items.map((item) => (
          <article key={item.slug} className="rounded-md bg-surface p-md">
            <header className="mb-sm flex flex-wrap items-center gap-sm">
              <h3 className="font-heading text-headline-sm text-primary-dark">{item.name}</h3>
              <span className="font-body text-caption text-secondary">{item.slug}</span>
              {item.usedByBooks.length > 0 && (
                <span className="rounded-full bg-neutral px-sm py-[0.15rem] font-body text-caption text-primary-dark">
                  Phần thưởng của {item.usedByBooks.length} quyển
                </span>
              )}
            </header>

            <ActionForm action={updateItem} className="flex flex-col gap-sm">
              <input type="hidden" name="slug" value={item.slug} />
              <div className="grid gap-sm sm:grid-cols-2">
                <span className="flex flex-col gap-xs">
                  <label className={LABEL} htmlFor={`ten-${item.slug}`}>
                    Tên vật phẩm
                  </label>
                  <input
                    id={`ten-${item.slug}`}
                    name="name"
                    defaultValue={item.name}
                    required
                    maxLength={120}
                    className={FIELD}
                  />
                </span>
                <span className="flex flex-col gap-xs">
                  <label className={LABEL} htmlFor={`mota-${item.slug}`}>
                    Mô tả ngắn
                  </label>
                  <textarea
                    id={`mota-${item.slug}`}
                    name="description"
                    defaultValue={item.description}
                    rows={2}
                    maxLength={500}
                    className={FIELD}
                  />
                </span>
              </div>
              <ImageField
                prefix="image"
                label="Ảnh vật phẩm"
                defaultUrl={item.imageUrl}
                defaultSource={item.imageSource}
                defaultCredit={item.imageCredit}
              />
              <SubmitButton className={`w-fit ${PRIMARY_BUTTON}`} pendingLabel="Đang lưu…">
                Lưu
              </SubmitButton>
            </ActionForm>

            <footer className="mt-md border-t border-surface-locked pt-sm">
              <ActionForm
                action={deleteItem}
                confirmText={`Xóa vật phẩm "${item.name}"? Không hoàn tác được.`}
              >
                <input type="hidden" name="slug" value={item.slug} />
                <SubmitButton
                  className={DANGER_BUTTON}
                  disabled={item.usedByBooks.length > 0}
                  title={
                    item.usedByBooks.length > 0
                      ? `Đang là phần thưởng của: ${item.usedByBooks.join(", ")}`
                      : undefined
                  }
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                  Xóa vật phẩm
                </SubmitButton>
              </ActionForm>
              {item.usedByBooks.length > 0 && (
                // Nêu đích danh quyển nào chặn, thay vì bắt admin đi dò. Nút đã bị khóa,
                // nhưng lý do phải nhìn thấy được chứ không nằm trong tooltip.
                <p className="mt-xs font-body text-caption text-secondary">
                  Đổi phần thưởng của {item.usedByBooks.map((t) => `“${t}”`).join(", ")} trước khi
                  xóa.
                </p>
              )}
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}
