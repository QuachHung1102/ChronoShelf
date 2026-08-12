import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { ShelfPageClient } from "@/components/shelf/ShelfPageClient";
import { getShelf } from "@/lib/content/shelves";

const SHELF_SLUG = "lich-su-viet-nam";

export const metadata: Metadata = {
  title: `${getShelf(SHELF_SLUG).name} — Cửa Sổ Lịch Sử`,
};

export default function LichSuVietNamPage() {
  return (
    <>
      <Header activeHref="/lich-su-viet-nam" />
      <main className="flex-1">
        <ShelfPageClient shelfSlug={SHELF_SLUG} />
      </main>
    </>
  );
}
