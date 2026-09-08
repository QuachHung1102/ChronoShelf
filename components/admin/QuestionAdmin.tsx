import { CircleHelp, Info, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ADMIN_CARD, CARD_DIVIDER, CardDisclosure } from "./card";
import { createQuestion, deleteQuestion, updateQuestion } from "@/lib/admin/actions";
import type { AdminBookHeader } from "@/lib/admin/pages";
import type { AdminQuestionRow } from "@/lib/admin/questions";
import { DANGER_BUTTON, FIELD, LABEL, PRIMARY_BUTTON } from "@/components/ui/controls";

/** Số ô lựa chọn. PHẢI khớp `MAX_CHOICES` trong `lib/admin/actions.ts` và ràng buộc SQL. */
const SLOTS = [0, 1, 2, 3];

/**
 * Bốn ô lựa chọn kèm ô đánh dấu đáp án.
 *
 * Ô radio nằm CÙNG HÀNG với ô nhập chứ không tách thành một danh sách "chọn đáp án" riêng
 * bên dưới: tách ra thì admin phải tự đếm "đáp án là lựa chọn thứ mấy" và đối chiếu bằng
 * mắt — đúng loại việc thủ công sinh ra câu hỏi có đáp án trỏ nhầm chỗ.
 *
 * Ô để trống bị BỎ QUA khi lưu, nên một câu hai lựa chọn chỉ cần điền hai ô đầu. Việc dịch
 * "ô thứ mấy" sang "chỉ số trong mảng đã nén" nằm ở `readChoices` phía server.
 */
function ChoiceFields({
  idPrefix,
  choices,
  correctIndex,
}: {
  idPrefix: string;
  choices: string[];
  correctIndex: number;
}) {
  return (
    <fieldset className="flex flex-col gap-xs">
      <legend className={LABEL}>Các lựa chọn</legend>
      <p className="mb-xs max-w-measure font-body text-caption text-secondary">
        Điền 2–4 lựa chọn và đánh dấu đúng một đáp án. Ô để trống sẽ bị bỏ qua.
      </p>

      {SLOTS.map((slot) => (
        <span key={slot} className="flex items-center gap-sm">
          {/* Nhãn của radio là chữ "Đáp án đúng" ẩn cho trình đọc màn hình: một ô radio
              trần không có nhãn nào thì trình đọc chỉ đọc ra "nút chọn, chưa chọn". */}
          <label className="flex shrink-0 items-center gap-xs">
            <input
              type="radio"
              name="correct"
              value={slot}
              defaultChecked={correctIndex === slot}
              className="h-4 w-4 accent-tertiary-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            />
            <span className="sr-only">Đáp án đúng là lựa chọn {slot + 1}</span>
          </label>
          <label className="sr-only" htmlFor={`${idPrefix}-c${slot}`}>
            Lựa chọn {slot + 1}
          </label>
          <input
            id={`${idPrefix}-c${slot}`}
            name={`choice${slot}`}
            defaultValue={choices[slot] ?? ""}
            maxLength={200}
            placeholder={`Lựa chọn ${slot + 1}`}
            className={FIELD}
          />
        </span>
      ))}
    </fieldset>
  );
}

/**
 * Soạn bài trắc nghiệm cuối sách (content.md §4.3).
 *
 * Đây là màn DUY NHẤT trong sản phẩm hiện được đáp án, và nó chỉ hiện được nhờ hàm
 * SECURITY DEFINER `admin_book_questions` — role của ứng dụng không có `GRANT SELECT`
 * trên cột `correct_index`. Xem `lib/admin/questions.ts`.
 */
export function QuestionAdmin({
  book,
  questions,
}: {
  book: AdminBookHeader;
  questions: AdminQuestionRow[];
}) {
  return (
    <div className="flex flex-col gap-lg">
      <div className={ADMIN_CARD}>
        <p className="flex max-w-measure items-start gap-sm font-body text-body-sm text-secondary">
          <Info aria-hidden className="mt-[0.15em] h-4 w-4 shrink-0 text-tertiary-deep" />
          <span>
            {questions.length === 0 ? (
              <>
                Quyển này <strong className="font-semibold text-primary-dark">chưa có câu hỏi nào</strong>, nên
                đọc hết trang cuối là học sinh nhận vật phẩm ngay. Thêm 2–3 câu ở dưới thì phải
                trả lời đúng hết mới nhận được.
              </>
            ) : (
              <>
                Học sinh phải trả lời đúng <strong className="font-semibold text-primary-dark">tất cả</strong>{" "}
                {questions.length} câu mới nhận được vật phẩm. Sai thì được đọc lại và làm lại
                không giới hạn số lần. Người đã hoàn thành quyển này từ trước không phải làm lại.
              </>
            )}
          </span>
        </p>
      </div>

      <section aria-labelledby="ds-cau-hoi" className="flex flex-col gap-md">
        <h2 id="ds-cau-hoi" className="font-heading text-headline-sm text-primary-dark">
          {questions.length === 0 ? "Chưa có câu hỏi" : `${questions.length} câu hỏi`}
        </h2>

        {questions.map((q, index) => (
          <article key={q.id} className={ADMIN_CARD}>
            <header className="flex flex-wrap items-start gap-sm">
              <span
                aria-hidden
                className="mt-[0.15em] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-secondary bg-neutral font-body text-caption text-primary-dark"
              >
                {index + 1}
              </span>
              <h3 className="font-heading text-headline-sm text-primary-dark">{q.prompt}</h3>
            </header>

            {/* Đáp án hiện ngay ở phần gập lại: khi admin lướt để soát bài, thứ cần thấy
                là "câu này đáp án là gì", không phải "câu này có mấy lựa chọn". */}
            <p className="mt-sm font-body text-body-sm text-secondary">
              Đáp án: <span className="text-primary-dark">{q.choices[q.correctIndex]}</span>
              {` · ${q.choices.length} lựa chọn`}
            </p>

            <CardDisclosure label={`Sửa câu ${index + 1}`}>
              <ActionForm action={updateQuestion} className="flex flex-col gap-sm">
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="bookSlug" value={book.slug} />
                <input type="hidden" name="shelfSlug" value={book.shelfSlug} />

                <span className="flex flex-col gap-xs">
                  <label className={LABEL} htmlFor={`p-${q.id}`}>
                    Câu hỏi
                  </label>
                  <textarea
                    id={`p-${q.id}`}
                    name="prompt"
                    defaultValue={q.prompt}
                    required
                    maxLength={300}
                    rows={2}
                    className={FIELD}
                  />
                </span>

                <ChoiceFields
                  idPrefix={q.id}
                  choices={q.choices}
                  correctIndex={q.correctIndex}
                />

                <SubmitButton className={`w-fit ${PRIMARY_BUTTON}`} pendingLabel="Đang lưu…">
                  Lưu câu {index + 1}
                </SubmitButton>
              </ActionForm>

              <div className={`mt-md border-t ${CARD_DIVIDER} pt-sm`}>
                <ActionForm
                  action={deleteQuestion}
                  confirmText={`Xóa câu ${index + 1} (“${q.prompt}”)? Không hoàn tác được.`}
                >
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="bookSlug" value={book.slug} />
                  <input type="hidden" name="shelfSlug" value={book.shelfSlug} />
                  <SubmitButton className={DANGER_BUTTON} pendingLabel="Đang xóa…">
                    <Trash2 aria-hidden className="h-4 w-4" />
                    Xóa câu hỏi
                  </SubmitButton>
                </ActionForm>
              </div>
            </CardDisclosure>
          </article>
        ))}
      </section>

      {/* Form thêm ở CUỐI, cùng lý do như màn soạn trang: câu mới nối vào cuối danh sách,
          nên nút đặt đúng chỗ nó sẽ xuất hiện. `resetOnSuccess` để soạn liền ba câu mà
          không phải tự xóa lại từng ô. */}
      <section aria-labelledby="them-cau-hoi" className={ADMIN_CARD}>
        <h2
          id="them-cau-hoi"
          className="mb-sm flex items-center gap-sm font-heading text-headline-sm text-primary-dark"
        >
          <CircleHelp aria-hidden className="h-5 w-5 text-tertiary-deep" />
          Thêm câu {questions.length + 1}
        </h2>
        <ActionForm action={createQuestion} className="flex flex-col gap-sm" resetOnSuccess>
          <input type="hidden" name="bookSlug" value={book.slug} />
          <input type="hidden" name="shelfSlug" value={book.shelfSlug} />

          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="p-moi">
              Câu hỏi
            </label>
            <textarea
              id="p-moi"
              name="prompt"
              required
              maxLength={300}
              rows={2}
              placeholder="Ngô Quyền chọn nơi nào làm trận địa quyết chiến?"
              className={FIELD}
            />
          </span>

          {/* `correctIndex={-1}`: KHÔNG tick sẵn ô nào. Bản trước tick sẵn Lựa chọn 1,
                  nên admin quên chọn đáp án là xuất bản một câu có đáp án SAI mà không
                  cảnh báo nào — và phép chặn phía máy chủ ("Chọn đáp án đúng…") không bao
                  giờ với tới được, vì một nhóm radio đã có sẵn lựa chọn thì không thể
                  trống. Đây là màn DUY NHẤT giữ đáp án; sai ở đây thì học sinh không bao
                  giờ hoàn thành được quyển sách. */}
              <ChoiceFields idPrefix="moi" choices={[]} correctIndex={-1} />

          <SubmitButton className={`w-fit ${PRIMARY_BUTTON}`} pendingLabel="Đang thêm…">
            <Plus aria-hidden className="h-4 w-4" />
            Thêm câu hỏi
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
