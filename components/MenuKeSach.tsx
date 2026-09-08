"use client";

import { useEffect, useRef } from "react";

/**
 * Bọc `<details>` của menu kệ sách để nó có đủ **ba** hành vi đóng của một dropdown thật.
 *
 * `<details>`/`<summary>` gốc cho miễn phí phần khó — đóng/mở, thao tác bàn phím,
 * `aria-expanded` do trình duyệt tự ánh xạ — nhưng nó KHÔNG có light-dismiss: không đóng
 * khi bấm ra ngoài, không đóng khi bấm Escape, và không đóng khi tiêu điểm Tab đi qua nó.
 * Panel rộng tối thiểu 224px, nên nó ở lại đè lên nội dung trang vô thời hạn; cơ chế tự
 * đóng duy nhất trước đây là `key={activeHref}` — chỉ chạy khi điều hướng sang trang khác.
 *
 * VÌ SAO KHÔNG DÙNG `popover="auto"`: nó cho cả ba hành vi đó miễn phí, nhưng popover sống
 * ở **top layer**, tức nằm ngoài mọi ngữ cảnh định vị của trang. Neo nó vào đúng nút "Kệ
 * sách" cần CSS anchor positioning, mà thứ đó chưa đủ hỗ trợ; không có anchor thì menu
 * rơi về mép phải khung nhìn, cách xa cái nút đã mở nó. Ba mươi dòng ở đây rẻ hơn một
 * dropdown lệch chỗ.
 *
 * Đây là mảnh client DUY NHẤT của `Header` — phần còn lại vẫn là Server Component và vẫn
 * hỏi `isAdmin()` phía máy chủ.
 */
export function MenuKeSach({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const dong = () => {
      if (el.open) el.open = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !el.open) return;
      dong();
      // Trả tiêu điểm về nút đã mở menu. Không có dòng này thì Escape đóng panel và ném
      // người dùng bàn phím về `<body>` — họ phải Tab lại từ đầu tài liệu.
      el.querySelector("summary")?.focus();
    };

    // `pointerdown` chứ không `click`: bấm ra ngoài phải đóng ngay lúc nhấn, trước khi
    // một cú `click` vào thứ bên dưới kịp chạy trên một menu vẫn đang mở.
    const onPointerDown = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) dong();
    };

    // `focusout` bọt lên; `relatedTarget` là nơi tiêu điểm SẮP tới. Null nghĩa là tiêu
    // điểm rời hẳn tài liệu (đổi tab, sang thanh địa chỉ) — lúc đó giữ menu mở là đúng.
    const onFocusOut = (e: FocusEvent) => {
      const toi = e.relatedTarget as Node | null;
      if (toi && !el.contains(toi)) dong();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
