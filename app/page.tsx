import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { readShelfList } from "@/lib/content/read";

// Bản đồ thế giới thay chỗ trang này ở chặng D. Tạm thời: lối vào các kệ đang có.
export default async function Home() {
  const shelves = await readShelfList();

  return (
    <>
      <Header activeHref="/" shelves={shelves} />
      <main className="flex-1 px-page-margin py-xl">
        <p className="font-body text-label-caps uppercase text-tertiary-deep">Cửa sổ lịch sử</p>
        <h1 className="mt-sm max-w-2xl font-heading text-headline-lg text-primary-dark">
          Mỗi bài học là một quyển sách. Đọc xong một quyển, bạn nhận được vật phẩm mở khóa
          quyển tiếp theo.
        </h1>
        <div className="mt-lg flex flex-wrap gap-md">
          {shelves.map((shelf) => (
            <Link
              key={shelf.slug}
              href={`/${shelf.slug}`}
              className="inline-flex items-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
            >
              Vào kệ {shelf.name}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          ))}
        </div>
        {shelves.length === 0 && (
          <p className="mt-lg font-body text-body-md text-secondary">
            Chưa có kệ sách nào được xuất bản.
          </p>
        )}
      </main>
    </>
  );
}
