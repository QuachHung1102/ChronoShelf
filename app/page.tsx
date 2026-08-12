import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";

// Trang chủ thật (timeline "Ngày ấy – Bây giờ") là subsystem riêng, chưa tới lượt.
// Chỗ này chỉ là lối vào kệ sách đang có.
export default function Home() {
  return (
    <>
      <Header activeHref="/" />
      <main className="flex-1 px-page-margin py-xl">
        <p className="font-body text-label-caps uppercase text-tertiary-deep">Cửa sổ lịch sử</p>
        <h1 className="mt-sm max-w-2xl font-heading text-headline-lg text-primary-dark">
          Mỗi bài học là một quyển sách. Đọc xong một quyển, bạn nhận được vật phẩm mở khóa
          quyển tiếp theo.
        </h1>
        <Link
          href="/lich-su-viet-nam"
          className="mt-lg inline-flex items-center gap-sm rounded-full bg-tertiary-deep px-lg py-sm font-body text-label-md text-on-primary transition duration-200 ease-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-neutral"
        >
          Vào kệ Lịch sử Việt Nam
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </main>
    </>
  );
}
