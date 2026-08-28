"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ActionState } from "@/lib/admin/actions";

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
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        // `confirm()` chặn được vì nó đồng bộ. Đây là lớp CHỐNG LỠ TAY, không phải
        // hàng rào: action tự kiểm quyền và tự từ chối những gì không được phép.
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {children}

      {/* aria-live để trình đọc màn hình đọc kết quả mà không cần chuyển tiêu điểm. */}
      <p aria-live="polite" className="empty:hidden">
        {state.error && (
          <span className="mt-xs flex items-start gap-xs font-body text-body-sm text-destructive">
            <AlertCircle aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0" />
            {state.error}
          </span>
        )}
        {state.ok && (
          <span className="mt-xs flex items-start gap-xs font-body text-body-sm text-secondary">
            <CheckCircle2 aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
            {state.ok}
          </span>
        )}
      </p>
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
