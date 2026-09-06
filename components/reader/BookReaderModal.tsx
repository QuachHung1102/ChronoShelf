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
import { QuizPanel } from "./QuizPanel";
import s from "./reader.module.scss";

const ROUND_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition duration-200 ease-out hover:brightness-110 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-room";

/**
 * Hành động chính của màn hình đọc — và trên mỗi trạng thái chỉ có ĐÚNG MỘT cái mang hình
 * này (DESIGN.md § Overview). Viên thuốc cam `tertiary-deep` là ngôn ngữ nút bấm của cả
 * app; thứ gì chỉ mang thông tin thì không được mượn nó, nếu không học sinh phải thử mới
 * biết cái nào bấm được.
 */
const PILL_BUTTON =
  "rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface-room";

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
  daHoanThanh,
  onClose,
}: {
  shelf: ContentShelf;
  bookSlug: string;
  /** Trang nội dung đang đọc dở lấy từ tiến độ đã lưu (đánh số từ 1). */
  startPage: number;
  /** Quyển này đã hoàn thành trước đó — bỏ qua bài kiểm tra, xem chú thích ở nơi truyền vào. */
  daHoanThanh: boolean;
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
  // Bài kiểm tra cuối sách (content.md §4.3). Quyển không có câu hỏi, hoặc quyển đã hoàn
  // thành từ trước, thì không bao giờ mở màn này — `complete_book` cũng bỏ qua phần chấm
  // bài trong cả hai trường hợp đó, nên giao diện và máy chủ nói cùng một chuyện.
  const coBaiKiemTra = book.cauHoi.length > 0 && !daHoanThanh;
  const [quizOpen, setQuizOpen] = useState(false);
  const [wrongPositions, setWrongPositions] = useState<number[]>([]);
  // Bài làm sống ở ĐÂY chứ không trong `QuizPanel`: bấm "Quay lại đọc" tháo panel khỏi
  // cây, nên state nằm trong panel là mỗi lần quay lại đọc lại mất sạch đáp án — kể cả
  // những câu đã trả lời đúng, và đúng vào lúc sản phẩm vừa khuyên học sinh đi đọc lại.
  const [answers, setAnswers] = useState<number[]>(() => book.cauHoi.map(() => -1));
  // Bản chụp `answers` ở lần nộp gần nhất, để `QuizPanel` biết dấu "chưa đúng" nào còn
  // nói về câu trả lời hiện tại và dấu nào đã cũ.
  const [daNop, setDaNop] = useState<number[]>([]);

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

  // Cú đóng mềm 240ms dựng ở reader.module.scss § Khung modal trước đây KHÔNG BAO GIỜ chạy:
  // sự kiện `close` của `<dialog>` là sự kiện rời rạc nên React xả state đồng bộ, component
  // bị tháo khỏi cây ngay trong cùng một task và thẻ `<dialog>` biến mất khỏi DOM trước khi
  // transition kịp một khung hình. Nên phải tự giữ mình sống hết cú đóng rồi mới báo lên
  // trên. Hệ quả có chủ ý: `refresh()` ở màn kệ sách chạy chậm hơn 240ms, nhờ vậy hoạt cảnh
  // bung đai sắt của quyển vừa mở khóa diễn ra trên một cái kệ đã nhìn thấy được —
  // DESIGN.md § Motion đòi chuỗi ba chặng TUẦN TỰ, không chồng lên nhau.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishClosing = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    onClose();
  }, [onClose]);
  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // `quizOpen` cũng phải chặn: hai phím mũi tên là cách di chuyển giữa các lựa chọn
      // trong một nhóm radio, nên để nguyên thì mỗi lần học sinh đổi đáp án bằng bàn phím
      // là quyển sách phía sau lật thêm một trang.
      if (result || quizOpen) return;
      if (event.key === "ArrowRight") flip("next");
      if (event.key === "ArrowLeft") flip("previous");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flip, result, quizOpen]);

  // Không bọc useCallback: chỉ dùng trong onClick, và React Compiler tự lo phần ghi nhớ.
  //
  // `answers` song song với `book.cauHoi`; mảng rỗng khi quyển không có bài kiểm tra.
  // Máy chủ chấm, không phải chỗ này — đáp án chưa từng rời khỏi database.
  async function finish() {
    setBusy(true);
    setError(null);
    setNeedsLogin(false);
    // Chụp lại bài làm VÀ xóa dấu sai cũ ngay tại đây. Không xóa thì trong lúc chờ máy chủ
    // trả lời, `daNop` đã bằng `answers` nên MỌI câu trong `wrongPositions` cũ lại thỏa
    // điều kiện đánh dấu — hai câu học sinh vừa sửa đúng nhấp nháy đỏ trở lại suốt một
    // vòng round-trip rồi mới tắt.
    setDaNop(answers);
    setWrongPositions([]);
    try {
      // RPC chỉ chốt hoàn thành khi current_page đã tới trang cuối — lưu trước rồi mới gọi,
      // nhờ vậy nút "Thử lại" sửa được cả trường hợp lần lưu trước rớt mạng.
      if (!(await setCurrentPage(bookSlug, pageCount))) {
        setNeedsLogin(true);
        setError("Bạn cần đăng nhập để lưu tiến độ và nhận vật phẩm.");
        // Đóng bài kiểm tra lại: lối sang trang đăng nhập nằm ở khối lỗi của màn đọc,
        // và làm xong bài cũng vô ích khi chưa có tài khoản để ghi kết quả vào.
        setQuizOpen(false);
        return;
      }
      const res = await completeBook(bookSlug, answers);
      if (!res.quizPassed) {
        // Ở lại màn bài kiểm tra: `QuizPanel` đánh dấu đúng những câu sai và giữ nguyên
        // các câu đã trả lời đúng. Không đặt `result` — chưa có vật phẩm nào rơi ra.
        setWrongPositions(res.wrongPositions);
        // MỞ bài kiểm tra dù đường nào dẫn tới đây. `daHoanThanh` đến từ `/api/me/state`
        // và có thể cũ hơn sự thật (đọc xong ở một tab khác rồi quay lại tab này); lúc đó
        // nút hiện "nhận vật phẩm", máy chủ vẫn chấm bài, và thiếu dòng này thì học sinh
        // rơi vào ngõ cụt câm — không vật phẩm, không màn nào giải thích.
        setQuizOpen(true);
        return;
      }
      setResult(res);
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
      onClose={() => {
        // Giảm chuyển động thì không có transition nào để chờ — đóng ngay, và trạng thái
        // cuối giống hệt chế độ kia (DESIGN.md § Motion).
        if (reduced) {
          finishClosing();
          return;
        }
        // Lưới an toàn: transition bị hủy giữa chừng (đổi tab, trình duyệt bỏ qua) thì
        // `transitionend` không bao giờ tới, và hộp thoại sẽ treo lại vĩnh viễn.
        closeTimer.current = setTimeout(finishClosing, 400);
      }}
      onTransitionEnd={(event) => {
        // Chỉ nghe transition của CHÍNH hộp thoại: cú lật trang ở `.leaf` cũng nổi bọt lên
        // tới đây. Lọc `opacity` để bỏ qua `scale` và hai transition rời rạc
        // `display`/`overlay`; lọc `open` để bỏ qua cú mở.
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity" &&
          dialogRef.current?.open === false
        ) {
          finishClosing();
        }
      }}
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
            <ItemDropOverlay result={result} shelf={shelf} book={book} onClose={close} />
          </div>
        ) : quizOpen ? (
          // Bài kiểm tra THAY CHỖ quyển sách chứ không phủ lên trên: nó là trang cuối
          // cùng của quyển, và một lớp phủ nữa bên trong một `<dialog>` đã modal sẵn chỉ
          // đẻ thêm một tầng bẫy focus không ai cần.
          <QuizPanel
            cauHoi={book.cauHoi}
            answers={answers}
            daNop={daNop}
            wrongPositions={wrongPositions}
            busy={busy}
            error={error}
            onChon={(i, choice) =>
              setAnswers((cu) => cu.map((v, k) => (k === i ? choice : v)))
            }
            onSubmit={() => void finish()}
            onBack={() => setQuizOpen(false)}
          />
        ) : (
          // Sách và ruy băng tiến độ là MỘT khối căn giữa. Trước đây ruy băng bị ghim đáy
          // màn hình, cách quyển sách cả trăm pixel, nên nó đọc ra như thanh trạng thái
          // của trình duyệt chứ không phải số trang của quyển sách đang cầm.
          <div className="flex flex-1 flex-col items-center justify-center gap-lg">
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
                          <CoverFace
                            title={book.title}
                            era={book.era}
                            anhBia={book.cover}
                            credit={book.coverCredit}
                            nguon={book.coverSource}
                            // Chỉ trao lối bấm khi bìa đang THẬT SỰ là mặt đang nhìn. Mọi tờ
                            // giấy đều được render sẵn, mà `backface-visibility: hidden` chỉ
                            // chặn VẼ chứ không chặn focus — một nút để lại đây sẽ vẫn bắt
                            // được Tab sau khi người đọc đã lật qua bìa.
                            onOpen={flipped === 0 ? () => flip("next") : undefined}
                          />
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

            {/* Hai mũi tên lật trang nằm ở HÀNG NÀY chứ không kẹp hai bên quyển sách — lý do
                và số đo ghi ở `.controls` trong reader.module.scss. Hàng rộng đúng bằng trang
                đôi nên hai mũi tên vẫn thẳng hàng với hai mép sách, và vì hai nút bằng nhau
                nên `justify-between` giữ cụm ở giữa nằm đúng tâm. */}
            <div className={`${s.controls} flex items-center justify-between gap-lg`}>
              <button
                type="button"
                onClick={() => flip("previous")}
                disabled={flipped <= 0}
                aria-label="Trang trước"
                className={ROUND_BUTTON}
              >
                <ChevronLeft aria-hidden className="h-6 w-6" />
              </button>

              <div className="flex items-center gap-md">
                {/* Số trang là THÔNG TIN, không phải hành động. Trước đây nó mang đúng hình
                    viên thuốc cam của nút chính, nên ở trang cuối có hai vật giống hệt nhau
                    đứng cạnh nhau mà chỉ một cái bấm được — DESIGN.md § Overview đòi mỗi màn
                    hình chỉ có MỘT hành động chính rõ ràng. Hạ xuống đúng cặp `room-caption`
                    đã khai trong DESIGN.md (`secondary-light` trên nền phòng, 11.57:1).
                    Vùng `aria-live` phải LUÔN có mặt: tháo ra rồi gắn lại thì trình đọc màn
                    hình coi đó là vùng vừa được THÊM chứ không phải một thay đổi. */}
                <p aria-live="polite" className="font-body text-caption text-secondary-light">
                  {currentPage === 0 ? "Bìa sách" : `Trang ${currentPage}/${pageCount}`}
                </p>

                {/* Đúng MỘT nút chính và luôn ở cùng một chỗ: mở sách ở bìa, nhận vật phẩm ở
                    trang cuối, không có gì ở giữa. Viết dạng if/else chứ không phải hai điều
                    kiện rời — một quyển rỗng (0 trang) thỏa cả hai. Hai `key` khác nhau để
                    React tháo nút ra dựng lại thay vì tái dùng một phần tử cho hai vai. */}
                {flipped === 0 ? (
                  <button
                    key="mo-sach"
                    type="button"
                    onClick={() => flip("next")}
                    className={PILL_BUTTON}
                  >
                    Mở sách
                  </button>
                ) : atLastPage ? (
                  // Nhãn nói ĐÚNG chuyện sắp xảy ra: hứa "nhận vật phẩm" rồi mở ra một bài
                  // kiểm tra là đúng loại bất ngờ làm người dùng mất tin vào nút bấm.
                  <button
                    key="doc-xong"
                    type="button"
                    onClick={coBaiKiemTra ? () => setQuizOpen(true) : () => void finish()}
                    disabled={busy}
                    className={PILL_BUTTON}
                  >
                    {busy
                      ? "Đang ghi nhận…"
                      : coBaiKiemTra
                        ? "Đọc xong — làm bài kiểm tra"
                        : "Đọc xong — nhận vật phẩm"}
                  </button>
                ) : null}
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
                      // Khối lỗi này chỉ hiện ở màn ĐỌC, tức bài kiểm tra đang đóng. Với
                      // quyển CÓ bài kiểm tra, "thử lại" phải là mở lại bài — nộp thẳng
                      // mảng rỗng thì máy chủ chấm trượt và học sinh không thấy màn nào
                      // giải thích vì sao.
                      if (coBaiKiemTra) setQuizOpen(true);
                      else void finish();
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

function CoverFace({
  title,
  era,
  anhBia,
  credit,
  nguon,
  onOpen,
}: {
  title: string;
  era: string;
  anhBia: string | null;
  credit: string | null;
  nguon: string | null;
  /** Có giá trị thì mặt bìa bấm được để mở sách. `undefined` khi bìa đã bị lật qua. */
  onOpen?: () => void;
}) {
  return (
    <div className="relative flex h-full w-full flex-col items-center p-xl text-center">
      {anhBia && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh trong bảng media */}
          <img src={anhBia} alt="" className={s.coverArt} />
          {/* Lớp phủ đục — thứ THẬT SỰ bảo đảm chữ sáng đọc được trên một tấm bìa bất kỳ do
              admin tải lên. `brightness()` một mình không làm nổi việc đó; số đo ở
              `.coverArt` trong reader.module.scss. */}
          <span aria-hidden className={s.coverScrim} />
        </>
      )}

      {/* Khối chữ đặt ở khoảng phần ba trên theo lối bìa sách in, bằng hai ô co giãn tỉ lệ
          2:3 — không có kích thước cứng nào nên nó đúng ở mọi chiều cao bìa. Trước đây khối
          này căn giữa dọc, chiếm 5,4% diện tích bìa, nên tấm bìa 490×580 đọc ra là một khối
          gỗ trống có một hòn đảo chữ lơ lửng giữa. */}
      <span aria-hidden className="flex-[2]" />

      <p className="relative font-body text-label-caps uppercase text-tertiary-light">
        Cửa sổ lịch sử
      </p>
      {/* `headline-xl` 48px — DESIGN.md § Typography dựng bậc đỉnh này cho đúng chỗ này:
          "bìa chiếm gần trọn khung nhìn nhưng tên sách trước đây chỉ 24px". */}
      <p className="relative mt-md font-heading text-headline-xl text-on-primary">{title}</p>
      <span aria-hidden className={s.coverRule} />
      <p className="relative font-body text-body-md text-secondary-light">{era}</p>

      <span aria-hidden className="flex-[3]" />

      {/* Ghi công ảnh bìa. Trên kệ thì bìa sách quá nhỏ để chứa dòng này, nên đây là chỗ
          đầu tiên đủ rộng mà người đọc chắc chắn đi qua — mở sách ra là thấy. Điều kiện BY
          của giấy phép đòi ghi công ở nơi nhìn được, không đòi ghi ngay cạnh mọi lần ảnh
          xuất hiện. */}
      {anhBia && credit && (
        <p className="absolute inset-x-xl bottom-lg font-body text-caption text-secondary-light">
          Ảnh bìa: {credit}
          {nguon && <> — Nguồn: {nguon}</>}
        </p>
      )}

      {/* Bấm thẳng vào bìa để mở sách — phản xạ đầu tiên khi thấy một quyển sách đóng nằm
          giữa màn hình. Là một nút TRONG SUỐT phủ lên mặt bìa chứ không phải bọc khối chữ
          vào `<button>`: nội dung của `<button>` phải là phrasing content, mà ở đây là mấy
          thẻ `<p>`. Vòng focus vẽ vào phía trong (`ring-inset`) vì `.face` có
          `overflow: hidden` sẽ cắt mất vòng vẽ ra ngoài. `.face::before` (rãnh gáy) đã có
          `pointer-events: none` nên không chặn cú bấm này. */}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Mở sách: ${title}`}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-on-dark"
        />
      )}
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
