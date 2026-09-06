export type KetQuaNoiDung = { value: string } | { error: string };
export type LoaiBai = "chia-se" | "cau-hoi";

/**
 * Trần độ dài của bài đăng và bình luận.
 *
 * Ở ĐÂY chứ không rải ba nơi: mỗi con số trước đó xuất hiện ba lần — `maxLength` của ô
 * nhập, câu "Tối đa … ký tự" hiện cho người dùng, và tham số `max` của `docNoiDung`.
 * Bản chép đã từng NÓI DỐI một lần: câu "Tối đa 1.000 ký tự" có mặt trong khi không ô
 * nào chặn (xem chú thích còn lại ở `app/cong-dong/page.tsx`).
 *
 * Ba con số này phải khớp ràng buộc CHECK ở `db/schema/13-community.sql` — database mới
 * là hàng rào thật, hai chỗ kia chỉ để người dùng biết trước khi gõ. Đổi ở đây thì phải
 * đổi cả SQL; `lib/community/validation.test.ts` có một phép so khớp giới hạn với
 * PostgreSQL cho ký tự ngoài BMP.
 */
export const BAI_TOI_DA = 1000;
export const BINH_LUAN_TOI_DA = 500;

export function docLoaiBai(raw: unknown): LoaiBai | null {
  return raw === "chia-se" || raw === "cau-hoi" ? raw : null;
}

export function docNoiDung(raw: unknown, max: number): KetQuaNoiDung {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { error: "Nội dung không được để trống." };
  if ([...value].length > max) {
    return { error: `Nội dung không được vượt quá ${max} ký tự.` };
  }
  return { value };
}
