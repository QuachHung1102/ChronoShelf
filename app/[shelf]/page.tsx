import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ShelfPageClient } from "@/components/shelf/ShelfPageClient";
import { readShelf, readShelfList } from "@/lib/content/read";

export async function generateMetadata({ params }: PageProps<"/[shelf]">): Promise<Metadata> {
  const shelf = await readShelf((await params).shelf);
  return { title: shelf ? `${shelf.name} — Cửa Sổ Lịch Sử` : "Không tìm thấy kệ sách" };
}

export default async function ShelfPage({ params }: PageProps<"/[shelf]">) {
  const slug = (await params).shelf;
  const [shelf, shelves] = await Promise.all([readShelf(slug), readShelfList()]);
  if (!shelf) notFound();

  return (
    <>
      <Header activeHref={`/${shelf.slug}`} shelves={shelves} />
      {/* flex-col để căn phòng (Room) kéo giãn hết chiều cao còn lại của khung nhìn. */}
      <main id="noi-dung" className="flex flex-1 flex-col">
        <ShelfPageClient shelf={shelf} />
      </main>
    </>
  );
}
