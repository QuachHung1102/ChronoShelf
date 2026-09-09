"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const box = useRef<HTMLFieldSetElement>(null);

  // React 19 gọi `form.reset()` sau MỌI lần submit, kể cả khi action trả lỗi
  // (react-dom xếp hàng `requestFormReset` trước cả khi action chạy). Reset đó là reset
  // DOM thuần: nó kéo input không kiểm soát về `defaultValue` nhưng không với tới
  // `useState` của component con — Nguồn/Tác giả về rỗng trong khi ảnh ở lại, nên vật
  // phẩm kế tiếp âm thầm dùng lại ảnh cũ với attribution mới. Nghe chính sự kiện đó để
  // cả ba ô luôn đi cùng nhau.
  //
  // Giá trị để quay về đọc từ `data-default-url` chứ không từ closure: `form.reset()`
  // chạy trong pha mutation, SAU khi mọi thuộc tính DOM của lượt commit đó đã được ghi
  // nhưng TRƯỚC khi effect kịp đăng ký lại. Một closure gắn theo `[defaultUrl]` vì thế
  // giữ giá trị của lượt render TRƯỚC — ở màn Sửa đó đúng là tấm ảnh vừa bị thay, tức
  // vá xong màn Thêm lại làm hỏng màn Sửa. Đọc thuộc tính DOM là đọc đúng thứ mà hai ô
  // Nguồn/Tác giả cạnh nó đang đọc, nên cả ba luôn cùng một lượt dữ liệu.
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setUrl(box.current?.dataset.defaultUrl || null);
      setError(null);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

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
    <fieldset
      ref={box}
      data-default-url={defaultUrl ?? ""}
      className="flex flex-col gap-xs rounded-md border border-ink-dilute p-sm"
    >
      <legend className={`px-xs ${LABEL}`}>{label}</legend>

      {url === null ? (
        <>
          {/* Input đứng TRƯỚC nhãn trong DOM là có chủ ý, không phải tình cờ: `sr-only`
              chỉ thu ô này về 1x1px và clip nó chứ không gỡ khỏi luồng Tab, nên nó vẫn
              nhận tiêu điểm — và trình duyệt vẽ vòng focus quanh một hộp 1px vô hình,
              tức WCAG 2.4.7 hỏng. `peer-*` chỉ áp cho anh em đứng SAU, nên nhãn phải
              nằm sau input thì mới mượn được trạng thái focus của nó. Vòng focus lấy
              đúng token của `FOCUS_RING`; không dùng lại chính hằng đó được vì nó mang
              sẵn tiền tố `focus-visible:`, và nền ở đây là `bg-surface` của thẻ quản trị
              chứ không phải `neutral`. Vị trí absolute của `sr-only` giữ nguyên bố cục. */}
          <input
            id={`${id}-file`}
            type="file"
            // Gợi ý cho hộp thoại chọn tệp. KHÔNG phải hàng rào — máy chủ sniff magic byte
            // và bỏ qua hoàn toàn cả `accept` lẫn `file.type`.
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            className="peer sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Tải lên NGAY khi chọn: giữa lúc chọn và lúc gửi form không có gì để chỉnh,
              // nên một nút "Tải lên" riêng chỉ là một cú bấm thừa và một trạng thái thừa.
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={`${id}-file`}
            className={
              "inline-flex w-fit cursor-pointer items-center gap-xs rounded-sm font-ui " +
              "text-body-sm text-son underline underline-offset-2 " +
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring " +
              "peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
            }
          >
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <ImagePlus aria-hidden className="h-4 w-4" />
            )}
            {busy ? "Đang tải lên…" : "Chọn ảnh"}
          </label>
          <p className="font-ui text-caption text-ink-dilute">
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
              className="h-20 w-20 shrink-0 rounded-sm bg-mist object-contain"
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
          <p className="font-ui text-caption text-ink-dilute">
            Hai ô trên là điều kiện của giấy phép CC BY-SA, không phải thủ tục — thiếu là không lưu được.
          </p>
        </>
      )}

      {/* `role="alert"` chứ không phải một vùng `aria-live` chờ sẵn kèm `empty:hidden`:
          lúc rỗng, `empty:hidden` cho thẻ `display:none` — tức gỡ nó khỏi cây trợ năng —
          rồi nội dung và việc hiện lại xảy ra trong cùng một lần cập nhật DOM, nên trình
          đọc màn hình coi đây là vùng live vừa được thêm chứ không phải một thay đổi và
          thường im lặng. Cùng khuôn với `ActionForm`, `LoginForm`, `BookReaderModal`. */}
      {error && <p role="alert" className="font-ui text-body-sm text-son">{error}</p>}
    </fieldset>
  );
}
