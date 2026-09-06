"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Backpack, Flame } from "lucide-react";
import { navItemClass } from "@/components/ui/controls";
import { getUserShelfState } from "@/lib/api/shelf";
import { onAuthChange } from "@/lib/api/auth";

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
 *
 * Cả hai con số nay đều là LIÊN KẾT. Trước đây ngọn lửa là một `<span>` trông y hệt túi
 * hành trang bấm được: người dùng học được rằng số-cạnh-icon thì bấm được, bấm vào ngọn
 * lửa và không có gì xảy ra. Thẻ "N ngày liên tục" đầy đủ vốn đã nằm sẵn ở `/cong-dong`,
 * nên chỉ cần dẫn tới đó chứ không phải dựng màn mới. `title` cho cả hai để người dùng
 * chuột biết con số nghĩa là gì mà không tốn thêm chữ trong dải header đang chật.
 */
export function HeaderStats({ activeHref }: { activeHref?: string }) {
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

  // Túi hành trang chỉ vào được từ đúng icon này và nó KHÔNG nằm trong `navItems`, nên nếu
  // icon không sáng lên thì trên `/tui-hanh-trang` không mục nào trong header sáng cả —
  // người dùng mất mốc "tôi đang ở đâu" ngay trên màn hình mà cơ chế sưu tầm sống ở đó.
  const dangOTui = activeHref === "/tui-hanh-trang";

  return (
    <>
      {/* Ngọn lửa CỐ Ý không nhận trạng thái "đang chọn" dù nó dẫn tới `/cong-dong`: mục chữ
          "Cộng đồng" trên nav đã sáng cho trang đó rồi, và hai điểm sáng cho một trang thì
          không còn điểm nào là chỉ dẫn. */}
      <Link
        href="/cong-dong"
        title={so === null ? "Chuỗi ngày học liên tục" : `Chuỗi ${so.streak} ngày liên tục`}
        className={navItemClass(false)}
        aria-label={
          so === null
            ? "Chuỗi ngày học liên tục — xem ở trang Cộng đồng"
            : `Chuỗi ngày học liên tục: ${so.streak} ngày — xem ở trang Cộng đồng`
        }
      >
        <Flame
          aria-hidden
          className={`h-5 w-5 ${so && so.streak > 0 ? "text-tertiary-light" : "text-secondary-light"}`}
        />
        <span aria-hidden>{so === null ? "–" : so.streak}</span>
      </Link>

      <Link
        href="/tui-hanh-trang"
        title="Túi hành trang"
        aria-current={dangOTui ? "page" : undefined}
        className={navItemClass(dangOTui)}
        aria-label={
          so === null ? "Túi hành trang" : `Túi hành trang, đang giữ ${so.vatPham} vật phẩm`
        }
      >
        <Backpack aria-hidden className="h-5 w-5" />
        <span aria-hidden>{so === null ? "–" : so.vatPham}</span>
      </Link>
    </>
  );
}
