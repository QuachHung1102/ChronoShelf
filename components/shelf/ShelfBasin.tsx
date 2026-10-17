"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Droplet } from "lucide-react";
import { InkBasin, type PigmentName, type Seed } from "@/components/ink/InkBasin";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import { FOCUS_RING } from "@/components/ui/controls";
import type { InkBasin as Basin } from "@/lib/ink/fluid";
import { giotRoi, viTriGiot } from "@/lib/ink/giot";
import type { BookView, ShelfView } from "@/lib/api/types";
import s from "./ShelfBasin.module.scss";

/** Sắc tố của kệ, suy từ vị trí kệ trong danh sách — khớp với chấm màu ở rail. */
const PIGMENTS: PigmentName[] = ["cham", "son", "sumi"];

export function ShelfBasin({
  shelf,
  pigmentIndex = 0,
  onOpenBook,
  justUnlockedSlugs,
}: {
  shelf: ShelfView;
  pigmentIndex?: number;
  onOpenBook: (bookSlug: string) => void;
  justUnlockedSlugs?: Set<string>;
}) {
  const tong = shelf.books.length;
  const daDoc = shelf.books.filter((b) => b.state === "completed").length;
  const daMo = shelf.books.filter((b) => b.state !== "locked").length;
  const nextBook = shelf.books.find((b) => b.state === "unlocked") ?? null;
  const nextIndex = nextBook ? shelf.books.indexOf(nextBook) : -1;

  const basinRef = useRef<Basin | null>(null);
  const canhRef = useRef<HTMLDivElement | null>(null);
  const boRef = useRef<HTMLDivElement | null>(null);

  /**
   * Phần bề ngang bị bờ che, đo THẬT chứ không suy từ hằng số CSS.
   *
   * Bờ rộng `max(516px, 56%)`, nên tỉ lệ của nó đổi theo khung nhìn: 0.65 ở 1024px và 0.56
   * ở 1440px. Chép con số vào TypeScript là dựng một nguồn sự thật thứ hai cho cùng một bố
   * cục, và nó sẽ trôi lệch ngay lần ai đó sửa CSS.
   *
   * Giá trị khởi tạo 0.56 chỉ dùng cho lượt render đầu trước khi đo xong; `ResizeObserver`
   * sửa lại ngay trong khung hình kế.
   */
  const [boRatio, setBoRatio] = useState(0.56);

  useEffect(() => {
    const canh = canhRef.current;
    const bo = boRef.current;
    if (!canh || !bo) return;
    const doLai = () => {
      const w = canh.offsetWidth;
      if (w > 0) setBoRatio(bo.offsetWidth / w);
    };
    doLai();
    const ro = new ResizeObserver(doLai);
    ro.observe(canh);
    ro.observe(bo);
    return () => ro.disconnect();
  }, []);

  /**
   * Mực đã loang = số bài ĐÃ ĐỌC XONG. Chậu vì thế không phải hình nền: nó là thước tiến độ
   * của kệ, đọc được từ bên kia phòng. Kệ chưa học gì thì mặt nước còn trong — đúng nghĩa
   * đen của "chưa chạm tới".
   */
  const seeds: Seed[] = shelf.books
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.state === "completed")
    .map(({ i }) => {
      const p = viTriGiot(i, boRatio, tong);
      // Giọt rơi theo trục **Oz** — vuông góc với màn hình — nên nó chạm mặt nước ĐÚNG
      // tại chỗ của mình rồi loang tròn ra; `InkBasin` lo phần loang qua `giotRoi`.
      // Không còn `dx`/`dy`: mọi vector đẩy ở đây đều làm giọt bay lệch một phía, và đó
      // chính là thứ người dùng đọc ra là 'con mực bắn mực'.
      return { x: p.x, y: p.y, dx: 0, dy: 0, amount: 2.4 };
    });

  const onReady = useCallback((basin: Basin | null) => {
    basinRef.current = basin;
  }, []);

  /**
   * Giọt mới nhất — bài nên đọc tiếp — là thứ DUY NHẤT còn chuyển động trên màn hình
   * (DESIGN.md § Ink, § Motion). Nhịp 2.6s đủ chậm để không cướp sự chú ý khỏi việc đọc,
   * đủ đều để mắt nhận ra "chỗ này đang sống".
   */
  useEffect(() => {
    if (nextIndex < 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const p = viTriGiot(nextIndex, boRatio, tong);
    // Cũng là một giọt RƠI như mọi giọt khác, chỉ nhỏ hơn và đều nhịp hơn — nó là thứ duy
    // nhất còn chuyển động có chủ ý trên màn.
    const nho = () => {
      const basin = basinRef.current;
      if (!basin) return;
      for (const cu of giotRoi(p.x, p.y, 1.1, 120)) {
        basin.splat(cu.x, cu.y, cu.dx, cu.dy, cu.amount, cu.radius);
      }
    };

    // Nhịp đầu tiên hơi trễ: để những giọt "đã đọc" kịp nở ra trước, nếu không thì khung
    // hình đầu tiên có tất cả các giọt cùng bung một lúc và không giọt nào là "mới nhất".
    const mo = window.setTimeout(nho, 700);
    const nhip = window.setInterval(nho, 2600);
    return () => {
      window.clearTimeout(mo);
      window.clearInterval(nhip);
    };
  }, [nextIndex, boRatio, tong]);

  /** Rê chuột lên một bài học ở bờ trái → thả đúng giọt của nó trong chậu bên phải. */
  const chamVao = useCallback(
    (i: number) => {
      const basin = basinRef.current;
      if (!basin) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const p = viTriGiot(i, boRatio, tong);
      for (const cu of giotRoi(p.x, p.y, 0.9, 200)) {
        basin.splat(cu.x, cu.y, cu.dx, cu.dy, cu.amount, cu.radius);
      }
    },
    [boRatio, tong],
  );

  return (
    <div ref={canhRef} className={s.canh}>
      {/* BỜ — mọi chữ sống ở đây, và không một chữ nào đi qua mặt nước (DESIGN.md § Ink). */}
      <div ref={boRef} className={s.bo}>
        <div className="flex min-h-0 flex-1 flex-col justify-center px-page-margin py-2xl">
          <p className="font-ui text-label-caps uppercase text-ink-dilute">Kệ sách</p>
          <h1 className="mt-md font-ui text-display-lg text-primary">{shelf.name}</h1>

          {shelf.blurb && (
            <p className="mt-md max-w-measure font-ui text-body-md text-ink-dilute">
              {shelf.blurb}
            </p>
          )}

          {/* Thước tiến độ bằng CHỮ và bằng MỰC, không bằng một thanh bar: chậu bên phải đã
              là thước rồi, nên thêm một thanh nữa là nói hai lần cùng một điều. Con số ở đây
              là thứ chậu không nói chính xác được. */}
          <div className="mt-xl flex items-baseline gap-lg border-t border-mist pt-md">
            <ChiSo nhan="Đã đọc" gia={`${daDoc}/${tong}`} />
            <ChiSo nhan="Đã mở" gia={`${daMo}/${tong}`} />
          </div>

          <ol className={s.danhSach}>
            {shelf.books.map((view, i) => (
              <DongBaiHoc
                key={view.book.slug}
                view={view}
                index={i}
                isNext={i === nextIndex}
                justUnlocked={justUnlockedSlugs?.has(view.book.slug) ?? false}
                onOpen={onOpenBook}
                onHover={chamVao}
              />
            ))}
          </ol>

          {tong === 0 && (
            <p className="mt-lg font-ui text-body-md text-ink-dilute">
              Kệ này chưa có bài học nào.
            </p>
          )}

          {shelf.cover && (
            <GhiCongAnh
              nhan="Ảnh bìa kệ"
              credit={shelf.coverCredit}
              nguon={shelf.coverSource}
              className="mt-lg text-ink-dilute"
            />
          )}
        </div>
      </div>

      {/* CHẬU — nửa phải, tràn hết chiều cao. Mép trái tan dần vào bờ bằng mask, vì một cái
          chậu thật không có cạnh cắt thẳng đứng. */}
      <div className={s.chau}>
        <InkBasin
          pigment={PIGMENTS[pigmentIndex % PIGMENTS.length]}
          seeds={seeds}
          // Mỗi quyển ĐÃ ĐỌC XONG được thả lại khoảng 9 giây một lần, nên nhịp tổng là
          // 9 chia cho số quyển: kệ đọc nhiều thì mưa mực dày hơn, và lượng mực trên mặt
          // nước giữ đúng tỉ lệ với tiến độ. Đặt một hằng số chung ở đây sẽ làm kệ 1 bài và
          // kệ 6 bài đậm như nhau — tức chậu thôi làm thước đo.
          // Không phải trang trí: mực tan dần (`dyeDissipation`) nên thiếu nhịp này thì
          // lượng mực trên mặt nước nhạt đi theo thời gian người dùng ngồi nhìn — tức thước
          // tiến độ của kệ tự tụt xuống trong khi chẳng có gì thay đổi. Chọn ngẫu nhiên
          // TRONG danh sách chứ không random toạ độ: mỗi giọt vẫn là chỗ của một quyển.
          nhipGiot={seeds.length > 0 ? 9 / seeds.length : 0}
          interactive
          onReady={onReady}
        />
      </div>
    </div>
  );
}

function ChiSo({ nhan, gia }: { nhan: string; gia: string }) {
  return (
    <span>
      <span className="block font-ui text-label-caps uppercase text-ink-dilute">{nhan}</span>
      <span className="mt-xs block font-ui text-display-md tabular-nums text-primary">{gia}</span>
    </span>
  );
}

function DongBaiHoc({
  view,
  index,
  isNext,
  justUnlocked,
  onOpen,
  onHover,
}: {
  view: BookView;
  index: number;
  /** Bài nên đọc tiếp — thứ DUY NHẤT trên màn hình còn chuyển động. */
  isNext: boolean;
  /** Vừa mở khóa trong lượt làm mới vừa rồi: mực của nó chảy vào một nhịp. */
  justUnlocked: boolean;
  onOpen: (slug: string) => void;
  onHover: (index: number) => void;
}) {
  const { book, state, requiredItem } = view;
  const isLocked = state === "locked";
  const isCompleted = state === "completed";
  const isDraft = !book.published;

  // Trạng thái viết THẲNG ra hàng, không giấu trong tooltip: một gợi ý chỉ hiện khi hover
  // là một gợi ý chỉ tồn tại với người đang cầm chuột.
  const trangThai = isLocked
    ? requiredItem
      ? `Cần ${requiredItem.name} để mở`
      : "Chưa mở khóa"
    : isCompleted
      ? "Đã đọc xong"
      : isNext
        ? "Đọc tiếp"
        : "Sẵn sàng để đọc";

  const nhan = [book.title, book.era, isDraft ? "bản nháp, học sinh chưa nhìn thấy" : null, trangThai]
    .filter(Boolean)
    .join(" — ");

  useEffect(() => {
    if (justUnlocked) onHover(index);
  }, [justUnlocked, index, onHover]);

  return (
    <li>
      <button
        type="button"
        // Bài đang khóa vẫn nhận được focus bàn phím: nó mang thông tin ("cần vật phẩm nào"),
        // nên bỏ khỏi thứ tự Tab là lấy mất thông tin đó. `disabled` sẽ lấy mất focus.
        aria-disabled={isLocked || undefined}
        aria-label={nhan}
        onClick={isLocked ? undefined : () => onOpen(book.slug)}
        onPointerEnter={() => onHover(index)}
        onFocus={() => onHover(index)}
        className={`${s.dong} ${FOCUS_RING} ${isLocked ? s.dongKhoa : ""} ${
          isNext ? s.dongTiep : ""
        }`}
      >
        {/* Số hiệu là NHÃN KỸ THUẬT, đúng giọng của bảng điều khiển một chậu mực: hai chữ số,
            chữ nhỏ giãn, không phải một huy hiệu. */}
        <span aria-hidden className={s.soHieu}>
          {String(index + 1).padStart(2, "0")}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-sm">
            <span className={`truncate font-ui text-title-md ${isLocked ? "text-ink-dilute" : "text-primary"}`}>
              {book.title}
            </span>
            {isDraft && (
              // `ink-dilute` trên `mist` chỉ 4.03:1 — đo trong trình duyệt 2026-09-10, dưới
              // ngưỡng AA 4.5:1 cho chữ 12px. `primary` trên cùng nền cho 12.3:1.
              <span className="shrink-0 rounded-sm bg-mist px-xs font-ui text-label-caps uppercase text-primary">
                Nháp
              </span>
            )}
          </span>
          <span className="mt-xs flex items-center gap-sm font-ui text-body-sm text-ink-dilute">
            <span className="truncate">{book.era}</span>
            <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-feathered" />
            <span className="truncate">{trangThai}</span>
          </span>
        </span>

        <span className="flex shrink-0 items-center">
          {isCompleted ? (
            // Triện son — hình VUÔNG bo 2px, không phải tròn: triện Á Đông là con dấu vuông.
            <span aria-hidden className={s.trien}>
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          ) : isLocked ? (
            // `ink-dilute`, không `feathered`. Giọt này là tín hiệu ĐỒ HỌA duy nhất phân
            // biệt quyển chưa mở với quyển đang đọc dở, nên nó phải qua ngưỡng 3:1 của
            // WCAG 1.4.11 — đo 2026-09-10: `feathered` trên `paper` chỉ 1.91:1, đúng cặp
            // mà DESIGN.md § Do's and Don'ts cấm cho thứ mang thông tin.
            <Droplet aria-hidden className="h-4 w-4 text-ink-dilute" strokeWidth={1.5} />
          ) : (
            <ArrowRight
              aria-hidden
              className={`h-4 w-4 ${isNext ? "text-primary" : "text-ink-dilute"}`}
              strokeWidth={1.75}
            />
          )}
        </span>
      </button>
    </li>
  );
}
