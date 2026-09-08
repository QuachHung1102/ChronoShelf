import Link from "next/link";
import type { Metadata } from "next";
import { Download, FileText, Network } from "lucide-react";
import { Header } from "@/components/Header";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import { PRIMARY_BUTTON } from "@/components/ui/controls";
import { readShelfList } from "@/lib/content/read";
import { nhomTheoLop, readBaiGiang } from "@/lib/learning/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bài giảng & Slide — Cửa Sổ Lịch Sử",
  description: "Kho bài trình chiếu và sơ đồ tư duy theo Lịch sử lớp 10, 11 và 12.",
};

/** Liên kết chữ trong thẻ bài giảng — thẻ nền `surface` nên vòng focus lệch nền theo. */
const LIEN_KET_TRONG_THE =
  "rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

export default async function BaiGiangPage() {
  const shelves = await readShelfList();
  const bai = await readBaiGiang();
  const theoLop = nhomTheoLop(bai);
  // `nhomTheoLop` cố ý giữ đủ ba khối kể cả khối rỗng — nó không biết trang này vẽ ra
  // sao. Trang thì biết: một khối rỗng không đáng nguyên một tiêu đề `headline-md` cộng
  // một câu "chưa có bài giảng nào" riêng. Hai khối rỗng như thế từng ăn gần nửa trang.
  const coBai = theoLop.filter((nhom) => nhom.bai.length > 0);
  const lopTrong = theoLop.filter((nhom) => nhom.bai.length === 0).map((nhom) => nhom.lop);

  return (
    <>
      <Header activeHref="/bai-giang" shelves={shelves} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <div className="mx-auto max-w-5xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Thư viện</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">
            Bài giảng &amp; sơ đồ tư duy
          </h1>
          <p className="mt-sm max-w-measure font-body text-body-md text-secondary">
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

          {coBai.map(({ lop, bai: baiCuaLop }) => (
            <section key={lop} className="mt-xl" aria-labelledby={`lop-${lop}`}>
              <div className="flex items-baseline justify-between gap-md border-b border-surface-locked pb-sm">
                <h2 id={`lop-${lop}`} className="font-heading text-headline-md text-primary-dark">
                  Lịch sử lớp {lop}
                </h2>
                <span className="font-body text-body-sm text-secondary">
                  {baiCuaLop.length} bài
                </span>
              </div>

              {/* `items-start`: nội dung hai thẻ cạnh nhau lệch hẳn nhau (một thẻ có ảnh
                  xem trước, thẻ kia không có tệp nào), mà `align-items: stretch` mặc định
                  của CSS Grid lại sơn nền `surface` xuống hết chiều cao thẻ cao nhất —
                  348px giấy trống đọc ra là "trang hỏng" chứ không phải "bài này ngắn". */}
              <ul className="mt-md grid items-start gap-md sm:grid-cols-2">
                {baiCuaLop.map((b) => (
                  // `id` để màn "đọc xong một quyển" nhảy thẳng tới đúng bài — xem
                  // liên kết chéo trong `ItemDropOverlay`.
                  <li
                    key={b.slug}
                    id={`bai-${b.slug}`}
                    className="scroll-mt-[calc(theme(spacing.header-height)+theme(spacing.md))] rounded-md border border-surface-locked bg-surface p-lg"
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

                    {b.slideUrl && (
                      // Hành động chính của cả màn hình này là tải bộ slide, nên nó phải
                      // là một cái NÚT (`button-primary` của DESIGN.md), không phải một
                      // dòng gạch chân trông y hệt dòng metadata ngay dưới nó.
                      //
                      // `<a>` thường chứ không `<Link>`: đây là một lượt tải tệp, không
                      // phải điều hướng trong ứng dụng. Prefetch của Link sẽ kéo cả bộ
                      // slide về trong nền.
                      <div className="mt-md">
                        <a href={b.slideUrl} className={PRIMARY_BUTTON}>
                          <Download aria-hidden className="h-4 w-4" />
                          Tải slide{b.slideFilename ? ` (${b.slideFilename})` : ""}
                        </a>
                      </div>
                    )}

                    {b.mindmapUrl && (
                      // Sơ đồ tư duy là một nửa lời hứa của tiêu đề trang, nhưng trước đây
                      // nó chỉ là một liên kết đá học sinh ra khỏi ứng dụng tới một tệp ảnh
                      // thô — không tiêu đề, không ghi công. `<details>` của trình duyệt mở
                      // nó ngay trong thẻ, không tốn một dòng JS nào và đã sẵn aria-expanded.
                      //
                      // `<GhiCongAnh>` đi kèm là BẮT BUỘC, không phải trang trí: ràng buộc
                      // `lessons_mindmap_credit_ck` (db/schema/14-learning-hub.sql) ép có
                      // nguồn + dòng ghi công cho đúng điều kiện BY của CC BY-SA. Cưỡng chế
                      // ở tầng dữ liệu mà rơi ở tầng hiển thị thì không cưỡng chế được gì.
                      <details className="mt-md">
                        <summary
                          className={`inline-flex cursor-pointer list-none items-center gap-xs font-body text-body-sm text-tertiary-deep ${LIEN_KET_TRONG_THE}`}
                        >
                          <Network aria-hidden className="h-4 w-4" />
                          Xem sơ đồ tư duy
                        </summary>
                        <figure className="mt-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nằm trong bảng `media`, phục vụ qua /media/[id] chứ không qua loader của next/image */}
                          <img
                            src={b.mindmapUrl}
                            alt={`Sơ đồ tư duy “${b.title}”`}
                            className="w-full rounded-sm border border-surface-locked"
                          />
                          <GhiCongAnh
                            credit={b.mindmapCredit}
                            nguon={b.mindmapSource}
                            nhan="Sơ đồ"
                            className="mt-xs font-body text-caption text-secondary"
                          />
                        </figure>
                      </details>
                    )}

                    {b.sach && (
                      <p className="mt-md font-body text-caption text-secondary">
                        Gắn với quyển{" "}
                        <Link href={`/${b.sach.shelfSlug}`} className={LIEN_KET_TRONG_THE}>
                          “{b.sach.title}”
                        </Link>
                      </p>
                    )}

                    {!b.slideUrl && !b.mindmapUrl && (
                      <p className="mt-md font-body text-caption text-secondary">
                        Bài này chưa có tệp nào để tải.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {bai.length > 0 && lopTrong.length > 0 && (
            <p className="mt-xl font-body text-body-sm text-secondary">
              Lớp {lopTrong.join(", ")} chưa có bài giảng nào — bọn mình đang soạn tiếp.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
