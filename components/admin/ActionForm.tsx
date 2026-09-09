"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/lib/action-state";

/**
 * Hai mảnh client DUY NHẤT của khu quản trị. Mọi thứ khác — danh sách, form, nhãn —
 * render trên máy chủ.
 *
 * `children` ở đây phải là ReactNode **thuần**, không được là render prop. Đã thử và
 * hỏng thật: `ShelfAdmin` là Server Component, mà function thì không đi qua được ranh
 * giới server → client (React báo "Functions are not valid as a child of Client
 * Components"). Đó chính là lý do trạng thái `pending` không truyền xuống bằng tham số
 * mà lấy bằng `useFormStatus` trong `SubmitButton` — hook đó đọc form bao quanh nó, nên
 * nút tự biết mình đang gửi mà không cần ai kể.
 */
export function ActionForm({
  action,
  children,
  className,
  /** Thông điệp `confirm()` trước khi gửi. Chỉ dùng cho thao tác không hoàn tác được. */
  confirmText,
  quietStatus = false,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  /**
   * Câu xác nhận thành công chỉ dành cho trình đọc màn hình, không vẽ ra.
   *
   * Bật cho những form mà kết quả TỰ HIỆN RA bằng mắt: nút đổi thứ tự (thẻ nhảy chỗ)
   * và nút xuất bản (chip trạng thái đổi màu). Ở đó vẽ thêm câu chữ vừa thừa vừa phá:
   * hai `<ActionForm>` của mũi tên lên/xuống là hai flex-item trong một cột rộng đúng
   * 72px ở mép phải header, nên một câu như *Đã đưa kệ "Lịch sử Việt Nam" về vị trí
   * 2/3.* làm `<form>` phình ra bằng `max-content` và đẩy cả header xuống dòng — hệ
   * thống vừa báo kết quả vừa phá luôn cái đích người dùng đang nhắm để bấm tiếp.
   *
   * `sr-only` chứ KHÔNG phải `hidden`/`empty:hidden`: `display:none` gỡ phần tử khỏi cây
   * trợ năng, còn `sr-only` chỉ thu nó về 1×1px và clip — vùng live vẫn có mặt sẵn, nên
   * trình đọc màn hình thấy một THAY ĐỔI chứ không phải một vùng live vừa được thêm.
   * Xem đoạn chú thích ngay dưới, và mục "Bẫy đã gặp" trong CLAUDE.md.
   *
   * KHÔNG truyền cho form xóa: xóa xong thì cả `<article>` biến mất theo
   * `revalidatePath`, `ActionForm` unmount, `<p>` chưa kịp render gì.
   */
  quietStatus?: boolean;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * Bản chụp những gì người dùng vừa gõ, lấy NGAY TRƯỚC khi gửi.
   *
   * React 19 gọi `form.reset()` sau MỌI lần submit — kể cả lần action trả về lỗi
   * (react-dom xếp hàng `requestFormReset` trước cả khi action chạy). `ImageField` và
   * `SlideField` mỗi cái tự vá state riêng của mình bằng listener `reset`, nhưng KHÔNG
   * AI vá phần input không kiểm soát: `defaultValue` chỉ đổi sau `revalidatePath`, mà
   * đường lỗi không gọi `revalidatePath`, nên reset kéo chúng về giá trị CŨ trên máy chủ.
   *
   * Hệ quả đo được: admin gõ 2.000 ký tự vào ô "Nội dung thưởng", quên điền danh hiệu,
   * bấm Lưu — máy chủ trả câu giải thích, và cùng lúc đó toàn bộ 2.000 ký tự biến mất.
   * Cùng đường đó chạm được ở `PageAdmin` (thân trang, `rows={8}`, không giới hạn ký tự)
   * và `QuestionAdmin`.
   *
   * Vá ở ĐÂY chứ không ở 15 form: đây là chỗ duy nhất mọi form đều đi qua.
   */
  const daGo = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [resetOnSuccess, state]);

  // Khôi phục sau khi action TRẢ LỖI. Chạy sau lượt render mang `state.error`, tức sau
  // khi React đã reset xong — nếu ghi sớm hơn thì chính cú reset sẽ xóa đè lên.
  //
  // Chỉ đụng `input`/`textarea`/`select` KHÔNG kiểm soát và không phải `type=file`
  // (không gán được giá trị cho input file, và trình duyệt cấm) hay `type=hidden`
  // (chúng do máy chủ dựng, giá trị mới luôn đúng hơn giá trị cũ).
  useEffect(() => {
    const form = formRef.current;
    const cu = daGo.current;
    if (!state.error || !form || !cu) return;
    for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    )) {
      if (!el.name || el.type === "file" || el.type === "hidden") continue;
      const v = cu.get(el.name);
      if (v === undefined) continue;
      if (el.type === "checkbox" || el.type === "radio") {
        (el as HTMLInputElement).checked = v === (el as HTMLInputElement).value;
      } else {
        el.value = v;
      }
    }
    daGo.current = null;
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      // `relative` là mốc cho câu lỗi ở chế độ `quietStatus` (xem chú thích dưới).
      className={`relative ${className ?? ""}`}
      onSubmit={(e) => {
        // `confirm()` chặn được vì nó đồng bộ. Đây là lớp CHỐNG LỠ TAY, không phải
        // hàng rào: action tự kiểm quyền và tự từ chối những gì không được phép.
        if (confirmText && !window.confirm(confirmText)) {
          e.preventDefault();
          return;
        }
        // Chụp TRƯỚC khi React kịp reset. `FormData` đọc giá trị hiện tại của mọi ô có
        // `name`; radio/checkbox chưa chọn thì vắng mặt, và vòng khôi phục ở trên bỏ qua
        // đúng những tên vắng mặt đó.
        const fd = new FormData(e.currentTarget);
        const m = new Map<string, string>();
        for (const [k, v] of fd.entries()) if (typeof v === "string") m.set(k, v);
        daGo.current = m;
      }}
    >
      {children}

      {/* aria-live để trình đọc màn hình đọc kết quả mà không cần chuyển tiêu điểm.
          KHÔNG được `empty:hidden` ở đây: lúc rỗng thẻ này bị `display:none`, tức bị gỡ
          khỏi cây trợ năng — rồi nội dung và việc hiện lại xảy ra trong CÙNG một lần cập
          nhật DOM, nên trình đọc màn hình coi đây là một vùng live vừa được thêm chứ
          không phải một thay đổi, và thường im lặng. Vùng live phải có sẵn, rỗng nhưng
          hiện, TRƯỚC khi nội dung được chèn vào. Thẻ `<p>` rỗng cao 0px nên không chiếm
          chỗ. */}
      <p aria-live="polite">
        {state.ok && (
          <span
            className={
              quietStatus
                ? "sr-only"
                : "mt-xs flex items-start gap-xs font-ui text-body-sm text-ink-dilute"
            }
          >
            {!quietStatus && (
              <CheckCircle2
                aria-hidden
                className="mt-[0.15em] h-4 w-4 shrink-0 text-son"
              />
            )}
            {state.ok}
          </span>
        )}
      </p>

      {/* Lỗi thì `role="alert"` chứ không phải polite — nó được đọc ngay lúc chèn vào
          DOM, và với nhánh này lời báo thường là phản hồi DUY NHẤT (danh sách không đổi
          gì cả). Cùng khuôn với `LoginForm` và `BookReaderModal`. */}
      {/* `quietStatus` trước đây chỉ làm im nhánh THÀNH CÔNG, nên nhánh lỗi vẫn vẽ một
          câu đầy đủ ngay giữa cột 72px ở mép phải header — đúng cái đổ vỡ mà `quietStatus`
          sinh ra để tránh, chỉ khác là nó xảy ra ở đường lỗi. `moveShelf` và `moveBook`
          trả lỗi thật ("Kệ này đã ở đầu hoặc cuối danh sách."), chạm được bằng hai cú bấm
          nhanh liên tiếp. Kéo câu đó ra khỏi luồng bố cục: nó vẫn hiện, vẫn được
          `role="alert"` đọc lên, nhưng thôi quyết định bề rộng của hàng. */}
      {state.error && (
        <p
          role="alert"
          className={
            quietStatus
              ? "absolute right-0 top-full z-10 mt-xs flex w-max max-w-measure items-start gap-xs rounded-sm border border-son bg-surface px-sm py-xs font-ui text-body-sm text-son"
              : "mt-xs flex items-start gap-xs font-ui text-body-sm text-son"
          }
        >
          <AlertCircle aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Nút gửi biết tự khóa khi form đang chạy.
 *
 * `disabled` là prop cộng thêm, không thay thế: hàng đầu danh sách vẫn phải khóa nút ▲
 * kể cả khi không có gì đang gửi.
 */
export function SubmitButton({
  className,
  disabled,
  title,
  pendingLabel,
  children,
}: {
  className: string;
  disabled?: boolean;
  title?: string;
  pendingLabel?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className} title={title}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
