/**
 * Hình dạng phản hồi chung cho mọi Route Handler.
 *
 * Lỗi luôn là `{ error: string }` với một câu tiếng Việt đọc được — client hiện thẳng
 * nó cho người dùng, nên không được để lọt thông điệp của Postgres ra ngoài: chúng
 * tiết lộ tên bảng, tên policy, tên hàm.
 */

export const ok = <T>(data: T, status = 200): Response =>
  Response.json(data as object, { status });

export const fail = (message: string, status = 400): Response =>
  Response.json({ error: message }, { status });

/** Đọc JSON body; trả `null` khi body không phải object JSON hợp lệ. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Lấy một trường chuỗi đã trim; trả `null` nếu thiếu, sai kiểu, rỗng, hoặc quá dài. */
export function str(
  body: Record<string, unknown> | null,
  key: string,
  maxLength = 320,
): string | null {
  const v = body?.[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  // Chặn độ dài ngay tại biên: không có nó thì một body vài megabyte vẫn đi thẳng
  // xuống database và biến thành một truy vấn rất đắt.
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null;
}
