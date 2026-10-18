import Link from "next/link";
import type { Metadata } from "next";
import { Download, FileText, Network } from "lucide-react";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/controls";
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
  const bai = await readBaiGiang();
  const theoLop = nhomTheoLop(bai);
  // `nhomTheoLop` cố ý giữ đủ ba khối kể cả khối rỗng — nó không biết trang này vẽ ra
  // sao. Trang thì biết: một khối rỗng không đáng nguyên một tiêu đề `headline-md` cộng
  // một câu "chưa có bài giảng nào" riêng. Hai khối rỗng như thế từng ăn gần nửa trang.
  const coBai = theoLop.filter((nhom) => nhom.bai.length > 0);
  const lopTrong = theoLop.filter((nhom) => nhom.bai.length === 0).map((nhom) => nhom.lop);

  return (
    <main id="noi-dung" className="min-w-0 flex-1 px-page-margin py-xl">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-mist pb-2xl pt-md">
          <p className="font-ui text-label-caps uppercase text-son">Thư viện</p>
          <h1 className="mt-md text-balance font-ui text-display-xl text-primary">
            Bài giảng &amp; sơ đồ tư duy
          </h1>
          <p className="mt-lg max-w-measure text-pretty font-ui text-body-md text-ink-dilute">
            Bộ slide soạn sẵn để làm bài thuyết trình nhóm, và sơ đồ tư duy tóm tắt từng
            chương để ôn tập. Tải về miễn phí.
          </p>
        </header>

        {bai.length === 0 && (
          <div className={`mt-xl ${CARD}`}>
            <FileText aria-hidden className="h-8 w-8 text-son" />
            <p className="mt-sm font-ui text-title-md text-primary">
              Thư viện đang được soạn
            </p>
            <p className="mt-xs font-ui text-body-sm text-ink-dilute">
              Chưa có bài giảng nào được xuất bản. Quay lại sau nhé.
            </p>
          </div>
        )}

        {coBai.map(({ lop, bai: baiCuaLop }) => (
          <section key={lop} className="mt-2xl" aria-labelledby={`lop-${lop}`}>
            <div className="flex items-baseline justify-between gap-md">
              <h2 id={`lop-${lop}`} className="font-ui text-display-md text-primary">
                Lịch sử lớp {lop}
              </h2>
              <span className="font-ui text-body-sm text-ink-dilute">
                {baiCuaLop.length} bài
              </span>
            </div>

            {/* `items-start`: nội dung hai thẻ cạnh nhau lệch hẳn nhau (một thẻ có ảnh
                xem trước, thẻ kia không có tệp nào), mà `align-items: stretch` mặc định
                của CSS Grid lại sơn nền `surface` xuống hết chiều cao thẻ cao nhất —
                348px giấy trống đọc ra là "trang hỏng" chứ không phải "bài này ngắn". */}
            <ul className="mt-lg grid items-start gap-lg sm:grid-cols-2">
              {baiCuaLop.map((b) => (
                // `id` để màn "đọc xong một quyển" nhảy thẳng tới đúng bài — xem
                // liên kết chéo trong `ItemDropOverlay`.
                <li
                  key={b.slug}
                  id={`bai-${b.slug}`}
                  className="scroll-mt-lg overflow-hidden rounded-md border border-mist bg-surface"
                >
                  {/* Ảnh tràn mép trên thẻ. Bài chưa có ảnh thì là khối mực đặc mang số
                      lớp — cùng ngữ pháp với bìa sách thiếu ảnh, không để một ô xám rỗng. */}
                  {b.previewUrl ? (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nằm trong bảng `media`, phục vụ qua /media/[id] chứ không qua loader của next/image */}
                      <img
                        src={b.previewUrl}
                        alt={`Ảnh minh họa bài "${b.title}"`}
                        className="aspect-[16/9] w-full object-cover"
                      />
                      <GhiCongAnh
                        credit={b.previewCredit}
                        nguon={b.previewSource}
                        className="break-words px-lg pt-xs text-ink-dilute"
                      />
                    </figure>
                  ) : (
                    <div aria-hidden className="flex aspect-[16/9] items-end bg-primary p-lg">
                      <span className="font-ui text-display-lg text-on-ink">Lớp {lop}</span>
                    </div>
                  )}
                  <div className="p-lg">
                    <h3 className="text-balance font-ui text-title-md text-primary">
                      {b.title}
                      {!b.published && (
                        // Người thường không bao giờ thấy nhánh này: policy `read
                        // published` đã lọc. Nó chỉ hiện cho admin đang xem trang công
                        // khai, để khỏi tưởng bài nháp đã ra mắt.
                        <span className="ml-sm align-middle font-ui text-caption text-son">
                          (nháp)
                        </span>
                      )}
                    </h3>

                    {b.summary && (
                      <p className="mt-xs font-ui text-body-sm text-ink-dilute">{b.summary}</p>
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
                          Tải slide
                        </a>
                        {/* Tên tệp là METADATA, không phải nhãn nút. Nó từng nằm trong
                            nhãn (`Tải slide (…)`), mà trần dữ liệu là 200 ký tự — đủ để
                            một viên thuốc `rounded-full` quấn 2–4 dòng, và đủ để tên trợ
                            năng của nút thành một chuỗi rác. `break-words` vì tên tệp có
                            thể không có khoảng trắng nào. */}
                        {b.slideFilename && (
                          <p className="mt-xs break-words font-ui text-caption text-ink-dilute">
                            {b.slideFilename}
                          </p>
                        )}
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
                          className={`inline-flex cursor-pointer list-none items-center gap-xs font-ui text-body-sm text-son ${LIEN_KET_TRONG_THE}`}
                        >
                          <Network aria-hidden className="h-4 w-4" />
                          Xem sơ đồ tư duy
                        </summary>
                        <figure className="mt-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nằm trong bảng `media`, phục vụ qua /media/[id] chứ không qua loader của next/image */}
                          <img
                            src={b.mindmapUrl}
                            alt={`Sơ đồ tư duy “${b.title}”`}
                            className="w-full rounded-sm border border-ink-dilute"
                          />
                          <GhiCongAnh
                            credit={b.mindmapCredit}
                            nguon={b.mindmapSource}
                            nhan="Sơ đồ"
                            className="mt-xs text-ink-dilute"
                          />
                        </figure>
                      </details>
                    )}

                    {b.sach && (
                      <p className="mt-md font-ui text-caption text-ink-dilute">
                        Gắn với quyển{" "}
                        <Link href={`/${b.sach.shelfSlug}`} className={LIEN_KET_TRONG_THE}>
                          “{b.sach.title}”
                        </Link>
                      </p>
                    )}

                    {!b.slideUrl && !b.mindmapUrl && (
                      <p className="mt-md font-ui text-caption text-ink-dilute">
                        Bài này chưa có tệp nào để tải.
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {bai.length > 0 && lopTrong.length > 0 && (
          <p className="mt-xl font-ui text-body-sm text-ink-dilute">
            Lớp {lopTrong.join(", ")} chưa có bài giảng nào — bọn mình đang soạn tiếp.
          </p>
        )}
      </div>
    </main>
  );
}
