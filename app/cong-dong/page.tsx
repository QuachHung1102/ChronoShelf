import Link from "next/link";
import type { Metadata } from "next";
import { Award, Flame, HelpCircle, MessageSquare, PenLine, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { FIELD, LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";
import { dangBai, dangBinhLuan } from "@/lib/community/actions";
import { readBangTin } from "@/lib/community/read";
import { BAI_TOI_DA, BINH_LUAN_TOI_DA } from "@/lib/community/validation";
import { readShelfList } from "@/lib/content/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cộng đồng — Cửa Sổ Lịch Sử",
  description: "Nơi học sinh chia sẻ, đặt câu hỏi và cùng thảo luận về lịch sử.",
};

const dinhDangThoiGian = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default async function CongDongPage() {
  const shelves = await readShelfList();
  const bangTin = await readBangTin();
  const bangTinRong = bangTin.bai.length === 0;

  return (
    <>
      <Header activeHref="/cong-dong" shelves={shelves} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <div className="mx-auto max-w-5xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Phòng đọc chung</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">
            Chuyện lịch sử đáng để kể tiếp
          </h1>
          <p className="mt-sm max-w-measure font-body text-body-md text-secondary">
            Đặt một câu hỏi còn vướng, chia sẻ điều vừa khám phá, hoặc góp thêm một mảnh
            ghép cho câu chuyện của bạn học.
          </p>

          {/* Bảng tin rỗng thì đổ về MỘT cột. Bố cục hai cột chỉ hợp lý khi cột chính có
              bài để đọc; lúc chưa có bài nào, nó đẩy hành động duy nhất của màn hình —
              "viết bài đầu tiên" — vào cột hẹp 288px và để hơn nửa trang trống hoác.
              DESIGN.md § Overview: mỗi màn hình chỉ có MỘT hành động chính rõ ràng.
              Hai nhánh đều là chuỗi literal đầy đủ để JIT của Tailwind quét được. */}
          <div
            className={
              bangTinRong
                ? "mt-xl grid items-start gap-lg"
                : "mt-xl grid items-start gap-lg lg:grid-cols-[minmax(0,1fr)_18rem]"
            }
          >
            <section className="min-w-0" aria-labelledby="bang-tin">
              <div className="flex items-center justify-between gap-md">
                <h2 id="bang-tin" className="font-heading text-headline-md text-primary-dark">
                  Bảng tin mới nhất
                </h2>
                <span className="font-body text-body-sm text-secondary">
                  {bangTin.bai.length} bài gần đây
                </span>
              </div>

              {bangTinRong ? (
                // Một dòng dẫn, không phải một cái hộp viền: hộp "chưa có gì" chiếm chỗ
                // ngang với nội dung thật mà không nói thêm điều gì ngoài con số "0 bài"
                // ngay phía trên. Ô soạn bài nằm ngay dưới dòng này.
                <p className="mt-md max-w-measure font-body text-body-md text-secondary">
                  Chưa ai kể chuyện gì. Bạn mở đầu nhé.
                </p>
              ) : (
                <ol className="mt-md space-y-md">
                  {bangTin.bai.map((bai) => {
                    const action = dangBinhLuan.bind(null, bai.id);
                    const laCauHoi = bai.kind === "cau-hoi";

                    return (
                      <li key={bai.id}>
                        <article
                          className="rounded-md border border-surface-locked bg-surface p-lg"
                          aria-labelledby={`bai-${bai.id}`}
                        >
                          <header className="flex items-start justify-between gap-md">
                            <div className="flex items-center gap-sm">
                              {/* Vòng tròn đổi màu theo loại bài — đây là kênh quét bằng
                                  mắt duy nhất còn lại sau khi byline tụt xuống cỡ chữ
                                  metadata. Không phải phân biệt CHỈ bằng màu (WCAG 1.4.1):
                                  icon khác hình và chữ vẫn ghi rõ "Câu hỏi"/"Chia sẻ". */}
                              <span
                                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-primary ${
                                  laCauHoi ? "bg-tertiary-deep" : "bg-primary"
                                }`}
                              >
                                {laCauHoi ? (
                                  <HelpCircle aria-hidden className="h-5 w-5" />
                                ) : (
                                  <PenLine aria-hidden className="h-5 w-5" />
                                )}
                              </span>
                              <div>
                                {/* Vẫn là <h2> (aria-labelledby của <article> trỏ vào nó),
                                    chỉ thôi mang cỡ chữ tiêu đề: biệt danh là một chuỗi băm
                                    4 ký tự, nó không được to hơn chính bài viết. */}
                                <h2
                                  id={`bai-${bai.id}`}
                                  className="font-body text-label-md text-secondary"
                                >
                                  {laCauHoi ? "Câu hỏi" : "Chia sẻ"} của {bai.tacGia}
                                </h2>
                                <time
                                  dateTime={bai.createdAt.toISOString()}
                                  className="font-body text-caption text-secondary"
                                >
                                  {dinhDangThoiGian.format(bai.createdAt)}
                                </time>
                              </div>
                            </div>
                          </header>

                          {/* `body-book` 16px/1.75 là thang chữ dành cho văn xuôi đọc dài,
                              và `max-w-measure` giữ dòng trong khoảng 60–75 ký tự
                              (DESIGN.md § Layout). Nội dung bài là vật nặng nhất trong thẻ. */}
                          <p className="mt-md max-w-measure whitespace-pre-wrap break-words font-body text-body-book text-primary-dark">
                            {bai.body}
                          </p>

                          <section
                            className="mt-lg border-t border-surface-locked pt-md"
                            aria-label={`Bình luận cho bài của ${bai.tacGia}`}
                          >
                            <h3 className="font-body text-label-md text-primary-dark">
                              {bai.binhLuan.length} bình luận
                            </h3>

                            {bai.binhLuan.length > 0 && (
                              <ol className="mt-sm space-y-sm">
                                {bai.binhLuan.map((binhLuan) => (
                                  <li
                                    key={binhLuan.id}
                                    className="border-l-2 border-secondary-light pl-md"
                                  >
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xs">
                                      <span className="font-body text-label-md text-primary-dark">
                                        {binhLuan.tacGia}
                                      </span>
                                      <time
                                        dateTime={binhLuan.createdAt.toISOString()}
                                        className="font-body text-caption text-secondary"
                                      >
                                        {dinhDangThoiGian.format(binhLuan.createdAt)}
                                      </time>
                                    </div>
                                    <p className="mt-xs max-w-measure whitespace-pre-wrap break-words font-body text-body-sm text-secondary">
                                      {binhLuan.body}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            )}

                            {bangTin.daDangNhap && (
                              // Form bình luận nằm trong <details>. Mở sẵn ở MỌI bài thì
                              // bảng tin biến thành một chồng ô nhập rỗng và không còn đọc
                              // được — mà đọc mới là việc chính ở đây. <details> là của
                              // trình duyệt: đã có aria-expanded, mở được bằng bàn phím,
                              // không tốn một dòng JS nào.
                              <details className="mt-md">
                                <summary className={`${QUIET_BUTTON} cursor-pointer list-none`}>
                                  <MessageSquare aria-hidden className="h-4 w-4" />
                                  Thêm bình luận
                                </summary>

                                <ActionForm
                                  action={action}
                                  resetOnSuccess
                                  className="mt-sm flex flex-col gap-sm"
                                >
                                  <label className={LABEL} htmlFor={`binh-luan-${bai.id}`}>
                                    Bình luận của bạn
                                  </label>
                                  {/* `maxLength` chặn ngay trong trình duyệt đúng con số
                                      máy chủ chặn (lib/community/actions.ts). Máy chủ đếm
                                      CODE POINT (`[...value].length` sau `trim()`), còn
                                      `maxLength` đếm UTF-16 code unit — tiếng Việt dựng sẵn
                                      đều nằm trong BMP nên hai cách đếm trùng nhau; khác
                                      biệt duy nhất là maxLength tính cả khoảng trắng đầu
                                      cuối sẽ bị trim, tức nó chỉ chặt hơn, không chặn nhầm. */}
                                  <textarea
                                    id={`binh-luan-${bai.id}`}
                                    name="body"
                                    required
                                    rows={3}
                                    maxLength={BINH_LUAN_TOI_DA}
                                    className={FIELD}
                                    placeholder="Viết câu trả lời hoặc góp thêm một ý…"
                                  />
                                  <p className="font-body text-caption text-secondary">
                                    Tối đa {BINH_LUAN_TOI_DA.toLocaleString("vi-VN")} ký tự.
                                  </p>
                                  <SubmitButton
                                    className={`${QUIET_BUTTON} self-start py-sm`}
                                    pendingLabel="Đang gửi…"
                                  >
                                    <Send aria-hidden className="h-4 w-4" />
                                    Gửi bình luận
                                  </SubmitButton>
                                </ActionForm>
                              </details>
                            )}
                          </section>
                        </article>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <aside className="space-y-md" aria-label="Đăng bài và thành tích">
              <section className="rounded-md border border-surface-locked bg-surface p-lg">
                <h2 className="font-heading text-headline-sm text-primary-dark">Góp một câu chuyện</h2>

                {bangTin.daDangNhap ? (
                  <ActionForm action={dangBai} resetOnSuccess className="mt-md flex flex-col gap-md">
                    <div>
                      <label className={LABEL} htmlFor="loai-bai">
                        Bạn muốn
                      </label>
                      <select id="loai-bai" name="kind" className={`${FIELD} mt-xs`}>
                        <option value="chia-se">Chia sẻ một điều</option>
                        <option value="cau-hoi">Đặt một câu hỏi</option>
                      </select>
                    </div>

                    <div>
                      <label className={LABEL} htmlFor="noi-dung-bai">
                        Nội dung
                      </label>
                      {/* Con số 1.000 ở dòng dưới trước đây chỉ là một lời hứa suông —
                          không ô nào chặn. Xem ghi chú code point / UTF-16 ở ô bình luận. */}
                      <textarea
                        id="noi-dung-bai"
                        name="body"
                        required
                        rows={6}
                        maxLength={BAI_TOI_DA}
                        className={`${FIELD} mt-xs`}
                        placeholder="Điều gì trong lịch sử khiến bạn tò mò?"
                      />
                      <p className="mt-xs font-body text-caption text-secondary">Tối đa {BAI_TOI_DA.toLocaleString("vi-VN")} ký tự.</p>
                    </div>

                    <SubmitButton className={PRIMARY_BUTTON} pendingLabel="Đang đăng…">
                      <PenLine aria-hidden className="h-4 w-4" />
                      Đăng lên bảng tin
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <div className="mt-sm">
                    <p className="font-body text-body-sm text-secondary">
                      Đăng nhập để đặt câu hỏi, chia sẻ và giữ chuỗi ngày học.
                    </p>
                    <Link
                      href="/dang-nhap?next=%2Fcong-dong"
                      className={`${PRIMARY_BUTTON} mt-md`}
                    >
                      Đăng nhập để viết bài
                    </Link>
                  </div>
                )}
              </section>

              {bangTin.daDangNhap && (
                // Nền `primary-dark` chứ không phải `primary`: hai dòng caption dưới đây
                // dùng `secondary-light`, và cặp đó trên `primary` chỉ đạt 4.68:1 sát
                // ngưỡng, trong khi trên `primary-dark` là 8.66:1 — đúng cặp DESIGN.md đã
                // khai báo cho `book-tooltip`. Đường kẻ `border-secondary-light` cũng lên
                // theo. Đây là chỗ nói người học đang giữ chuỗi bao nhiêu ngày, nó không
                // được là chỗ mờ nhất màn hình.
                <section className="rounded-md bg-primary-dark p-lg text-on-primary">
                  <div className="flex items-center gap-sm">
                    <Flame aria-hidden className="h-6 w-6 shrink-0 text-tertiary-light" />
                    <div>
                      <p className="font-heading text-headline-sm">{bangTin.streak} ngày liên tục</p>
                      <p className="font-body text-caption text-secondary-light">
                        {bangTin.daGiuLuaHomNay ? "Hôm nay đã giữ lửa" : "Hôm nay chưa giữ lửa"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-md border-t border-secondary-light pt-md">
                    <div className="flex items-start gap-sm">
                      <Award aria-hidden className="mt-xs h-5 w-5 shrink-0 text-tertiary-light" />
                      <div>
                        <p className="font-body text-label-md">
                          {bangTin.danhHieu ?? "Danh hiệu đang chờ"}
                        </p>
                        <p className="mt-xs font-body text-caption text-secondary-light">
                          Chuỗi dài nhất: {bangTin.streakDaiNhat} ngày. Mốc đầu tiên là 7 ngày.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
