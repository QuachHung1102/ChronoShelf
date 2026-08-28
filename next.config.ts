import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sequelize nạp dialect bằng `require()` động (`require('./dialects/postgres')`),
  // thứ bundler không lần ra được. `pg` đã nằm sẵn trong danh sách Next tự loại,
  // `sequelize` thì không — phải khai báo tay, nếu không `next build` sẽ hỏng.
  serverExternalPackages: ["sequelize"],
};

export default nextConfig;
