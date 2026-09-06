"use client";

import { useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2 } from "lucide-react";
import type { ContentQuestion } from "@/lib/content/types";

/**
 * Bài kiểm tra cuối sách (content.md §4.3): trả lời đúng hết mới nhận được vật phẩm.
 *
 * VÌ SAO NÓ TỒN TẠI: không có nó, "đọc xong" chỉ có nghĩa là đã bấm hết số lần lật
 * trang. Bài kiểm tra biến chuỗi mở khóa thành phần thưởng cho việc HIỂU BÀI thay vì
 * cho việc lướt qua bài — đúng câu chữ của content.md.
 *
 * NÓ KHÔNG PHẢI HÀNG RÀO BẢO MẬT và đừng bao giờ trình bày nó như vậy: nội dung sách
 * công khai, số câu ít, đáp án đoán được bằng cách thử. Thứ nó thật sự bảo đảm là học
 * sinh phải quay lại trang sách trước khi đi tiếp. Chấm bài vẫn nằm ở máy chủ, nhưng vì
 * một lý do khác — đáp án không được có mặt trong HTML để dán vào là xong.
 *
 * Tấm giấy da `bg-surface` chứ không phải một panel tối: bài kiểm tra là TRANG CUỐI của
 * quyển sách, không phải một hộp thoại chen ngang. Nhờ vậy nó dùng lại đúng cặp màu của
 * thân trang sách và không phải phát minh thêm cặp nào cho `design:lint` phải gác.
 */
export function QuizPanel({
  cauHoi,
  wrongPositions,
  busy,
  error,
  onSubmit,
  onBack,
}: {
  cauHoi: ContentQuestion[];
  /** Vị trí (đánh số từ 1) các câu máy chủ vừa chấm là sai. */
  wrongPositions: number[];
  busy: boolean;
  error: string | null;
  onSubmit: (answers: number[]) => void;
  onBack: () => void;
}) {
  // `-1` = chưa chọn. Máy chủ coi mọi thứ khác đáp án đúng là sai, nên bỏ trống không
  // bao giờ lọt qua được — nhưng vẫn chặn ở đây để học sinh không nộp bài thiếu rồi
  // nhận về một danh sách câu sai gây hoang mang.
  const [answers, setAnswers] = useState<number[]>(() => cauHoi.map(() => -1));

  // Bản chụp đáp án ở LẦN NỘP GẦN NHẤT. Nhờ nó, "câu nào còn đang bị đánh dấu sai" là
  // một giá trị SUY RA được trong lúc render chứ không phải một state thứ hai phải đồng
  // bộ bằng `useEffect` — dấu "chưa đúng" biến mất ngay khi học sinh đổi lựa chọn của
  // đúng câu đó, vì lựa chọn hiện tại không còn khớp cái đã bị chấm.
  const [daNop, setDaNop] = useState<number[]>([]);
  const conSai = wrongPositions.filter((n) => answers[n - 1] === daNop[n - 1]);

  const chuaChon = answers.filter((a) => a < 0).length;

  function chon(i: number, choice: number) {
    setAnswers((cu) => cu.map((v, k) => (k === i ? choice : v)));
  }

  return (
    <div className="flex w-full flex-1 justify-center overflow-y-auto px-page-margin py-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (chuaChon === 0 && !busy) {
            setDaNop(answers);
            onSubmit(answers);
          }
        }}
        className="flex h-fit w-full max-w-2xl flex-col gap-lg rounded-md bg-surface p-xl"
      >
        <div>
          <h2 className="font-heading text-headline-md text-primary-dark">
            Trước khi nhận vật phẩm
          </h2>
          <p className="mt-sm max-w-measure font-body text-body-md text-secondary">
            {cauHoi.length === 1
              ? "Một câu hỏi ngắn về những gì bạn vừa đọc."
              : `${cauHoi.length} câu hỏi ngắn về những gì bạn vừa đọc.`}{" "}
            Trả lời đúng hết thì vật phẩm mới rơi ra — sai thì quay lại đọc rồi thử lại,
            không giới hạn số lần.
          </p>
        </div>

        {cauHoi.map((q, i) => {
          const sai = conSai.includes(i + 1);
          const errId = `cauhoi-${i}-sai`;
          return (
            <fieldset
              key={i}
              // Viền là thứ tách câu hỏi khỏi tấm giấy da nền: `surface-locked` trên
              // `surface` đạt 9.20:1 — cùng cặp đã khai làm `input-border` trong DESIGN.md.
              // Câu sai đổi sang `destructive`, nhưng màu KHÔNG phải tín hiệu duy nhất
              // (WCAG 1.4.1): còn icon và dòng chữ ở dưới.
              className={`flex flex-col gap-sm rounded-md border p-md ${
                sai ? "border-destructive" : "border-surface-locked"
              }`}
              aria-describedby={sai ? errId : undefined}
            >
              <legend className="px-xs font-body text-label-md text-primary-dark">
                Câu {i + 1}/{cauHoi.length}
              </legend>

              <p className="font-body text-body-md text-primary-dark">{q.prompt}</p>

              <div className="flex flex-col gap-xs">
                {q.choices.map((c, k) => (
                  // `<label>` bọc cả ô chọn: vùng bấm là cả dòng chứ không phải một chấm
                  // 16px. `has-[:focus-visible]` đẩy vòng focus ra viền nhãn, nếu không thì
                  // vòng focus bám quanh chính cái chấm và gần như không thấy.
                  <label
                    key={k}
                    className="flex cursor-pointer items-start gap-sm rounded-sm px-xs py-xs font-body text-body-md text-primary-dark transition-colors duration-200 ease-out hover:bg-neutral has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface"
                  >
                    <input
                      type="radio"
                      name={`cauhoi-${i}`}
                      checked={answers[i] === k}
                      onChange={() => chon(i, k)}
                      disabled={busy}
                      className="mt-[0.2em] h-4 w-4 shrink-0 accent-tertiary-deep focus-visible:outline-none"
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>

              {sai && (
                <p
                  id={errId}
                  className="flex items-center gap-xs font-body text-body-sm text-destructive"
                >
                  <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
                  Chưa đúng. Quay lại đọc phần liên quan rồi chọn lại.
                </p>
              )}
            </fieldset>
          );
        })}

        {/* Vùng live LUÔN có mặt, rỗng nhưng vẫn hiện: gỡ ra rồi gắn lại thì trình đọc
            màn hình coi đó là vùng vừa được THÊM chứ không phải một thay đổi, và thường
            không đọc (bẫy `empty:hidden` đã ghi ở CLAUDE.md). */}
        <p
          aria-live="polite"
          className={`flex min-h-[1.5rem] items-center gap-xs font-body text-body-sm ${
            error ? "text-destructive" : "text-secondary"
          }`}
        >
          {error ? (
            <>
              <AlertCircle aria-hidden className="h-4 w-4 shrink-0" />
              {error}
            </>
          ) : conSai.length > 0 ? (
            `Còn ${conSai.length} câu chưa đúng.`
          ) : chuaChon > 0 ? (
            `Còn ${chuaChon} câu chưa chọn.`
          ) : (
            <>
              <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0" />
              Đã chọn xong, nộp bài để nhận vật phẩm.
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-md">
          {/* Nút chính giữ đúng hình viên thuốc cam của cả ứng dụng — trên màn này nó là
              hành động chính DUY NHẤT (DESIGN.md § Overview). */}
          <button
            type="submit"
            disabled={busy || chuaChon > 0}
            className="inline-flex items-center justify-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 active:brightness-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {busy ? "Đang chấm…" : "Nộp bài"}
          </button>

          {/* Lối quay lại sách phải luôn mở: hàng rào này chỉ có nghĩa nếu học sinh đọc
              lại được phần mình chưa nắm. Nút chữ, không phải viên thuốc thứ hai. */}
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep underline underline-offset-2 transition duration-200 ease-out hover:decoration-2 active:brightness-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <BookOpen aria-hidden className="h-4 w-4" />
            Quay lại đọc
          </button>
        </div>
      </form>
    </div>
  );
}
