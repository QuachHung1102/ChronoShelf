import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { LessonAdmin } from "@/components/admin/LessonAdmin";
import { listBooksForLesson } from "@/lib/admin/lessons";
import { readBaiGiang } from "@/lib/learning/read";

export const metadata: Metadata = { title: "Quản trị bài giảng — Cửa Sổ Lịch Sử" };

export const dynamic = "force-dynamic";

export default async function AdminLessonsPage() {
  // `readBaiGiang()` đọc dưới danh tính người đang xem, và policy `read published` cho
  // admin thấy cả bản nháp — nên không cần một đường đọc thứ hai cho màn này.
  const bai = await readBaiGiang();
  const sach = await listBooksForLesson();

  return (
    <AdminGate>
      <AdminShell
        section="/quan-tri/bai-giang"
        title="Bài giảng & Slide"
        description="Bộ trình chiếu và sơ đồ tư duy theo Lịch sử lớp 10, 11, 12 — tài nguyên học sinh tải về được."
        crumbs={[{ label: "Bài giảng" }]}
      >
        <LessonAdmin bai={bai} sach={sach} />
      </AdminShell>
    </AdminGate>
  );
}
