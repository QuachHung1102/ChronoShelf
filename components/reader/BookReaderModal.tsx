"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Room } from "@/components/Room";
import { findBook } from "@/lib/content/find";
import { completeBook, setCurrentPage } from "@/lib/api/shelf";
import type { ContentPage, ContentShelf } from "@/lib/content/types";
import type { CompleteBookResult } from "@/lib/api/types";
import { BookPage } from "./BookPage";
import { ItemDropOverlay } from "./ItemDropOverlay";
import s from "./reader.module.scss";

const ROUND_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition duration-200 ease-out hover:brightness-110 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-room";

/** Một mặt giấy trong sách. Bìa và trang trắng độn cũng là "mặt" — chúng chiếm chỗ thật. */
type Face =
  | { kind: "cover" }
  | { kind: "end" }
  | { kind: "blank" }
  | { kind: "page"; page: ContentPage; number: number };

/**
 * Xếp nội dung thành các mặt giấy theo đúng cách một quyển sách thật được đóng:
 * bìa trước, các trang nội dung, bìa sau. Số mặt phải chẵn vì mỗi TỜ giấy có hai mặt —
 * lẻ thì mặt cuối không có tờ để bám vào, nên độn thêm một trang trắng.
 */
function buildFaces(pages: ContentPage[]): Face[] {
  const faces: Face[] = [
    { kind: "cover" },
    ...pages.map((page, index): Face => ({ kind: "page", page, number: index + 1 })),
    { kind: "end" },
  ];
  if (faces.length % 2 === 1) faces.push({ kind: "blank" });
  return faces;
}

/**
 * Trang nội dung xa nhất người đọc đã nhìn thấy sau khi lật `flipped` tờ.
 * Tính trên toàn bộ các mặt tính từ đầu sách chứ không chỉ hai mặt đang mở, nhờ vậy nó
 * đơn điệu tăng — lật ngược lại không làm tiến độ tụt.
 */
function pagesSeen(faces: Face[], flipped: number): number {
  let max = 0;
  for (const face of faces.slice(0, 2 * flipped + 1)) {
    if (face.kind === "page") max = Math.max(max, face.number);
  }
  return max;
}

/** Khoảng cách giữa hai tờ giấy liền nhau, tính bằng px trên trục Z. */
const SHEET_GAP = 0.6;

/**
 * Vị trí 3D của tờ giấy thứ `i`.
 *
 * Hai chi tiết ở đây đều là bắt buộc, bỏ cái nào cũng hỏng theo một kiểu riêng:
 *
 * 1. **Tách theo trục Z.** `transform-style: preserve-3d` xếp lớp các phần tử theo vị trí
 *    trong không gian chứ không theo `z-index`. Mọi tờ giấy nằm đúng cùng một mặt phẳng thì
 *    trình duyệt không có căn cứ nào để chọn tờ nào ở trên — và nó chọn sai: trang 2 hiện
 *    xuyên qua bìa. Đẩy mỗi tờ lùi thêm 0.6px là đủ để thứ tự trở nên xác định.
 *
 * 2. **Luôn viết đủ `rotateY` rồi tới `translateZ`, kể cả khi góc bằng 0.** CSS chỉ nội suy
 *    được từng hàm một khi hai đầu có CÙNG danh sách hàm; lệch danh sách thì nó rơi về nội
 *    suy ma trận, và nội suy ma trận của một cú xoay 180° là suy biến — tờ giấy bẹp lại giữa
 *    chừng thay vì lật. Đây chính là kiểu "giật" mà bản dùng thư viện cũ mắc phải.
 */
function leafTransform(i: number, flipped: number): string {
  const isFlipped = i < flipped;
  // Tờ đã lật nằm ở chồng trái, tờ chưa lật nằm ở chồng phải; cả hai đều lùi dần ra xa
  // mặt trên cùng của chồng mình. Sau `rotateY(-180deg)` thì +Z chỉ ra xa người xem.
  const depth = isFlipped ? flipped - 1 - i : flipped - i;
  return `rotateY(${isFlipped ? -180 : 0}deg) translateZ(${depth * SHEET_GAP}px)`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function FaceContent({
  face,
  gutter,
  bookTitle,
}: {
  face: Face;
  gutter: "left" | "right";
  bookTitle: string;
}) {
  if (face.kind === "page") {
    return (
      <BookPage
        page={face.page}
        pageNumber={face.number}
        gutter={gutter}
        bookTitle={bookTitle}
      />
    );
  }
  return null;
}

export function BookReaderModal({
  shelf,
  bookSlug,
  startPage,
  onClose,
}: {
  shelf: ContentShelf;
  bookSlug: string;
  /** Trang nội dung đang đọc dở lấy từ tiến độ đã lưu (đánh số từ 1). */
  startPage: number;
  onClose: () => void;
}) {
  const book = findBook(shelf, bookSlug);
  if (!book) throw new Error(`Không có quyển "${bookSlug}" trong kệ "${shelf.slug}".`);
  const pageCount = book.pages.length;
  const faces = useMemo(() => buildFaces(book.pages), [book.pages]);
  const sheets = faces.length / 2;

  // Trang k nằm ở mặt số k, và cặp mặt (2f-1, 2f) là trang đôi đang mở → f = ceil(k/2).
  // Mới mở (hoặc mới tới trang 1) thì bắt đầu từ bìa để có hoạt cảnh mở sách.
  const [flipped, setFlipped] = useState(() =>
    startPage <= 1 ? 0 : Math.min(Math.ceil(startPage / 2), sheets),
  );
  // Tờ đang bay: nó phải nằm trên tất cả các tờ khác trong suốt cú lật. `z-index` không
  // nội suy được nên phải đặt lúc bắt đầu và gỡ ở `transitionend`.
  const [flying, setFlying] = useState<number | null>(null);
  const [result, setResult] = useState<CompleteBookResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chưa đăng nhập thì "Thử lại" chẳng sửa được gì — chỗ đó phải là lối sang trang đăng nhập.
  const [needsLogin, setNeedsLogin] = useState(false);

  const reduced = useReducedMotion();
  const currentPage = pagesSeen(faces, flipped);
  const atLastPage = currentPage >= pageCount;

  const flip = useCallback(
    (direction: "next" | "previous") => {
      const next = direction === "next" ? flipped + 1 : flipped - 1;
      if (next < 0 || next > sheets) return;
      // Tờ đang bay là tờ có chỉ số nhỏ hơn trong hai trạng thái — lật tới thì đó là tờ
      // vừa rời đi, lật lui thì là tờ vừa nằm xuống. Cả hai đều là `min`.
      // Giảm chuyển động thì không đánh dấu tờ nào đang bay: transition 0ms có thể không
      // phát `transitionend`, và khi đó `flying` sẽ kẹt lại vĩnh viễn ở tờ cuối cùng.
      if (!reduced) setFlying(Math.min(flipped, next));
      setFlipped(next);
    },
    [flipped, reduced, sheets],
  );

  // Tiến độ chỉ quyết định lần sau mở lại vào trang nào — hỏng thì vẫn đọc tiếp được.
  useEffect(() => {
    if (currentPage >= 1) void setCurrentPage(bookSlug, currentPage).catch(() => {});
  }, [bookSlug, currentPage]);

  // `showModal()` chứ không phải thuộc tính `open`: chỉ dạng modal mới đưa hộp thoại lên top
  // layer, bẫy focus bên trong, làm trơ phần nền và nhận Escape. Bản trước tự nghe Escape và
  // KHÔNG có bẫy focus — Tab vẫn đi ra sau lưng hộp thoại (bàn giao §3 mục 4).
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  // Đóng qua `close()` chứ không gọi thẳng `onClose`: mọi đường đóng (Escape, nút X, nút
  // "Quay lại kệ sách") phải đi qua cùng một chỗ, nếu không hộp thoại còn kẹt lại ở top layer.
  const close = useCallback(() => dialogRef.current?.close(), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (result) return;
      if (event.key === "ArrowRight") flip("next");
      if (event.key === "ArrowLeft") flip("previous");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flip, result]);

  // Không bọc useCallback: chỉ dùng trong onClick, và React Compiler tự lo phần ghi nhớ.
  async function finish() {
    setBusy(true);
    setError(null);
    setNeedsLogin(false);
    try {
      // RPC chỉ chốt hoàn thành khi current_page đã tới trang cuối — lưu trước rồi mới gọi,
      // nhờ vậy nút "Thử lại" sửa được cả trường hợp lần lưu trước rớt mạng.
      if (!(await setCurrentPage(bookSlug, pageCount))) {
        setNeedsLogin(true);
        setError("Bạn cần đăng nhập để lưu tiến độ và nhận vật phẩm.");
        return;
      }
      setResult(await completeBook(bookSlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không ghi nhận được kết quả đọc.");
    } finally {
      setBusy(false);
    }
  }

  // Sách đóng chỉ thấy nửa phải, đọc hết chỉ còn nửa trái — trượt cả quyển để nửa đang
  // thấy nằm giữa khung nhìn, và trượt cùng nhịp với trang lật.
  const shift = flipped === 0 ? "-25%" : flipped === sheets ? "25%" : "0%";
  const readRatio = flipped / sheets;
  // Bề rộng thật của `.edge` là 12px; ở đây trả về hệ số co, không phải số pixel.
  // Chồng giấy mỏng nhất vẫn dày 3px — một bên đã đọc hết vẫn còn giấy, chỉ bên chưa
  // có tờ nào mới thật sự biến mất.
  const edgeScale = (thick: number) => (thick <= 0 ? 0 : (3 + 9 * thick) / 12);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={`Đang đọc: ${book.title}`}
      className={s.dialog}
    >
      <Room className="flex h-full flex-col">
        <div className="flex items-center justify-between px-page-margin py-md">
          <p className="font-heading text-headline-sm text-on-primary">{book.title}</p>
          <button type="button" onClick={close} aria-label="Đóng sách" className={ROUND_BUTTON}>
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="flex flex-1 items-center justify-center">
            <ItemDropOverlay result={result} shelf={shelf} onClose={close} />
          </div>
        ) : (
          // Sách và ruy băng tiến độ là MỘT khối căn giữa. Trước đây ruy băng bị ghim đáy
          // màn hình, cách quyển sách cả trăm pixel, nên nó đọc ra như thanh trạng thái
          // của trình duyệt chứ không phải số trang của quyển sách đang cầm.
          <div className="flex flex-1 flex-col items-center justify-center gap-lg">
            <div className="flex items-center gap-lg">
              <button
                type="button"
                onClick={() => flip("previous")}
                disabled={flipped <= 0}
                aria-label="Trang trước"
                className={ROUND_BUTTON}
              >
                <ChevronLeft aria-hidden className="h-6 w-6" />
              </button>

              {/* Tắt chuyển động ở đúng một chỗ: `--flip-duration` chi phối cả cú xoay của
                  tờ giấy, cú trượt căn giữa của cả quyển, lẫn bề dày khối giấy. Tắt lẻ từng
                  cái thì sót — bản trước sót đúng cú trượt 230px của cả quyển.
                  Trạng thái cuối giống hệt hai chế độ (DESIGN.md § Motion). */}
              <div
                className={s.stage}
                style={reduced ? ({ "--flip-duration": "0ms" } as CSSProperties) : undefined}
              >
                <div aria-hidden className={s.bookShadow} />
                <div className={s.book} style={{ transform: `translateX(${shift})` }}>
                  <div
                    aria-hidden
                    className={`${s.edge} ${s.edgeLeft}`}
                    style={{ transform: `scaleX(${edgeScale(readRatio)})` }}
                  />
                  <div
                    aria-hidden
                    className={`${s.edge} ${s.edgeRight}`}
                    style={{ transform: `scaleX(${edgeScale(1 - readRatio)})` }}
                  />

                  {Array.from({ length: sheets }, (_, i) => {
                    const front = faces[2 * i];
                    const back = faces[2 * i + 1];
                    const isFlipped = i < flipped;
                    return (
                      <div
                        key={i}
                        className={`${s.leaf} ${i === flying ? s.turning : ""}`}
                        style={{
                          zIndex: i === flying ? sheets + 2 : isFlipped ? i + 1 : sheets - i,
                          transform: leafTransform(i, flipped),
                        }}
                        onTransitionEnd={(event) => {
                          if (event.target === event.currentTarget) setFlying(null);
                        }}
                      >
                        <div
                          className={`${s.face} ${s.front} ${
                            front.kind === "page" ? "" : s.hardCover
                          }`}
                        >
                          {front.kind === "cover" ? (
                            <CoverFace title={book.title} era={book.era} />
                          ) : front.kind === "end" ? (
                            <EndFace />
                          ) : (
                            <FaceContent face={front} gutter="left" bookTitle={book.title} />
                          )}
                        </div>
                        <div
                          className={`${s.face} ${s.back} ${
                            back.kind === "page" ? "" : s.hardCover
                          }`}
                        >
                          {back.kind === "end" ? (
                            <EndFace />
                          ) : (
                            <FaceContent face={back} gutter="right" bookTitle={book.title} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => flip("next")}
                disabled={flipped >= sheets}
                aria-label="Trang sau"
                className={ROUND_BUTTON}
              >
                <ChevronRight aria-hidden className="h-6 w-6" />
              </button>
            </div>

            <div className="flex items-center gap-md">
              <p
                aria-live="polite"
                className="rounded-full bg-tertiary-deep px-md py-sm font-body text-label-md text-on-primary"
              >
                {currentPage === 0 ? "Bìa sách" : `Trang ${currentPage}/${pageCount}`}
              </p>

              {atLastPage && (
                <button
                  type="button"
                  onClick={finish}
                  disabled={busy}
                  className="rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-room"
                >
                  {busy ? "Đang ghi nhận…" : "Đọc xong — nhận vật phẩm"}
                </button>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-md rounded-md bg-destructive p-md font-body text-body-sm text-on-destructive"
              >
                {error}
                {needsLogin ? (
                  <Link
                    href={`/dang-nhap?next=${encodeURIComponent(`/${shelf.slug}`)}`}
                    className="shrink-0 rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-destructive"
                  >
                    Đăng nhập
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      void finish();
                    }}
                    disabled={busy}
                    className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-destructive"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Room>
    </dialog>
  );
}

function CoverFace({ title, era }: { title: string; era: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-xl text-center">
      <p className="font-body text-label-caps uppercase text-tertiary-light">Cửa sổ lịch sử</p>
      <p className="mt-md font-heading text-headline-md text-on-primary">{title}</p>
      <span aria-hidden className={s.coverRule} />
      <p className="font-body text-body-md text-secondary-light">{era}</p>
    </div>
  );
}

function EndFace() {
  return (
    <div className="flex h-full w-full items-center justify-center p-xl text-center">
      <p className="font-heading text-headline-sm text-on-primary">Hết</p>
    </div>
  );
}
