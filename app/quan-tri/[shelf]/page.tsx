import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { BookAdmin } from "@/components/admin/BookAdmin";
import { listBooks, readShelfHeader } from "@/lib/admin/books";
import { listItems } from "@/lib/admin/items";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/quan-tri/[shelf]">): Promise<Metadata> {
  const shelf = await readShelfHeader((await params).shelf);
  return { title: shelf ? `${shelf.name} — Quản trị` : "Không tìm thấy kệ" };
}

export default async function AdminShelfBooksPage({ params }: PageProps<"/quan-tri/[shelf]">) {
  const shelfSlug = (await params).shelf;

  const shelf = await readShelfHeader(shelfSlug);
  // `readShelfHeader` trả null cả khi kệ không tồn tại LẪN khi người xem không phải
  // admin. Ở đây notFound() cho cả hai là đúng — `AdminGate` bên dưới lo màn từ chối,
  // và người không phải admin thì không nên biết kệ nào tồn tại.
  if (!shelf) notFound();

  const [books, items] = await Promise.all([listBooks(shelfSlug), listItems()]);

  return (
    <AdminGate>
      <AdminShell
        section="/quan-tri"
        title={shelf.name}
        description={
          shelf.published
            ? "Kệ này đang xuất bản — thay đổi hiện ra với học sinh ngay."
            : "Kệ này còn ở dạng nháp, học sinh chưa thấy gì."
        }
        crumbs={[{ label: shelf.name }]}
      >
        <BookAdmin shelf={shelf} books={books} items={items} />
      </AdminShell>
    </AdminGate>
  );
}
