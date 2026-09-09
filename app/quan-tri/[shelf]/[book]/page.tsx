import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { QuestionAdmin } from "@/components/admin/QuestionAdmin";
import { listPages, readBookHeader } from "@/lib/admin/pages";
import { listQuestions } from "@/lib/admin/questions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/quan-tri/[shelf]/[book]">): Promise<Metadata> {
  const p = await params;
  const book = await readBookHeader(p.shelf, p.book);
  return { title: book ? `Soạn “${book.title}” — Quản trị` : "Không tìm thấy quyển sách" };
}

export default async function AdminBookPagesPage({
  params,
}: PageProps<"/quan-tri/[shelf]/[book]">) {
  const { shelf: shelfSlug, book: bookSlug } = await params;

  // `readBookHeader` đòi quyển phải thuộc ĐÚNG kệ trong URL, nên không ai ghép được một
  // đường dẫn kiểu /quan-tri/ke-A/sach-cua-ke-B để lách breadcrumb.
  const book = await readBookHeader(shelfSlug, bookSlug);
  if (!book) notFound();

  // Tuần tự chứ không `Promise.all`: cả hai đi qua `withRole`, mỗi cái một transaction
  // Sequelize, và hai truy vấn song song trên cùng một connection sẽ chồng lên nhau —
  // bẫy đã ghi ở CLAUDE.md.
  const pages = await listPages(bookSlug);
  const questions = await listQuestions(bookSlug);

  return (
    <AdminGate>
      <AdminShell
        section="/quan-tri"
        title={book.title}
        description={
          book.published
            ? `${book.era} · đang xuất bản — sửa trang là học sinh thấy ngay.`
            : `${book.era} · còn nháp.`
        }
        crumbs={[
          { label: book.shelfName, href: `/quan-tri/${book.shelfSlug}` },
          { label: "Soạn trang" },
        ]}
      >
        <PageAdmin book={book} pages={pages} />
        {/* Bài kiểm tra nằm SAU danh sách trang, đúng thứ tự học sinh gặp: lật hết trang
            rồi mới tới câu hỏi. Đường kẻ tách hai phần vì chúng là hai loại nội dung
            khác nhau, không phải phần tiếp theo của cùng một danh sách. */}
        <div className="mt-xl border-t border-mist pt-xl">
          <QuestionAdmin book={book} questions={questions} />
        </div>
      </AdminShell>
    </AdminGate>
  );
}
