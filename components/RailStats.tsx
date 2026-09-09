"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserShelfState } from "@/lib/api/shelf";
import { onAuthChange } from "@/lib/api/auth";
import { FOCUS_RING } from "@/components/ui/controls";

interface So {
  streak: number;
  vatPham: number;
}

/**
 * Hai đồng hồ chỉ số ở chân rail: chuỗi ngày học và số vật phẩm đã sưu tầm (content.md §3).
 *
 * Hình thức lấy từ grammar của chậu mực — "các núm có tên vật lý thật": nhãn viết hoa nhỏ,
 * con số lớn nhẹ ngay dưới. Đó là cách bảng điều khiển của một chậu mực nói, và nó đọc theo
 * một lượt quét dọc, đúng thứ rail dọc được dựng để làm.
 *
 * MỘT component cho cả hai con số, không phải hai: chúng đến từ cùng một lượt gọi
 * `/api/me/state`. Tách đôi thì mỗi lần tải trang là hai request y hệt nhau.
 *
 * Chưa biết thì hiện "—", KHÔNG hiện 0. "Chưa đăng nhập" và "có 0 vật phẩm" là hai chuyện
 * khác nhau, và một cú nấc mạng không được phép trông như vừa mất sạch bộ sưu tập.
 */
export function RailStats() {
  const [so, setSo] = useState<So | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getUserShelfState()
        .then((s) => {
          if (!alive) return;
          setSo({ streak: s.streak, vatPham: s.ownedItemSlugs.size });
        })
        // Lỗi truyền tải KHÔNG phải "chưa đăng nhập": `/api/me/state` trả 200 với danh sách
        // rỗng cho người chưa đăng nhập. Nhánh này chỉ chạy khi lỗi thật, và khi đó giữ
        // nguyên con số đang có còn trung thực hơn là tụt về 0.
        .catch(() => {});

    void load();
    const unsubscribe = onAuthChange(() => void load());
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // MỘT CỘT, không phải lưới hai ô cạnh nhau — và đó là một lỗi đã đo được, không phải khẩu
  // vị. Hai ô chia đôi rail cho mỗi ô 115,5px, trừ padding còn 83,5px, trong khi nhãn
  // "CHUỖI NGÀY" ở `label-caps` (12px, giãn chữ 0.18em) cần 84px: tràn nửa pixel và xuống
  // dòng, nên con số của nó tụt thấp hơn con số bên cạnh đúng một dòng. Người dùng báo đúng
  // chỗ này. Xếp dọc còn đúng DESIGN.md § Layout ("các đồng hồ chỉ số đọc theo một lượt quét
  // dọc"), và không tốn thêm chiều cao nào: đo lại sau khi sửa là 49,6 + 50,6 = 100,2px, so
  // với 100,8px của lưới hai ô.
  return (
    <div className="flex flex-col border-t border-mist">
      <DongHo
        nhan="Chuỗi ngày"
        gia={so?.streak}
        donVi="ngày"
        href="/cong-dong"
        moTa="Xem chuỗi ngày học ở trang Cộng đồng"
      />
      <DongHo
        nhan="Vật phẩm"
        gia={so?.vatPham}
        donVi="món"
        href="/tui-hanh-trang"
        moTa="Mở túi hành trang"
        vien
      />
    </div>
  );
}

function DongHo({
  nhan,
  gia,
  donVi,
  href,
  moTa,
  vien = false,
}: {
  nhan: string;
  gia: number | undefined;
  donVi: string;
  href: string;
  moTa: string;
  /** Đường kẻ ngăn với đồng hồ phía trên. */
  vien?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={moTa}
      className={`flex items-baseline justify-between gap-sm px-md py-sm transition-colors duration-200 ease-out hover:bg-surface ${FOCUS_RING} ${
        vien ? "border-t border-mist" : ""
      }`}
    >
      {/* `whitespace-nowrap` là hàng rào, không phải trang trí: nhãn xuống dòng chính là lỗi
          mà bố cục một cột đang sửa, và cột hẹp thì lỗi đó quay lại được bất cứ lúc nào ai
          đó thêm một đồng hồ có nhãn dài hơn. */}
      <span className="whitespace-nowrap font-ui text-label-caps uppercase text-ink-dilute">
        {nhan}
      </span>
      <span className="flex items-baseline gap-xs">
        {/* `tabular-nums`: con số đổi mỗi ngày, và chữ số không đều bề ngang làm cả khối
            nhảy ngang một nhịp khi 9 thành 10. */}
        <span className="font-ui text-display-md tabular-nums text-primary">
          {gia === undefined ? "—" : gia}
        </span>
        <span className="font-ui text-caption text-ink-dilute">{donVi}</span>
      </span>
    </Link>
  );
}
