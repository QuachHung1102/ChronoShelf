"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Backpack, Flame } from "lucide-react";
import { getUserShelfState } from "@/lib/api/shelf";
import { onAuthChange } from "@/lib/api/auth";

const FOCUS_ON_DARK =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm";

interface So {
  streak: number;
  vatPham: number;
}

/**
 * Ngọn lửa giữ chuỗi và túi hành trang trên header (content.md §3).
 *
 * MỘT component cho cả hai con số, không phải hai: chúng đến từ cùng một lượt gọi
 * `/api/me/state`. Tách đôi thì mỗi lần tải trang là hai request y hệt nhau.
 *
 * Chạy phía client dù phiên nằm trong cookie `httpOnly` — cùng lý do như `AuthMenu`:
 * `Header` nằm trên MỌI trang, nên bắt nó đọc database sẽ kéo cả những trang không cần
 * vào diện động chỉ để hiện hai con số.
 *
 * Chưa biết thì hiện "–", KHÔNG hiện 0. "Chưa đăng nhập" và "có 0 vật phẩm" là hai
 * chuyện khác nhau, và một cú nấc mạng không được phép trông như vừa mất sạch bộ sưu tập
 * hay vừa đứt chuỗi — đúng bài học của C07.
 */
export function HeaderStats() {
  const [so, setSo] = useState<So | null>(null);

  useEffect(() => {
    let alive = true;
    const doc = () =>
      getUserShelfState()
        .then((s) => {
          if (alive) setSo({ streak: s.streak, vatPham: s.ownedItemSlugs.size });
        })
        .catch(() => {
          // Giữ nguyên số đang hiện. Lỗi truyền tải không phải là "túi rỗng, chuỗi đứt".
        });

    void doc();
    const thoi = onAuthChange(() => void doc());
    return () => {
      alive = false;
      thoi();
    };
  }, []);

  return (
    <>
      <span
        className="flex items-center gap-xs text-on-primary"
        aria-label={
          so === null
            ? "Chuỗi ngày học liên tục: chưa có dữ liệu"
            : `Chuỗi ngày học liên tục: ${so.streak} ngày`
        }
      >
        <Flame
          aria-hidden
          className={`h-5 w-5 ${so && so.streak > 0 ? "text-tertiary-light" : "text-secondary-light"}`}
        />
        <span aria-hidden className="font-body text-label-md">
          {so === null ? "–" : so.streak}
        </span>
      </span>

      <Link
        href="/tui-hanh-trang"
        className={`flex items-center gap-xs text-on-primary transition-colors duration-200 ease-out hover:text-tertiary-light ${FOCUS_ON_DARK}`}
        aria-label={
          so === null ? "Túi hành trang" : `Túi hành trang, đang giữ ${so.vatPham} vật phẩm`
        }
      >
        <Backpack aria-hidden className="h-5 w-5" />
        <span aria-hidden className="font-body text-label-md">
          {so === null ? "–" : so.vatPham}
        </span>
      </Link>
    </>
  );
}
