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
      // Ghi đè fontFamily sinh tự động: component dùng `font-heading` / `font-body`
      // kết hợp với cỡ chữ `text-headline-lg`, `text-body-md`…
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        body: ["var(--font-body)", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
