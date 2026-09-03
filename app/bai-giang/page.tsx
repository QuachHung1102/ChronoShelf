import Link from "next/link";
import type { Metadata } from "next";
import { Download, FileText, Network } from "lucide-react";
import { Header } from "@/components/Header";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import { readShelfList } from "@/lib/content/read";
import { nhomTheoLop, readBaiGiang } from "@/lib/learning/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bài giảng & Slide — Cửa Sổ Lịch Sử",
  description: "Kho bài trình chiếu và sơ đồ tư duy theo Lịch sử lớp 10, 11 và 12.",
};

export default async function BaiGiangPage() {
  const shelves = await readShelfList();
  const bai = await readBaiGiang();
  const theoLop = nhomTheoLop(bai);

  return (
    <>
      <Header activeHref="/bai-giang" shelves={shelves} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <div className="mx-auto max-w-5xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Thư viện</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">
            Bài giảng &amp; sơ đồ tư duy
          </h1>
          <p className="mt-sm max-w-2xl font-body text-body-md text-secondary">
            Bộ slide soạn sẵn để làm bài thuyết trình nhóm, và sơ đồ tư duy tóm tắt từng
            chương để ôn tập. Tải về miễn phí.
          </p>

          {bai.length === 0 && (
            <div className="mt-xl rounded-md border border-surface-locked bg-surface p-lg">
              <FileText aria-hidden className="h-8 w-8 text-tertiary-deep" />
              <p className="mt-sm font-heading text-headline-sm text-primary-dark">
                Thư viện đang được soạn
              </p>
              <p className="mt-xs font-body text-body-sm text-secondary">
                Chưa có bài giảng nào được xuất bản. Quay lại sau nhé.
              </p>
            </div>
          )}

          {theoLop.map(({ lop, bai: baiCuaLop }) => (
            <section key={lop} className="mt-xl" aria-labelledby={`lop-${lop}`}>
              <div className="flex items-baseline justify-between gap-md border-b border-surface-locked pb-sm">
                <h2 id={`lop-${lop}`} className="font-heading text-headline-md text-primary-dark">
                  Lịch sử lớp {lop}
                </h2>
                <span className="font-body text-body-sm text-secondary">
                  {baiCuaLop.length} bài
                </span>
              </div>

              {baiCuaLop.length === 0 ? (
                <p className="mt-md font-body text-body-sm text-secondary">
                  Khối này chưa có bài giảng nào.
                </p>
              ) : (
                <ul className="mt-md grid gap-md sm:grid-cols-2">
                  {baiCuaLop.map((b) => (
                    // `id` để màn "đọc xong một quyển" nhảy thẳng tới đúng bài — xem
                    // liên kết chéo trong `ItemDropOverlay`.
                    <li
                      key={b.slug}
                      id={`bai-${b.slug}`}
                      className="scroll-mt-lg rounded-md border border-surface-locked bg-surface p-lg"
                    >
                      <h3 className="font-heading text-headline-sm text-primary-dark">
                        {b.title}
                        {!b.published && (
                          // Người thường không bao giờ thấy nhánh này: policy `read
                          // published` đã lọc. Nó chỉ hiện cho admin đang xem trang công
                          // khai, để khỏi tưởng bài nháp đã ra mắt.
                          <span className="ml-sm align-middle font-body text-caption text-tertiary-deep">
                            (nháp)
                          </span>
                        )}
                      </h3>

                      {b.summary && (
                        <p className="mt-xs font-body text-body-sm text-secondary">{b.summary}</p>
                      )}

                      {b.previewUrl && (
                        <figure className="mt-md">
                          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nằm trong bảng `media`, phục vụ qua /media/[id] chứ không qua loader của next/image */}
                          <img
                            src={b.previewUrl}
                            alt={`Ảnh xem trước bộ slide "${b.title}"`}
                            className="w-full rounded-sm border border-surface-locked"
                          />
                          <GhiCongAnh
                            credit={b.previewCredit}
                            nguon={b.previewSource}
                            className="mt-xs font-body text-caption text-secondary"
                          />
                        </figure>
                      )}

                      <div className="mt-md flex flex-wrap items-center gap-md">
                        {b.slideUrl && (
                          // `<a>` thường chứ không `<Link>`: đây là một lượt tải tệp, không
                          // phải điều hướng trong ứng dụng. Prefetch của Link sẽ kéo cả bộ
                          // slide về trong nền.
                          <a
                            href={b.slideUrl}
                            className="inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                          >
                            <Download aria-hidden className="h-4 w-4" />
                            Tải slide{b.slideFilename ? ` (${b.slideFilename})` : ""}
                          </a>
                        )}

                        {b.mindmapUrl && (
                          <a
                            href={b.mindmapUrl}
                            className="inline-flex items-center gap-xs rounded-sm font-body text-body-sm text-tertiary-deep underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                          >
                            <Network aria-hidden className="h-4 w-4" />
                            Xem sơ đồ tư duy
                          </a>
                        )}

                        {b.sach && (
                          <span className="font-body text-caption text-secondary">
                            Gắn với quyển{" "}
                            <Link
                              href={`/${b.sach.shelfSlug}`}
                              className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                            >
                              “{b.sach.title}”
                            </Link>
                          </span>
                        )}
                      </div>

                      {!b.slideUrl && !b.mindmapUrl && (
                        <p className="mt-md font-body text-caption text-secondary">
                          Bài này chưa có tệp nào để tải.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
