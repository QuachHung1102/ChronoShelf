import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminShell } from "@/components/admin/AdminShell";
import { ItemAdmin } from "@/components/admin/ItemAdmin";
import { listItems } from "@/lib/admin/items";

export const metadata: Metadata = { title: "Quản trị vật phẩm — Cửa Sổ Lịch Sử" };

export const dynamic = "force-dynamic";

export default async function AdminItemsPage() {
  const items = await listItems();

  return (
    <AdminGate>
      <AdminShell
        section="/quan-tri/vat-pham"
        title="Vật phẩm"
        description="Phần thưởng khi đọc xong một quyển sách — và cũng là thứ mở khóa quyển kế tiếp."
        crumbs={[{ label: "Vật phẩm" }]}
      >
        <ItemAdmin items={items} />
      </AdminShell>
    </AdminGate>
  );
}
