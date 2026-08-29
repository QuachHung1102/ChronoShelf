"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Backpack } from "lucide-react";
import { getUserShelfState } from "@/lib/api/shelf";
import { onAuthChange } from "@/lib/api/auth";

const FOCUS_ON_DARK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

/**
 * Số vật phẩm đang giữ, hiện trên header ở mọi trang (content.md §3).
 *
 * Chạy phía client dù phiên nằm trong cookie `httpOnly` (server đọc được) — cùng lý do như
 * `AuthMenu`: `Header` nằm trong layout của MỌI trang, nên bắt nó đọc database sẽ kéo cả
 * những trang không cần vào diện động chỉ để hiện một con số.
 *
 * Chưa biết số thì hiện "–", KHÔNG hiện 0: chưa đăng nhập và "có 0 vật phẩm" là hai chuyện
 * khác nhau, và một cú nấc mạng không được phép trông như vừa mất sạch bộ sưu tập.
 */
export function BagCount() {
  const [so, setSo] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const doc = () =>
      getUserShelfState()
        .then((s) => {
          if (alive) setSo(s.ownedItemSlugs.size);
        })
        .catch(() => {
          // Giữ nguyên số đang hiện. Lỗi truyền tải không phải là "túi rỗng".
        });

    void doc();
    const thoi = onAuthChange(() => void doc());
    return () => {
      alive = false;
      thoi();
    };
  }, []);

  return (
    <Link
      href="/tui-hanh-trang"
      className={`flex items-center gap-xs text-on-primary transition-colors duration-200 ease-out hover:text-tertiary-light ${FOCUS_ON_DARK}`}
      aria-label={
        so === null ? "Túi hành trang" : `Túi hành trang, đang giữ ${so} vật phẩm`
      }
    >
      <Backpack aria-hidden className="h-5 w-5" />
      <span aria-hidden className="font-body text-label-md">
        {so === null ? "–" : so}
      </span>
    </Link>
  );
}
