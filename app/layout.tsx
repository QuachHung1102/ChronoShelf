import type { Metadata } from "next";
import { Playfair_Display, Lora } from "next/font/google";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
});

const lora = Lora({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Cửa Sổ Lịch Sử",
  description:
    "Nền tảng học lịch sử trực quan: mỗi bài học là một quyển sách, đọc xong nhận vật phẩm mở khóa quyển tiếp theo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${playfairDisplay.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral font-body text-primary-dark">
        {children}
      </body>
    </html>
  );
}
