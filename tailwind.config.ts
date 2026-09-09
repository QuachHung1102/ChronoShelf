import type { Config } from "tailwindcss";
import designTheme from "./tailwind.theme.json";

// Token nguồn nằm ở DESIGN.md. tailwind.theme.json được sinh ra bằng
// `npm run design:build` — đừng sửa nó bằng tay.
// Cast vì import JSON làm tuple fontSize bị nới thành array; cấu trúc đã được
// `npm run design:lint` bảo đảm.
type ThemeExtend = NonNullable<NonNullable<Config["theme"]>["extend"]>;
const generated = designTheme.theme.extend as unknown as ThemeExtend;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...generated,
      // Ghi đè fontFamily sinh tự động. `designmd` sinh một khóa fontFamily cho TỪNG bậc
      // chữ (`display-xl`, `reading`…), tức `font-display-xl` — nhưng cỡ chữ đã đi qua
      // `text-display-xl` rồi, nên hai lớp đó chồng nhau. Hai bí danh dưới đây là thứ
      // component thật sự dùng: `font-ui` cho giao diện, `font-reading` cho văn xuôi bài học.
      //
      // Hai face vào hệ vì hai lý do khác nhau, xem DESIGN.md § Typography: Manrope là sans
      // humanist yên tĩnh mà grammar của chậu mực quy định; Lexend được thiết kế và đo cho
      // TỐC ĐỘ ĐỌC, và người đọc ở đây là học sinh phổ thông đọc hàng nghìn chữ lịch sử.
      // Cả hai đã được đo là có đủ dấu tiếng Việt.
      fontFamily: {
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        reading: ["var(--font-reading)", "var(--font-ui)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
