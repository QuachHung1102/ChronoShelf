"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { DANGER_BUTTON, LABEL } from "@/components/ui/controls";

/**
 * Ô tải bộ slide `.pptx`.
 *
 * Cùng khuôn `ImageField` và cùng những lý do, nên chỗ nào lệch đều là cố ý:
 *
 *  - Không có cặp ô Nguồn/Tác giả: bộ slide do chính giáo viên soạn, không phải ảnh mượn
 *    theo CC BY-SA. Ràng buộc đi kèm ở đây là `lessons_slide_filename_ck` (có tệp thì
 *    phải có tên), và nó được thỏa bằng cấu trúc: hai input ẩn cùng sinh ra, cùng biến mất.
 *  - Không có ảnh xem trước — `.pptx` không hiện được trong `<img>`. Ảnh xem trước là một
 *    `ImageField` riêng bên cạnh, đúng như spec §1 đã chốt.
 *
 * Vẫn giữ nguyên phần nghe sự kiện `reset`: React 19 gọi `form.reset()` sau MỌI lần
 * submit, kể cả khi action trả lỗi, và reset đó là reset DOM thuần — nó không với tới
 * `useState` của component này, nên thiếu đoạn dưới thì tên tệp trong input ẩn quay về
 * `defaultValue` trong khi state vẫn giữ tệp mới.
 */
export function SlideField({
  defaultUrl,
  defaultFilename,
}: {
  defaultUrl: string | null;
  defaultFilename: string | null;
}) {
  const [slide, setSlide] = useState<{ url: string; filename: string } | null>(
    defaultUrl && defaultFilename ? { url: defaultUrl, filename: defaultFilename } : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const box = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      // Đọc từ thuộc tính DOM chứ không từ closure — cùng lý do đã ghi trong `ImageField`:
      // `form.reset()` chạy trong pha mutation, nên closure gắn theo prop giữ giá trị của
      // lượt render TRƯỚC.
      const url = box.current?.dataset.defaultUrl || "";
      const filename = box.current?.dataset.defaultFilename || "";
      setSlide(url && filename ? { url, filename } : null);
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
      const res = await fetch("/api/quan-tri/tai-lieu", { method: "POST", body });
      const data: unknown = await res.json().catch(() => ({}));
      const obj = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
      if (!res.ok || typeof obj.url !== "string" || typeof obj.filename !== "string") {
        setError(typeof obj.error === "string" ? obj.error : "Không tải được tệp lên.");
        return;
      }
      setSlide({ url: obj.url, filename: obj.filename });
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
      data-default-filename={defaultFilename ?? ""}
      className="flex flex-col gap-xs rounded-md border border-surface-locked p-sm"
    >
      <legend className={`px-xs ${LABEL}`}>Bộ slide (.pptx)</legend>

      {slide === null ? (
        <>
          {/* Input đứng TRƯỚC nhãn là có chủ ý — xem lý do đầy đủ trong `ImageField`:
              `sr-only` không gỡ ô khỏi luồng Tab, nên vòng focus phải mượn được từ nó
              bằng `peer-*`, mà `peer-*` chỉ áp cho anh em đứng SAU. */}
          {/* `key` là BẮT BUỘC ở đây, không phải trang trí. Hai nhánh của `slide === null`
              đều mở đầu bằng một `<input>` ở cùng vị trí dưới cùng cha, nên React tái
              dùng đúng phần tử DOM đó thay vì thay mới — ô file (uncontrolled) biến
              thành ô hidden (controlled), và React cảnh báo đúng điều đó. Hai key khác
              nhau buộc nó tháo ra dựng lại. */}
          <input
            key="chon-tep"
            id={`${id}-file`}
            type="file"
            // Gợi ý cho hộp thoại chọn tệp. KHÔNG phải hàng rào — máy chủ tự kiểm byte.
            accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            disabled={busy}
            className="peer sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
          <label
            htmlFor={`${id}-file`}
            className={
              "inline-flex w-fit cursor-pointer items-center gap-xs rounded-sm font-body " +
              "text-body-sm text-tertiary-deep underline underline-offset-2 " +
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring " +
              "peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"
            }
          >
            {busy ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <FileUp aria-hidden className="h-4 w-4" />
            )}
            {busy ? "Đang tải lên…" : "Chọn tệp .pptx"}
          </label>
          <p className="font-body text-caption text-secondary">
            Tối đa 25 MB. Học sinh tải về được bản gốc, nên hãy nộp đúng tệp muốn phát.
          </p>
        </>
      ) : (
        <>
          <input key="da-chon" type="hidden" name="slideUrl" value={slide.url} />
          <input type="hidden" name="slideFilename" value={slide.filename} />

          <div className="flex items-start justify-between gap-sm">
            <p className="min-w-0 break-words font-body text-body-sm text-primary-dark">
              {slide.filename}
            </p>
            <button
              type="button"
              onClick={() => setSlide(null)}
              className={`${DANGER_BUTTON} shrink-0`}
            >
              <Trash2 aria-hidden className="h-4 w-4" />
              Gỡ tệp
            </button>
          </div>
          <p className="font-body text-caption text-secondary">
            Gỡ rồi bấm Lưu thì bài giảng không còn tệp tải về. Byte vẫn nằm trong kho —
            bảng tài liệu là bảng chỉ-ghi-thêm.
          </p>
        </>
      )}

      {/* Vùng live có mặt SẴN, rỗng nhưng vẫn hiện: `display:none` lúc rỗng sẽ gỡ nó khỏi
          cây trợ năng, và khi lỗi xuất hiện thì trình đọc màn hình coi đó là một vùng
          live vừa được THÊM chứ không phải một thay đổi — thường là im lặng. */}
      <p role="alert" className="font-body text-caption text-destructive">
        {error}
      </p>
    </fieldset>
  );
}
