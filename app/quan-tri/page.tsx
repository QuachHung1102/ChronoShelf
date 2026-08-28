import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { ShelfAdmin } from "@/components/admin/ShelfAdmin";
import { listShelves } from "@/lib/admin/shelves";

export const metadata: Metadata = { title: "Quản trị kệ sách — Cửa Sổ Lịch Sử" };

// Đọc phiên đăng nhập từ cookie nên không prerender được.
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const shelves = await listShelves();

  return (
    <AdminGate>
      <AdminShell
        title="Kệ sách"
        description="Tạo kệ, đổi thứ tự và xuất bản. Thay đổi hiện ra với học sinh ngay khi bạn xuất bản — không cần build lại."
      >
        <ShelfAdmin shelves={shelves} />
      </AdminShell>
    </AdminGate>
  );
}
