import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";

export const dynamic = "force-dynamic";

/** sha256 viết thường, đúng 64 ký tự hex. Không có gì khác lọt qua. */
const SHA256 = /^[0-9a-f]{64}$/;

/**
 * Bản chỉ-ASCII của tên tệp, cho tham số `filename=` của Content-Disposition.
 * Giữ đúng dải in được của ASCII (0x20–0x7e), rồi bỏ nốt `"` và `\` vì chúng kết thúc
 * chuỗi trong ngoặc kép của header.
 */
const tenAscii = (ten: string): string =>
  ten.replace(/[^\u0020-\u007e]/g, "_").replace(/["\\]/g, "") || "bai-giang.pptx";

/**
 * GET /tai-lieu/<sha256> — tải một bộ slide về.
 *
 * Đọc bằng role của người CHƯA đăng nhập một cách có chủ ý: `content.md` §7 nói slide
 * "tải về miễn phí", nên bắt đăng nhập mới tải được là đổi hẳn ý nghĩa đó.
 *
 * KHÔNG CÓ path traversal, và không phải nhờ ta chặn giỏi: định danh là sha256 do máy chủ
 * tự tính, không phải tên tệp của client. Regex bên dưới chỉ là chốt cuối.
 */
export async function GET(_req: Request, ctx: RouteContext<"/tai-lieu/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!SHA256.test(id)) return new Response("Not found", { status: 404 });

  const rows = await withRole(null, (t) =>
    sequelize.query<{ mime: string; filename: string; bytes: Buffer }>(
      "SELECT mime, filename, bytes FROM public.documents WHERE sha256 = $1",
      { bind: [id], transaction: t, type: QueryTypes.SELECT },
    ),
  );

  const row = rows[0];
  if (!row) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      // `immutable` đúng THEO CẤU TẠO: đổi byte là đổi sha256, và `documents` chỉ có GRANT
      // INSERT (không UPDATE/DELETE) nên nội dung tại một URL không thể đổi.
      // `90-verify.sql` khối H khẳng định lại điều đó.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // `attachment` chứ không `inline`: file này không bao giờ được chạy trong ngữ cảnh
      // trang. Đó cũng là lý do phép sniff lúc tải lên chỉ cần khẳng định "là gói ZIP".
      //
      // HAI dạng tên, và cả hai đều cần thiết:
      //
      // `filename=` chỉ được chứa ASCII — giá trị header đi qua undici, và một ký tự
      // ngoài Latin-1 làm chính `new Response()` NÉM, tức route chết chứ không phải tải
      // về sai tên. Tên bài giảng tiếng Việt gần như chắc chắn có dấu, nên bản ASCII phải
      // được lọc ở đây; `filename*` dạng RFC 5987 mới là bản đủ dấu mà trình duyệt dùng.
      //
      // Tên đã được làm sạch LÚC TẢI LÊN (bỏ đường dẫn, ký tự điều khiển, `"`, `\`) và
      // `documents_filename_check` cưỡng chế lại ở tầng DB, nên không tách được header.
      "Content-Disposition":
        `attachment; filename="${tenAscii(row.filename)}"; ` +
        `filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    },
  });
}
