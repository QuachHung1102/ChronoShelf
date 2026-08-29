import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ChevronRight, Sparkles } from "lucide-react";
import { Header } from "@/components/Header";
import { GhiCongAnh } from "@/components/ui/GhiCongAnh";
import s from "@/components/bag/bag.module.scss";
import { readShelfList, readTuiHanhTrang } from "@/lib/content/read";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Túi hành trang — Cửa Sổ Lịch Sử",
};

/**
 * Túi hành trang — tủ kính trưng bày toàn bộ vật phẩm đã sưu tầm (content.md §4.5).
 *
 * Ô của vật phẩm CHƯA có vẫn hiện, dưới dạng bóng mờ: đó là cả điểm của trang này. Một tủ
 * chỉ hiện thứ mình đã có thì không nói được còn bao nhiêu thứ đang chờ.
 *
 * Phần "bấm để xem mô tả" dùng `<details>` chứ không phải state React: đóng/mở, thao tác
 * bàn phím và ngữ nghĩa cho trình đọc màn hình đều có sẵn trong thẻ, 0 dòng JS.
 */
export default async function TuiHanhTrang() {
  // Hai lời gọi TUẦN TỰ, không `Promise.all` — cả hai đều mở transaction Sequelize.
  const shelves = await readShelfList();
  const { vatPham, daDangNhap } = await readTuiHanhTrang();

  const soDaCo = vatPham.filter((v) => v.daCo).length;

  return (
    <>
      <Header activeHref="/tui-hanh-trang" shelves={shelves} />

      <main id="noi-dung" className="flex-1 px-page-margin py-xl">
        <div className="mx-auto max-w-4xl">
          <p className="font-body text-label-caps uppercase text-tertiary-deep">Bộ sưu tập</p>
          <h1 className="mt-sm font-heading text-headline-lg text-primary-dark">Túi hành trang</h1>
          <p className="mt-sm max-w-2xl font-body text-body-md text-secondary">
            {daDangNhap
              ? `Bạn đang giữ ${soDaCo}/${vatPham.length} vật phẩm. Mỗi thứ ở đây là dấu vết của một quyển sách bạn đã đọc xong.`
              : "Đăng nhập để bắt đầu sưu tầm. Mỗi quyển sách đọc xong sẽ thả ra một vật phẩm, và chính nó mở khóa quyển tiếp theo."}
          </p>

          {vatPham.length === 0 ? (
            <p className="mt-lg font-body text-body-md text-secondary">
              Chưa có vật phẩm nào được tạo.
            </p>
          ) : (
            <ul
              className={`${s.tu} mt-lg grid items-start gap-md rounded-md bg-surface-shelf p-lg sm:grid-cols-2 lg:grid-cols-3`}
            >
              {vatPham.map((v) => (
                <li key={v.slug}>
                  <details className={`${s.o} rounded-md bg-surface p-md`}>
                    <summary className="flex items-center gap-md rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-sm bg-surface-locked">
                        {v.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong public/
                          <img
                            src={v.image}
                            alt=""
                            className={`h-12 w-12 object-contain ${v.daCo ? "" : s.bongMo}`}
                          />
                        ) : (
                          <Sparkles
                            aria-hidden
                            className={`h-8 w-8 ${v.daCo ? "text-tertiary-deep" : "text-secondary-light"}`}
                          />
                        )}
                      </span>

                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-heading text-headline-sm text-primary-dark">
                          {v.name}
                        </span>
                        <span
                          className={`font-body text-body-sm ${v.daCo ? "text-tertiary-deep" : "text-secondary"}`}
                        >
                          {v.daCo ? "Đã sưu tầm" : "Chưa có"}
                        </span>
                      </span>

                      <ChevronRight
                        aria-hidden
                        className={`${s.mui} h-5 w-5 shrink-0 text-secondary`}
                      />
                    </summary>

                    <div className="mt-md border-t border-surface-locked pt-md">
                      <p className="font-body text-body-sm text-secondary">{v.description}</p>

                      {v.tuQuyen && (
                        <Link
                          href={`/${v.tuQuyen.shelfSlug}`}
                          className="mt-sm inline-flex items-center gap-xs font-body text-body-sm text-tertiary-deep underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        >
                          <BookOpen aria-hidden className="h-4 w-4" />
                          {v.daCo
                            ? `Từ quyển “${v.tuQuyen.title}”`
                            : `Đọc “${v.tuQuyen.title}” để nhận`}
                        </Link>
                      )}

                      {/* Ghi công ảnh — cùng điều kiện BY như mọi chỗ khác có ảnh. */}
                      {v.image && (
                        <GhiCongAnh
                          credit={v.imageCredit}
                          nguon={v.imageSource}
                          className="mt-sm font-body text-caption text-secondary"
                        />
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
