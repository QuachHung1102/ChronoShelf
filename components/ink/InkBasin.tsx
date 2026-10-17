"use client";

import { useEffect, useRef, useState } from "react";
import { createInkBasin, toBasinCoords, type InkBasin as Basin, type Pigment } from "@/lib/ink/fluid";
import { chonGiot, giotRoi, nhipNgauNhien, type CuGiot } from "@/lib/ink/giot";

/** Ba sắc tố của chậu — mỗi kệ sách một sắc tố (DESIGN.md § Ink). */
export type PigmentName = "cham" | "son" | "sumi";

/**
 * Một cú thả mực đặt sẵn, chạy khi chậu vừa dựng xong. Toạ độ 0..1, gốc dưới-trái.
 *
 * Chậu phải CÓ VÂN ngay từ khung hình đầu tiên: một mặt nước trắng trơn chờ người dùng rê
 * chuột thì với người không rê chuột, nó chỉ là một mảng trắng — tức cả thế giới thị giác
 * biến mất với đúng những người dùng bàn phím.
 */
export interface Seed {
  x: number;
  y: number;
  dx: number;
  dy: number;
  amount?: number;
}

function readPigment(varName: string): Pigment {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return hexToPigment(hex);
}

/**
 * Thả một bộ giọt vào chậu. Mỗi giọt đi qua `giotRoi`, tức chạm mặt nước rồi loang tròn
 * ra từ tâm — chứ không bị đẩy lệch theo một vector như bản trước.
 *
 * `dx`/`dy` của `Seed` nay là một cú đẩy CỘNG THÊM, dùng khi muốn giọt trôi nhẹ về một
 * phía sau khi đã loang; để 0 là giọt rơi thẳng.
 */
function thaGiot(basin: Basin, danhSach: Seed[]) {
  for (const s of danhSach) {
    thaVong(basin, giotRoi(s.x, s.y, s.amount ?? 0.6, 4, undefined, undefined, Math.random));
    if (s.dx !== 0 || s.dy !== 0) basin.splat(s.x, s.y, s.dx, s.dy, 0, 0.006);
  }
}

/** Chạy một chuỗi lần chạm của `giotRoi` lên chậu. */
export function thaVong(basin: Basin, cu: CuGiot[]) {
  for (const c of cu) basin.drop(c.x, c.y, c.r, c.amount);
}

/** `#RRGGBB` → ba số 0..1. Hex hỏng thì trả về đen — mực đen vẫn là mực. */
function hexToPigment(hex: string): Pigment {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  const v = parseInt(m[1], 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

/**
 * Chậu mực — nền sống của sản phẩm.
 *
 * Ba luật của DESIGN.md § Ink được ép ở ĐÂY chứ không để mỗi trang tự nhớ:
 *   1. Chậu nằm dưới nội dung và không nhận con trỏ (`pointer-events: none` trên canvas);
 *      trang nào muốn mực trả lời con trỏ thì truyền `interactive` và chậu tự nghe trên
 *      chính khung của nó.
 *   2. `prefers-reduced-motion: reduce` thì mô phỏng chạy tới một trạng thái ĐÃ LẮNG rồi
 *      dừng hẳn — không phải chậm lại. Vân vẫn ở đó, chỉ là nó không còn chảy.
 *   3. Máy không có WebGL2 vẫn phải đọc được màn hình: chậu biến mất, nền `paper` ở lại.
 */
export function InkBasin({
  pigment = "cham",
  seeds = [],
  interactive = false,
  dongChay = true,
  nhipGiot = 0,
  onReady,
  className = "",
}: {
  pigment?: PigmentName;
  seeds?: Seed[];
  /** Cho phép mực trả lời con trỏ trong khung này. Chỉ bật ở nơi KHÔNG có chữ đang đọc. */
  interactive?: boolean;
  /**
   * Dòng chảy nền — mặt nước tự động chảy khắp chậu thay vì đứng im.
   *
   * VÌ SAO CẦN. Người dùng báo: "hiệu ứng loang mực chỉ auto một chỗ". Đúng, và có hai lý
   * do cộng lại. Một: nhịp tự động duy nhất của màn kệ sách chỉ thả mực ở ĐÚNG một điểm —
   * giọt của bài nên đọc tiếp. Hai: `velocityDissipation` 0.991 tắt vận tốc sau vài giây,
   * nên những giọt đặt sẵn loang xong là nằm bất động; mặt nước thành một bức tranh tĩnh.
   *
   * Dòng chảy nền chỉ bơm VẬN TỐC (`amount = 0`), không thêm một hạt mực nào — lượng mực
   * trên mặt nước mang nghĩa "đã đọc xong bao nhiêu quyển" nên nó không được tự sinh.
   * Mực đã có thì trôi và biến hình liên tục; chậu chưa có mực vẫn là nước trong, đúng như
   * DESIGN.md § Ink quy định cho kệ chưa học tới.
   *
   * Ngân sách chuyển động của DESIGN.md § Motion vẫn giữ: mặt nước là NGOẠI LỆ NỀN, và thứ
   * chuyển động CÓ CHỦ Ý trên màn vẫn đúng một cái — giọt mực mới nhất, đậm hơn hẳn.
   */
  dongChay?: boolean;
  /**
   * Khoảng cách TRUNG BÌNH (giây) giữa hai giọt rơi tiếp theo. 0 = chỉ thả một lần lúc dựng.
   *
   * Mỗi lần đúng MỘT giọt, chọn ngẫu nhiên trong `seeds` và lệch nhẹ khỏi chỗ cũ, cách nhau
   * một khoảng dao động ±45% quanh con số này — xem `chonGiot`/`nhipNgauNhien`.
   *
   * Cần vì mực tan dần (`dyeDissipation`): đo trên màn thật, ba giọt của trang đăng nhập
   * gần như biến mất sau khoảng nửa phút, và chậu thành mặt nước trắng trơn — đúng chỗ mà
   * `seeds` tồn tại để tránh.
   *
   * Ở màn kệ sách nhịp này còn GIỮ ĐƯỢC NGHĨA của mực: `seeds` là những quyển đã đọc xong,
   * nên thả lại đúng bộ đó là lượng mực trên mặt nước luôn tỉ lệ với số bài đã học, thay vì
   * nhạt dần theo thời gian người dùng ngồi nhìn.
   */
  nhipGiot?: number;
  /**
   * Trao chậu cho phần giao diện đứng ở BỜ.
   *
   * Đây là thứ nối hai nửa màn hình kệ sách: rê chuột lên một bài học ở lề trái thì giọt
   * mực của chính bài đó loang ra trong chậu bên phải. Không có đường này thì mực chỉ là
   * hình nền đẹp, và "chậu mực" tụt xuống thành một tấm wallpaper.
   *
   * Trả `null` khi chậu bị tháo, để chỗ gọi không giữ một tham chiếu đã chết.
   */
  onReady?: (basin: Basin | null) => void;
  className?: string;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const basinRef = useRef<Basin | null>(null);
  const [failed, setFailed] = useState(false);

  // `seeds` là mảng literal ở call site nên tham chiếu đổi mỗi lần render; đưa nó vào deps
  // sẽ dựng lại cả chậu mỗi lượt. Ref giữ giá trị của lượt ĐẦU, và không được gán lại trong
  // thân render — đó là lỗi React thật (`Cannot access refs during render`), không phải khẩu
  // vị của linter. Ở đây không mất gì: những giọt đặt sẵn chỉ chạy đúng một lần lúc dựng chậu.
  const seedsRef = useRef(seeds);
  // Cùng lý do với seeds: callback thường là hàm inline ở call site, nên đưa nó vào deps
  // sẽ dựng lại cả bộ giải chất lỏng mỗi lượt render của cha.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const varName =
      pigment === "son" ? "--pigment-son" : pigment === "sumi" ? "--pigment-sumi" : "--pigment-cham";
    const basin = createInkBasin(canvas, readPigment(varName), readPigment("--basin-paper"));
    if (!basin) {
      setFailed(true);
      return;
    }
    basinRef.current = basin;
    onReadyRef.current?.(basin);

    thaGiot(basin, seedsRef.current);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (reduced.matches) {
        basin.stop();
        // Chạy tới trạng thái đã lắng rồi vẽ một lần: người tắt chuyển động vẫn thấy đúng
        // bức vân mà người kia thấy sau vài giây, chỉ là không thấy nó hình thành.
        basin.settle();
      } else {
        basin.start();
      }
    };
    apply();
    reduced.addEventListener("change", apply);

    const onResize = () => basin.resize();
    window.addEventListener("resize", onResize);

    // Tab bị ẩn thì dừng hẳn: một bộ giải GPU chạy nền là pin của học sinh.
    const onVisibility = () => {
      if (document.hidden) basin.stop();
      else if (!reduced.matches) basin.start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      reduced.removeEventListener("change", apply);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      basin.destroy();
      basinRef.current = null;
      onReadyRef.current?.(null);
    };
  }, [pigment]);

  /**
   * Dòng chảy nền: sáu cú quạt rải khắp chậu mỗi 1,1 giây, chỉ bơm vận tốc.
   *
   * Vị trí đi theo hai tần số KHÔNG cùng ước — 0.11 và 0.073 vòng/giây — nên quỹ đạo không
   * bao giờ khép lại thành một vòng lặp mắt nhận ra được. Sáu điểm lệch pha đều nhau phủ
   * kín chậu, thay cho "auto một chỗ" của bản trước.
   *
   * Bán kính 0.02 chứ không phải 0.0011 của một giọt: cú khuấy phải đẩy được cả một VÙNG
   * nước. Với bán kính giọt thì nó chỉ chọc một lỗ kim và dòng chảy tắt trước khi tới đâu.
   *
   * `prefers-reduced-motion` thì không chạy — chậu đã dừng hẳn ở trạng thái đã lắng, và một
   * cú khuấy sẽ khởi động lại đúng thứ người dùng vừa tắt.
   */
  useEffect(() => {
    if (!dongChay) return;
    // Đọc `matches` ở MỖI nhịp chứ không một lần lúc dựng: người dùng bật "giảm chuyển
    // động" giữa chừng thì `apply()` ở effect trên dừng vòng vẽ, nhưng cú khuấy vẫn tiếp
    // tục bơm vận tốc vào một chậu đã lắng — và nó sẽ bung ra ngay khi tắt lại thiết lập đó.
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)");

    const batDau = performance.now();
    const nhip = window.setInterval(() => {
      const basin = basinRef.current;
      if (!basin || document.hidden || giamChuyenDong.matches) return;
      const t = (performance.now() - batDau) / 1000;
      for (let i = 0; i < 6; i++) {
        const pha = (i * Math.PI) / 3;
        const x = 0.5 + 0.34 * Math.cos(t * 0.11 * Math.PI * 2 + pha);
        const y = 0.5 + 0.34 * Math.sin(t * 0.073 * Math.PI * 2 + pha);
        // Đẩy NGANG, biên độ nhỏ. Bản trước đẩy theo phương tiếp tuyến quanh tâm chậu, và
        // cộng với việc giọt nở đều ra mọi phía thì cả chậu đọc ra là "con mực phun mực" —
        // người dùng nói đúng chữ đó. Chuyển động chính nay do TRỌNG LỰC của mực lo (mực
        // chìm, kéo vệt dọc); cú khuấy chỉ còn việc làm mặt nước lay nhẹ để vệt không rơi
        // thẳng đơ như một cột.
        // Hướng quạt xoay chậm theo thời gian và lệch nhau giữa bốn điểm: mặt nước bị quạt
        // nhẹ từ nhiều phía, đủ để uốn vòng đồng tâm thành vân cẩm thạch trong ~10 giây.
        const huong = t * 0.09 + pha * 1.3;
        basin.splat(x, y, 22 * Math.cos(huong), 22 * Math.sin(huong), 0, 0.02);
      }
    }, 1100);

    return () => window.clearInterval(nhip);
  }, [dongChay]);

  /**
   * Mưa mực: MỘT giọt mỗi lần, chọn ngẫu nhiên trong `seeds`, lệch nhẹ khỏi chỗ cũ, và cách
   * nhau một khoảng ngẫu nhiên quanh `nhipGiot` giây.
   *
   * Bản trước dùng `setInterval` thả LẠI CẢ BỘ giọt cùng lúc, đúng chỗ cũ, đúng mỗi 9 giây.
   * Hai chỗ sai cộng lại: mặt nước đập theo một nhịp máy móc mà mắt bắt được sau ba lần lặp,
   * và mỗi chu kỳ vẽ lại y hệt chu kỳ trước. `setTimeout` tự hẹn lại thay cho `setInterval`
   * vì khoảng chờ đổi sau mỗi lần.
   *
   * Lượng mực mỗi giọt cũng dao động: mưa thật không có hai hạt bằng nhau.
   */
  useEffect(() => {
    if (nhipGiot <= 0) return;
    const giamChuyenDong = window.matchMedia("(prefers-reduced-motion: reduce)");
    let hen = 0;

    const roi = () => {
      const basin = basinRef.current;
      const goc = chonGiot(seedsRef.current);
      if (basin && goc && !document.hidden && !giamChuyenDong.matches) {
        const mau = seedsRef.current[0];
        const luong = (mau?.amount ?? 0.6) * (0.75 + Math.random() * 0.5);
        // 2–3 vòng: giọt thả lại nhỏ hơn giọt dựng chậu, để nó nong vân cũ ra chứ không xoá.
        thaVong(basin, giotRoi(goc.x, goc.y, luong, 2 + Math.round(Math.random()), undefined, undefined, Math.random));
      }
      hen = window.setTimeout(roi, nhipNgauNhien(nhipGiot));
    };

    hen = window.setTimeout(roi, nhipNgauNhien(nhipGiot));
    return () => window.clearTimeout(hen);
  }, [nhipGiot]);

  useEffect(() => {
    if (!interactive) return;
    const holder = holderRef.current;
    if (!holder) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let last: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const basin = basinRef.current;
      if (!basin) return;
      const p = toBasinCoords(e.clientX, e.clientY, holder.getBoundingClientRect());
      if (last) {
        // Lực đẩy tỉ lệ với quãng con trỏ đi được, nhân một hệ số đủ để khuấy được nước.
        // Không có nhân tử này thì rê chuột chỉ nhuộm màu chứ không tạo dòng chảy nào.
        basin.splat(p.x, p.y, (p.x - last.x) * 700, (p.y - last.y) * 700, 0, 0.004);
      }
      last = p;
    };
    const onLeave = () => {
      last = null;
    };

    holder.addEventListener("pointermove", onMove);
    holder.addEventListener("pointerleave", onLeave);
    return () => {
      holder.removeEventListener("pointermove", onMove);
      holder.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive]);

  return (
    <div ref={holderRef} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      {/* Chậu hỏng thì KHÔNG vẽ gì thay thế. Một cái nền giả-mực bằng gradient là đúng thứ
          DESIGN.md § Ink cấm, và nền `paper` trần vẫn là một mặt nước hợp lệ — nước trong. */}
      {!failed && (
        <canvas
          ref={canvasRef}
          className={`h-full w-full ${interactive ? "pointer-events-auto" : ""}`}
        />
      )}
    </div>
  );
}
