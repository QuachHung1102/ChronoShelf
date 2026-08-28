import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";

export const dynamic = "force-dynamic";

/** sha256 viết thường, đúng 64 ký tự hex. Không có gì khác lọt qua. */
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * GET /media/<sha256> — phục vụ một ảnh.
 *
 * Đọc bằng role của người CHƯA đăng nhập (`withRole(null, …)`) một cách có chủ ý: ảnh là
 * nội dung công khai, và policy `read media USING (true)` cho phép. Không cần biết ai
 * đang xem để trả một tấm ảnh, nên không hỏi.
 *
 * KHÔNG CÓ path traversal ở đây, và không phải nhờ ta chặn giỏi: định danh là sha256 do
 * server tự tính, không phải tên tệp của client. Regex bên dưới chỉ là chốt cuối.
 */
export async function GET(_req: Request, ctx: RouteContext<"/media/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!SHA256.test(id)) return new Response("Not found", { status: 404 });

  const rows = await withRole(null, (t) =>
    sequelize.query<{ mime: string; bytes: Buffer }>(
      "SELECT mime, bytes FROM public.media WHERE sha256 = $1",
      { bind: [id], transaction: t, type: QueryTypes.SELECT },
    ),
  );

  const row = rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      // Kiểu này là kiểu SNIFF ĐƯỢC lúc tải lên, không phải kiểu client khai.
      "Content-Type": row.mime,
      // `immutable` đúng THEO CẤU TẠO chứ không theo lời hứa: đổi byte là đổi sha256, nên
      // nội dung tại một URL không thể đổi. Bảng `media` chỉ có GRANT INSERT (không
      // UPDATE/DELETE) chính là thứ giữ cho câu này khỏi thành nói dối — `90-verify.sql`
      // khẳng định lại điều đó.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Chặn trình duyệt tự đoán kiểu khác với kiểu ta khai. Cùng với việc SVG không bao
      // giờ vào được bảng, đây là hai lớp chống thực thi nội dung tải lên.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
