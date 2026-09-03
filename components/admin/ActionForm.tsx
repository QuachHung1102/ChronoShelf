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
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.ok) formRef.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        // `confirm()` chặn được vì nó đồng bộ. Đây là lớp CHỐNG LỠ TAY, không phải
        // hàng rào: action tự kiểm quyền và tự từ chối những gì không được phép.
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
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
          <span className="mt-xs flex items-start gap-xs font-body text-body-sm text-secondary">
            <CheckCircle2 aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
            {state.ok}
          </span>
        )}
      </p>

      {/* Lỗi thì `role="alert"` chứ không phải polite — nó được đọc ngay lúc chèn vào
          DOM, và với nhánh này lời báo thường là phản hồi DUY NHẤT (danh sách không đổi
          gì cả). Cùng khuôn với `LoginForm` và `BookReaderModal`. */}
      {state.error && (
        <p
          role="alert"
          className="mt-xs flex items-start gap-xs font-body text-body-sm text-destructive"
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
