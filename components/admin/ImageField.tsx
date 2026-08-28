"use client";

import { useId, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { DANGER_BUTTON, FIELD, LABEL } from "@/components/ui/controls";
import type { ImagePrefix } from "@/lib/admin/image-fields";

/**
 * Ô ảnh: tải lên + hai ô nguồn/tác giả BẮT BUỘC khi và chỉ khi có ảnh.
 *
 * Điều kiện "khi và chỉ khi" có được **miễn phí** bằng cấu trúc chứ không bằng logic:
 * hai ô đó chỉ TỒN TẠI trong DOM khi `url !== null`. Không cần schema validation, không
 * cần máy trạng thái, không cần `useEffect` đồng bộ. Thuộc tính `required` của HTML lo
 * nốt phần nhắc người dùng.
 *
 * "Gỡ ảnh" đưa `url` về null ⇒ cả ba input biến mất ⇒ form gửi lên cả ba đều rỗng ⇒
 * `readImageFields()` ghi cả ba thành NULL. Một thao tác, không có trạng thái nửa vời
 * kiểu "ảnh đã xóa nhưng credit còn treo".
 *
 * Đây là mảnh client THỨ HAI của khu quản trị, sau `ActionForm`/`SubmitButton`.
 */
export function ImageField({
  prefix,
  label,
  hint,
  defaultUrl,
  defaultSource,
  defaultCredit,
}: {
  prefix: ImagePrefix;
  label: string;
  hint?: string;
  defaultUrl: string | null;
  defaultSource: string | null;
  defaultCredit: string | null;
}) {
  const [url, setUrl] = useState<string | null>(defaultUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/quan-tri/anh", { method: "POST", body });
      const data: unknown = await res.json().catch(() => ({}));
      const obj = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      if (!res.ok || typeof obj.url !== "string") {
        setError(typeof obj.error === "string" ? obj.error : "Không tải được ảnh lên.");
        return;
      }
      setUrl(obj.url);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-xs rounded-md border border-surface-locked p-sm">
      <legend className={`px-xs ${LABEL}`}>{label}</legend>

      {url === null ? (
        <>
          <label
            htmlFor={`${id}-file`}
            className="inline-flex w-fit cursor-pointer items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep underline underline-offset-2"
          >
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus aria-hidden className="h-4 w-4" />
            )}
            {busy ? "Đang tải lên…" : "Chọn ảnh"}
          </label>
          <input
            id={`${id}-file`}
            type="file"
            // Gợi ý cho hộp thoại chọn tệp. KHÔNG phải hàng rào — máy chủ sniff magic byte
            // và bỏ qua hoàn toàn cả `accept` lẫn `file.type`.
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Tải lên NGAY khi chọn: giữa lúc chọn và lúc gửi form không có gì để chỉnh,
              // nên một nút "Tải lên" riêng chỉ là một cú bấm thừa và một trạng thái thừa.
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <p className="font-body text-caption text-secondary">
            {hint ?? "PNG, JPEG, WebP hoặc GIF. Tối đa 2 MB — nên chọn bản rộng khoảng 1600px."}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-start gap-sm">
            {/* `<img>` thô cho khớp phần còn lại của repo: không có `sharp` nên `next/image`
                ở production không mang lại gì mà lại thêm một dependency native. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-20 w-20 shrink-0 rounded-sm bg-surface-locked object-contain"
            />
            <div className="flex flex-1 flex-col gap-xs">
              <input type="hidden" name={`${prefix}Url`} value={url} />
              <label className={LABEL} htmlFor={`${id}-source`}>
                Nguồn ảnh <span aria-hidden>*</span>
              </label>
              <input
                id={`${id}-source`}
                name={`${prefix}Source`}
                required
                defaultValue={defaultSource ?? ""}
                maxLength={500}
                placeholder="https://commons.wikimedia.org/wiki/File:…"
                className={FIELD}
              />
              <label className={LABEL} htmlFor={`${id}-credit`}>
                Tác giả + giấy phép <span aria-hidden>*</span>
              </label>
              <input
                id={`${id}-credit`}
                name={`${prefix}Credit`}
                required
                defaultValue={defaultCredit ?? ""}
                maxLength={500}
                placeholder="Tên tác giả · CC BY-SA 4.0"
                className={FIELD}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setUrl(null);
              setError(null);
            }}
            className={`w-fit ${DANGER_BUTTON}`}
          >
            <Trash2 aria-hidden className="h-4 w-4" />
            Gỡ ảnh
          </button>
          <p className="font-body text-caption text-secondary">
            Hai ô trên là điều kiện của giấy phép CC BY-SA, không phải thủ tục — thiếu là không lưu được.
          </p>
        </>
      )}

      <p aria-live="polite" className="empty:hidden">
        {error && <span className="font-body text-body-sm text-destructive">{error}</span>}
      </p>
    </fieldset>
  );
}
