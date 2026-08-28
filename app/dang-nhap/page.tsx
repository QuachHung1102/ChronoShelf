import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/auth/LoginForm";
import { Room } from "@/components/Room";
import { readShelfList } from "@/lib/content/read";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Đăng nhập — Cửa Sổ Lịch Sử",
};

export default async function DangNhapPage({ searchParams }: PageProps<"/dang-nhap">) {
  const [params, shelves] = await Promise.all([searchParams, readShelfList()]);
  const next = safeNext(params.next);

  return (
    <>
      <Header activeHref="/dang-nhap" shelves={shelves} />
      <main id="noi-dung" className="flex flex-1 flex-col">
        <Room className="flex flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center p-page-margin">
            <LoginForm next={next} />
          </div>
        </Room>
      </main>
    </>
  );
}
