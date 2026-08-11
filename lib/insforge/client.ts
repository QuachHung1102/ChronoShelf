import { createClient } from "@insforge/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

if (!baseUrl || !anonKey) {
  throw new Error(
    "Thiếu NEXT_PUBLIC_INSFORGE_BASE_URL hoặc NEXT_PUBLIC_INSFORGE_ANON_KEY. " +
      "Tạo .env.local theo hướng dẫn trong docs/superpowers/plans/.",
  );
}

export const insforge = createClient({ baseUrl, anonKey });
