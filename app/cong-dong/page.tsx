import Link from "next/link";
import type { Metadata } from "next";
import { Award, Flame, HelpCircle, MessageSquare, PenLine, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { FIELD, LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from "@/components/ui/controls";
import { dangBai, dangBinhLuan } from "@/lib/community/actions";
import { readBangTin } from "@/lib/community/read";
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

  return (
    <>
      <Header activeHref="/cong-dong" shelves={shelves} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <div className="mx-auto max-w-5xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Phòng đọc chung</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">
            Chuyện lịch sử đáng để kể tiếp
          </h1>
          <p className="mt-sm max-w-2xl font-body text-body-md text-secondary">
            Đặt một câu hỏi còn vướng, chia sẻ điều vừa khám phá, hoặc góp thêm một mảnh
            ghép cho câu chuyện của bạn học.
          </p>

          <div className="mt-xl grid items-start gap-lg lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="min-w-0" aria-labelledby="bang-tin">
              <div className="flex items-center justify-between gap-md">
                <h2 id="bang-tin" className="font-heading text-headline-md text-primary-dark">
                  Bảng tin mới nhất
                </h2>
                <span className="font-body text-body-sm text-secondary">
                  {bangTin.bai.length} bài gần đây
                </span>
              </div>

              {bangTin.bai.length === 0 ? (
                <div className="mt-md rounded-md border border-surface-locked bg-surface p-lg">
                  <MessageSquare aria-hidden className="h-8 w-8 text-tertiary-deep" />
                  <p className="mt-sm font-heading text-headline-sm text-primary-dark">
                    Chưa có câu chuyện nào
                  </p>
                  <p className="mt-xs font-body text-body-sm text-secondary">
                    Hãy là người đầu tiên mở cuộc trò chuyện.
                  </p>
                </div>
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
                              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary">
                                {laCauHoi ? (
                                  <HelpCircle aria-hidden className="h-5 w-5" />
                                ) : (
                                  <PenLine aria-hidden className="h-5 w-5" />
                                )}
                              </span>
                              <div>
                                <h2
                                  id={`bai-${bai.id}`}
                                  className="font-heading text-headline-sm text-primary-dark"
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

                          <p className="mt-md whitespace-pre-wrap break-words font-body text-body-md text-primary-dark">
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
                                    <p className="mt-xs whitespace-pre-wrap break-words font-body text-body-sm text-secondary">
                                      {binhLuan.body}
                                    </p>
                                  </li>
                                ))}
                              </ol>
                            )}

                            {bangTin.daDangNhap && (
                              <ActionForm
                                action={action}
                                resetOnSuccess
                                className="mt-md flex flex-col gap-sm"
                              >
                                <label className={LABEL} htmlFor={`binh-luan-${bai.id}`}>
                                  Thêm bình luận
                                </label>
                                <textarea
                                  id={`binh-luan-${bai.id}`}
                                  name="body"
                                  required
                                  rows={2}
                                  className={FIELD}
                                  placeholder="Viết câu trả lời hoặc góp thêm một ý…"
                                />
                                <SubmitButton
                                  className={`${QUIET_BUTTON} self-start py-sm`}
                                  pendingLabel="Đang gửi…"
                                >
                                  <Send aria-hidden className="h-4 w-4" />
                                  Gửi bình luận
                                </SubmitButton>
                              </ActionForm>
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
                      <textarea
                        id="noi-dung-bai"
                        name="body"
                        required
                        rows={6}
                        className={`${FIELD} mt-xs`}
                        placeholder="Điều gì trong lịch sử khiến bạn tò mò?"
                      />
                      <p className="mt-xs font-body text-caption text-secondary">Tối đa 1.000 ký tự.</p>
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
                <section className="rounded-md bg-primary p-lg text-on-primary">
                  <div className="flex items-center gap-sm">
                    <Flame aria-hidden className="h-6 w-6 text-tertiary-light" />
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
