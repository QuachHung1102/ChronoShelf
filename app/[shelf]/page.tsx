import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  // Sắc tố của kệ = vị trí của nó trong danh sách, đúng thứ tự rail dùng để tô chấm màu.
  const pigmentIndex = Math.max(0, shelves.findIndex((s) => s.slug === shelf.slug));

  // Chiều cao KHÓA vào khung nhìn, không phải `flex-1`.
  // Đây là màn hình duy nhất trong sản phẩm được thiết kế để không cuộn, và `flex-1`
  // chỉ nói "chiếm hết chỗ còn lại" chứ không nói "đừng lớn hơn thế" — nội dung cao
  // hơn vẫn nong trang ra và sinh thanh cuộn. Khóa ở đây thì vùng cuộn duy nhất là cột
  // danh sách bài học bên trong `ShelfBasin`, và nó đúng như vậy với kệ 4 bài lẫn 40 bài.
  // `min-h-0` để vùng cuộn con thật sự tràn được — thiếu nó, `min-height: auto` mặc
  // định của flex item làm con phình theo nội dung và cả trang cuộn thay.
  return (
    <main id="noi-dung" className="flex h-screen min-h-0 min-w-0 flex-1 flex-col">
      <ShelfPageClient
        shelf={shelf}
        pigmentIndex={pigmentIndex}
        trangThaiBanDau={trangThaiBanDau}
      />
    </main>
  );
}
