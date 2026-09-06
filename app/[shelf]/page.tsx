import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { ShelfPageClient } from "@/components/shelf/ShelfPageClient";
import { readShelf, readShelfList } from "@/lib/content/read";
import { readUserState } from "@/lib/content/user-state";

export async function generateMetadata({ params }: PageProps<"/[shelf]">): Promise<Metadata> {
  const shelf = await readShelf((await params).shelf);
  return { title: shelf ? `${shelf.name} — Cửa Sổ Lịch Sử` : "Không tìm thấy kệ sách" };
}

export default async function ShelfPage({ params }: PageProps<"/[shelf]">) {
  const slug = (await params).shelf;
  // Tuần tự, KHÔNG `Promise.all`: cả ba hàm đều mở transaction Sequelize riêng qua
  // `withRole`, và chồng chúng lên nhau trên cùng một pool là đúng cái bẫy CLAUDE.md ghi.
  const shelf = await readShelf(slug);
  if (!shelf) notFound();
  const shelves = await readShelfList();
  // Trạng thái ban đầu để lần sơn ĐẦU TIÊN đã đúng — xem lib/content/user-state.ts.
  const trangThaiBanDau = await readUserState();

  return (
    <>
      <Header activeHref={`/${shelf.slug}`} shelves={shelves} />
      {/* flex-col để căn phòng (Room) kéo giãn hết chiều cao còn lại của khung nhìn. */}
      <main id="noi-dung" className="flex flex-1 flex-col">
        <ShelfPageClient shelf={shelf} trangThaiBanDau={trangThaiBanDau} />
      </main>
    </>
  );
}
