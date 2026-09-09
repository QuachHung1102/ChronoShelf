import type { Metadata } from "next";
import { Manrope, Lexend } from "next/font/google";
import { Rail } from "@/components/Rail";
import "./globals.css";

// `vietnamese` là subset BẮT BUỘC, không phải tối ưu hoá: thiếu nó thì mọi chữ có dấu rơi
// về font hệ thống và cả trang gãy làm hai kiểu chữ. Cả hai face đã được ĐO là có khối
// `U+1EA0-1EF9` trong CSS Google Fonts trả về — phép đo đó loại Jost, Questrial, Poppins,
// Urbanist, Karla, Rubik, Figtree, Bodoni Moda, Instrument Serif và Bebas Neue.
const manrope = Manrope({
  variable: "--font-ui",
  subsets: ["latin", "vietnamese"],
  // 200 là weight của tiêu đề lớn (DESIGN.md § Typography: "to mà nhẹ là cách một chậu mực
  // nói"). Không khai nó ở đây thì next/font chỉ nạp 400/700 và `display-xl` sẽ được trình
  // duyệt giả lập bằng cách làm mảnh chữ 400 — trông sai và không ai báo.
  weight: ["200", "300", "400", "500", "600", "700"],
});

const lexend = Lexend({
  variable: "--font-reading",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500"],
});

/**
 * BẮT BUỘC, và lý do là một lỗi đã đo được chứ không phải phòng xa.
 *
 * Rail ở layout đọc cookie phiên (`isAdmin()`) và đọc database (`readShelfList()`). Next
 * báo hiệu "trang này không prerender được" bằng cách NÉM một exception riêng, mà `Rail`
 * lại bọc cả hai lời gọi trong `.catch()` để một cú nấc database không giết cả site — nên
 * tín hiệu bailout bị nuốt, Next tưởng mọi thứ ổn, tiếp tục prerender và `next build` chết
 * ở `/dang-nhap` với "Error occurred prerendering page".
 *
 * Khai `force-dynamic` ở đây bỏ luôn bước prerender, nên không còn tín hiệu nào để nuốt.
 * Áp cho cả cây là đúng: 22 route đã tự khai `force-dynamic`, phần còn lại vốn đã động vì
 * đọc cookie hoặc searchParams. Không route nào của sản phẩm này tĩnh được.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cửa Sổ Lịch Sử",
  description:
    "Nền tảng học lịch sử trực quan: mỗi bài học là một quyển sách, đọc xong nhận vật phẩm mở khóa quyển tiếp theo.",
};

/**
 * Rail dựng ở ĐÂY, không ở từng trang.
 *
 * Root layout được Next giữ nguyên qua mọi lần điều hướng con, nên rail không bị tháo ra
 * dựng lại — đó là cách sửa cú giật khi chuyển trang, và nó cũng bỏ luôn hai request thừa
 * (`/api/me/state`, `/api/auth/me`) mà `RailStats` và `AuthMenu` phải gọi lại sau mỗi lần
 * remount. Layout vì thế là async.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${manrope.variable} ${lexend.variable} h-full antialiased`}>
      <body className="flex min-h-full bg-paper font-ui text-primary">
        {/*
          IMPECCABLE DIRECTION CONTRACT — seed d2403d73 (direction roll, mode: experience)
          THESIS: History is ink spreading through water, not books on a shelf. This surface
          refuses the wood-and-parchment library the category (and this product's own former
          self) always ships. FORM: "shallow basin of suminagashi ink" — a dealt challenger the
          user picked over the roll's assigned card; grounded list ranked it outside, the user's
          pin beats the roll.
          OWN-WORLD: paper-white water ground (#F6F7F9), indigo sumi ink (#0A1A33) as the only
          structural pigment, vermilion seal (#B3311C) used twice, 1px hairlines, no shadows,
          Manrope 200 at display sizes, Lexend for lesson prose, a 232px vertical rail.
          STORY: the learner sees which drop is newest and still moving, reads it, and watches
          the water it dyed settle under a seal.
          FIRST VIEWPORT: rail left; lesson list right; the newest unlocked lesson is the darkest,
          only-moving region; real GPU fluid, never a gradient imitation.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
          review, the verdict, and DESIGN.md.
        */}
        {/* Bỏ qua thanh điều hướng. Rail có số mục ĐỘNG — admin tạo thêm kệ là thêm một lần
            Tab cho mọi người dùng bàn phím — nên số phím phải bấm để tới nội dung chỉ có tăng.
            `focus:fixed` chứ không `focus:absolute`: `<body>` không có `position` nên
            `absolute` neo vào đầu TÀI LIỆU, tức khi đã cuộn thì link hiện ra ngoài khung nhìn. */}
        <a
          href="#noi-dung"
          className="sr-only rounded-md bg-primary px-md py-sm font-ui text-label-md text-on-ink focus:not-sr-only focus:fixed focus:left-sm focus:top-sm focus:z-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-on-ink"
        >
          Tới nội dung chính
        </a>
        <Rail />
        {children}
      </body>
    </html>
  );
}
