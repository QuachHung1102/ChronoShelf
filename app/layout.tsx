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
        {/* Bỏ qua thanh điều hướng. Header có số mục ĐỘNG — admin tạo thêm kệ là thêm một
            lần Tab cho mọi người dùng bàn phím — nên số phím phải bấm để tới nội dung chỉ
            có tăng. Link chỉ hiện ra khi được focus. */}
        <a
          href="#noi-dung"
          className="sr-only rounded-sm bg-surface px-md py-sm font-body text-label-md text-primary-dark focus:not-sr-only focus:absolute focus:left-sm focus:top-sm focus:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tới nội dung chính
        </a>
        {children}
      </body>
    </html>
  );
}
