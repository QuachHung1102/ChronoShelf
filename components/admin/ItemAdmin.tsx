import { Info, Package, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ADMIN_CARD, CARD_DIVIDER, CardDisclosure } from "./card";
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
 *
 * Đây là màn hưởng lợi nhiều nhất từ `CardDisclosure`: 13 vật phẩm mà thẻ nào cũng mở
 * toang thì trang dài 6175px — tám màn hình 768px — và nó dài thêm theo mỗi lần tạo nội
 * dung. Gập lại thì nó thành một mục lục lướt được trong một màn.
 */
export function ItemAdmin({ items }: { items: AdminItemRow[] }) {
  return (
    <div className="flex flex-col gap-lg">
      <p className={`flex items-start gap-sm font-body text-body-sm text-secondary ${ADMIN_CARD}`}>
        <Info aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
        <span>
          Vật phẩm là thứ mở khóa quyển sách kế tiếp. Tạo vật phẩm{" "}
          <strong className="font-semibold text-primary-dark">trước</strong> khi tạo sách, vì mỗi
          quyển chọn phần thưởng từ danh sách này.
        </span>
      </p>

      <section aria-labelledby="them-vp" className={ADMIN_CARD}>
        <h2 id="them-vp" className="mb-sm font-heading text-headline-sm text-primary-dark">
          Thêm vật phẩm
        </h2>
        <ActionForm action={createItem} className="flex flex-col gap-sm">
          {/* Tiền tố `them-` là không gian tên riêng của form TẠO. Hàng sửa bên dưới sinh
              id `ten-${slug}` / `mota-${slug}`, mà slug là `text PRIMARY KEY` không có
              CHECK và còn đặt được bằng SQL tay — nên một vật phẩm slug `vp-moi` sẽ sinh
              đúng `ten-vp-moi` và đụng id với form này. Trùng id thì `<label htmlFor>`
              trỏ vào ô đầu tiên trong DOM, tức nhãn ở đây kéo tiêu điểm xuống hàng sửa. */}
          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="them-vp-ten">
              Tên vật phẩm
            </label>
            <input
              id="them-vp-ten"
              name="name"
              required
              maxLength={120}
              placeholder="Trống đồng Đông Sơn"
              className={FIELD}
            />
          </span>
          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="them-vp-mota">
              Mô tả ngắn
            </label>
            <textarea
              id="them-vp-mota"
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
          <p className={`flex items-center gap-sm font-body text-body-md text-secondary ${ADMIN_CARD}`}>
            <Package aria-hidden className="h-5 w-5" />
            Chưa có vật phẩm nào. Tạo cái đầu tiên ở trên.
          </p>
        )}

        {items.map((item) => (
          <article key={item.slug} className={ADMIN_CARD}>
            <header className="flex flex-wrap items-center gap-sm">
              <h3 className="font-heading text-headline-sm text-primary-dark">{item.name}</h3>
              <span className="font-body text-caption text-secondary">{item.slug}</span>
              {item.usedByBooks.length > 0 && (
                // Viền `secondary`: `bg-neutral` trên thẻ `bg-surface` chỉ đạt 1.16:1, tức
                // viên thuốc không tồn tại về mặt thị giác nếu không có ranh giới.
                <span className="rounded-full border border-secondary bg-neutral px-sm py-[0.15rem] font-body text-caption text-primary-dark">
                  Phần thưởng của {item.usedByBooks.length} quyển
                </span>
              )}
            </header>

            <CardDisclosure label="Sửa vật phẩm">
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

              <div className={`mt-md border-t ${CARD_DIVIDER} pt-sm`}>
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
                    pendingLabel="Đang xóa…"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Xóa vật phẩm
                  </SubmitButton>
                </ActionForm>
                {item.usedByBooks.length > 0 && (
                  // Nêu đích danh quyển nào chặn, thay vì bắt admin đi dò. Nút đã bị khóa,
                  // nhưng lý do phải nhìn thấy được chứ không nằm trong tooltip.
                  <p className="mt-xs max-w-measure font-body text-caption text-secondary">
                    Đổi phần thưởng của {item.usedByBooks.map((t) => `“${t}”`).join(", ")} trước khi
                    xóa.
                  </p>
                )}
              </div>
            </CardDisclosure>
          </article>
        ))}
      </section>
    </div>
  );
}
