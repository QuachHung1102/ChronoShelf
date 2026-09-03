import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { ImageField } from "./ImageField";
import { SlideField } from "./SlideField";
import {
  createLesson,
  deleteLesson,
  setLessonPublished,
  updateLesson,
} from "@/lib/admin/actions";
import type { SachChon } from "@/lib/admin/lessons";
import type { BaiGiang } from "@/lib/learning/read";
import { CAC_LOP } from "@/lib/learning/read";
import {
  DANGER_BUTTON,
  FIELD,
  LABEL,
  PRIMARY_BUTTON,
  QUIET_BUTTON,
} from "@/components/ui/controls";

/**
 * Màn `/quan-tri/bai-giang`. Server Component — cùng lối với `ShelfAdmin`/`ItemAdmin`:
 * mỗi hành động là một `<form>` nhỏ độc lập, không có JavaScript điều phối nào của riêng
 * màn này ngoài `ActionForm`, `ImageField` và `SlideField`.
 *
 * KHÔNG có nút đổi thứ tự: `lessons` cố ý không có cột `position` — xem
 * `db/schema/14-learning-hub.sql`.
 */
export function LessonAdmin({ bai, sach }: { bai: BaiGiang[]; sach: SachChon[] }) {
  return (
    <div className="flex flex-col gap-lg">
      <section aria-labelledby="them-bai" className="rounded-md bg-surface p-md">
        <h2 id="them-bai" className="font-heading text-headline-sm text-primary-dark">
          Thêm bài giảng
        </h2>
        <ActionForm action={createLesson} className="mt-sm grid gap-sm sm:grid-cols-[1fr_10rem_auto]">
          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="bai-moi-ten">
              Tên bài giảng
            </label>
            <input
              id="bai-moi-ten"
              name="title"
              required
              maxLength={200}
              placeholder="Chiến thắng Bạch Đằng năm 938"
              className={FIELD}
            />
          </span>
          <span className="flex flex-col gap-xs">
            <label className={LABEL} htmlFor="bai-moi-lop">
              Khối lớp
            </label>
            <select id="bai-moi-lop" name="grade" defaultValue="10" className={FIELD}>
              {CAC_LOP.map((lop) => (
                <option key={lop} value={lop}>
                  Lớp {lop}
                </option>
              ))}
            </select>
          </span>
          <SubmitButton className={`${PRIMARY_BUTTON} self-end`} pendingLabel="Đang tạo…">
            <Plus aria-hidden className="h-4 w-4" />
            Tạo bài
          </SubmitButton>
        </ActionForm>
      </section>

      {bai.length === 0 ? (
        <p className="font-body text-body-md text-secondary">
          Chưa có bài giảng nào. Tạo một bài ở trên để bắt đầu.
        </p>
      ) : (
        <ol className="flex flex-col gap-md">
          {bai.map((b) => (
            <li key={b.slug}>
              <article
                className="rounded-md bg-surface p-md"
                aria-labelledby={`bai-${b.slug}-ten`}
              >
                <header className="flex flex-wrap items-center justify-between gap-sm border-b border-surface-locked pb-sm">
                  <div>
                    <h2
                      id={`bai-${b.slug}-ten`}
                      className="font-heading text-headline-sm text-primary-dark"
                    >
                      {b.title}
                    </h2>
                    <p className="font-body text-caption text-secondary">
                      Lớp {b.grade} · {b.published ? "Đã xuất bản" : "Nháp"} · {b.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-md">
                    <ActionForm action={setLessonPublished}>
                      <input type="hidden" name="slug" value={b.slug} />
                      <input type="hidden" name="published" value={b.published ? "0" : "1"} />
                      <SubmitButton
                        className={QUIET_BUTTON}
                        pendingLabel={b.published ? "Đang ẩn…" : "Đang xuất bản…"}
                      >
                        {b.published ? (
                          <EyeOff aria-hidden className="h-4 w-4" />
                        ) : (
                          <Eye aria-hidden className="h-4 w-4" />
                        )}
                        {b.published ? "Đưa về nháp" : "Xuất bản"}
                      </SubmitButton>
                    </ActionForm>

                    <ActionForm
                      action={deleteLesson}
                      confirmText={`Xóa bài giảng "${b.title}"? Không hoàn tác được.`}
                    >
                      <input type="hidden" name="slug" value={b.slug} />
                      <SubmitButton className={DANGER_BUTTON} pendingLabel="Đang xóa…">
                        <Trash2 aria-hidden className="h-4 w-4" />
                        Xóa
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </header>

                <ActionForm action={updateLesson} className="mt-sm grid gap-sm sm:grid-cols-2">
                  <input type="hidden" name="slug" value={b.slug} />

                  <span className="flex flex-col gap-xs">
                    <label className={LABEL} htmlFor={`ten-${b.slug}`}>
                      Tên bài giảng
                    </label>
                    <input
                      id={`ten-${b.slug}`}
                      name="title"
                      defaultValue={b.title}
                      required
                      maxLength={200}
                      className={FIELD}
                    />
                  </span>

                  <span className="flex flex-col gap-xs">
                    <label className={LABEL} htmlFor={`lop-${b.slug}`}>
                      Khối lớp
                    </label>
                    <select
                      id={`lop-${b.slug}`}
                      name="grade"
                      defaultValue={String(b.grade)}
                      className={FIELD}
                    >
                      {CAC_LOP.map((lop) => (
                        <option key={lop} value={lop}>
                          Lớp {lop}
                        </option>
                      ))}
                    </select>
                  </span>

                  <span className="flex flex-col gap-xs sm:col-span-2">
                    <label className={LABEL} htmlFor={`tt-${b.slug}`}>
                      Tóm tắt ngắn
                    </label>
                    <textarea
                      id={`tt-${b.slug}`}
                      name="summary"
                      defaultValue={b.summary}
                      rows={2}
                      maxLength={500}
                      className={FIELD}
                    />
                  </span>

                  <span className="flex flex-col gap-xs sm:col-span-2">
                    <label className={LABEL} htmlFor={`sach-${b.slug}`}>
                      Gắn với quyển sách
                    </label>
                    <select
                      id={`sach-${b.slug}`}
                      name="bookSlug"
                      defaultValue={b.bookSlug ?? ""}
                      className={FIELD}
                    >
                      <option value="">— Không gắn quyển nào —</option>
                      {sach.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.shelfName} — {s.title}
                        </option>
                      ))}
                    </select>
                    <span className="font-body text-caption text-secondary">
                      Đọc xong quyển này thì học sinh được gợi ý ngay bài giảng đây
                      (content.md §7).
                    </span>
                  </span>

                  <span className="sm:col-span-2">
                    <SlideField defaultUrl={b.slideUrl} defaultFilename={b.slideFilename} />
                  </span>

                  <span className="sm:col-span-2">
                    <ImageField
                      prefix="preview"
                      label="Ảnh xem trước bộ slide"
                      hint="Chụp slide đầu tiên. PNG, JPEG, WebP hoặc GIF, tối đa 2 MB."
                      defaultUrl={b.previewUrl}
                      defaultSource={b.previewSource}
                      defaultCredit={b.previewCredit}
                    />
                  </span>

                  <span className="sm:col-span-2">
                    <ImageField
                      prefix="mindmap"
                      label="Sơ đồ tư duy"
                      hint="Ảnh sơ đồ tóm tắt chương. PNG, JPEG, WebP hoặc GIF, tối đa 2 MB."
                      defaultUrl={b.mindmapUrl}
                      defaultSource={b.mindmapSource}
                      defaultCredit={b.mindmapCredit}
                    />
                  </span>

                  <span className="sm:col-span-2">
                    <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang lưu…">
                      Lưu
                    </SubmitButton>
                  </span>
                </ActionForm>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
