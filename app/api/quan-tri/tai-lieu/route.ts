import crypto from "node:crypto";
import { QueryTypes } from "sequelize";
import { requireAdmin } from "@/lib/admin/gate";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { laGoiZip, PPTX_MIME } from "@/lib/media/sniff";
import { fail, ok } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** 25 MiB — trần khớp `documents_byte_len_check` trong `db/schema/14-learning-hub.sql`. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * POST /api/quan-tri/tai-lieu — nhận một bộ slide `.pptx`, trả `{ url, filename }`.
 *
 * Cùng khuôn và cùng ba lý do như `/api/quan-tri/anh` (trần kích thước riêng thay vì nới
 * `serverActions.bodySizeLimit` toàn cục; không xếp hàng sau Server Action; không phải sửa
 * `next.config.ts`), nên chỗ nào lệch nhau ở đây đều là cố ý:
 *
 *  - Trần 25 MiB thay vì 2 MiB.
 *  - Phép sniff chỉ khẳng định "là gói ZIP" — xem `laGoiZip()` để biết vì sao dừng ở đó.
 *  - Có giữ TÊN TỆP, vì người tải về cần một cái tên đọc được. Tên này KHÔNG BAO GIỜ chạm
 *    tới đường dẫn nào: định danh vẫn là sha256 do máy chủ tự tính.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return fail("Chỉ quản trị viên mới tải tài liệu lên.", 403);
  }

  // Bù cho việc Route Handler không có lớp kiểm CSRF của Server Action. `sameSite=lax` đã
  // chặn phần lớn; đây là lớp hai.
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      return fail("Origin không hợp lệ.", 403);
    }
    if (originHost !== host) return fail("Yêu cầu đến từ nguồn khác.", 403);
  }

  // Cổng kích thước THỨ NHẤT: chặn theo `content-length` TRƯỚC khi gọi `formData()`, vì
  // hàm đó nạp cả body vào RAM. Thiếu header hoặc header rác đều là KHÔNG HỢP LỆ, không
  // phải bằng 0 — nếu không thì bỏ header đi là vô hiệu hóa cổng này.
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) {
    return fail("Yêu cầu phải khai báo Content-Length.", 411);
  }
  if (declared > MAX_BYTES * 1.1) {
    return fail(`Tệp quá lớn. Tối đa ${MAX_BYTES / 1024 / 1024} MB.`, 413);
  }

  let file: unknown;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("Không đọc được dữ liệu tải lên.", 400);
  }
  if (!(file instanceof File)) return fail("Thiếu tệp slide.");

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Cổng kích thước THỨ HAI, sau khi đọc thật: `content-length` là header của client.
  if (bytes.byteLength === 0) return fail("Tệp rỗng.");
  if (bytes.byteLength > MAX_BYTES) {
    return fail(`Tệp quá lớn. Tối đa ${MAX_BYTES / 1024 / 1024} MB.`, 413);
  }

  if (!laGoiZip(bytes)) {
    return fail("Tệp này không phải bộ trình chiếu .pptx.", 415);
  }

  // Tên tệp đi thẳng vào header `Content-Disposition` lúc tải về, nên làm sạch ở ĐÂY chứ
  // không phải ở đó: bỏ mọi thành phần đường dẫn (tên client gửi lên có thể là
  // `../../etc/passwd`), bỏ ký tự điều khiển, dấu nháy kép và gạch chéo ngược — đúng bộ mà
  // `documents_filename_check` cấm, nên câu lệnh không bao giờ đâm vào ràng buộc đó.
  const filename =
    (file.name.split(/[\\/]/).pop() ?? "")
      .replace(/[\u0000-\u001f\u007f"\\]/g, "")
      .trim()
      .slice(0, 200) || "bai-giang.pptx";

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const userId = await requireAdmin();
  const daLuu = await withRole(userId, async (t) => {
    // Địa chỉ hóa theo nội dung: cùng byte = cùng dòng. Tải lại đúng tệp cũ là không-op.
    // `DO NOTHING` giữ nguyên tên của lần tải đầu — bảng chỉ-ghi-thêm, không sửa được.
    await sequelize.query(
      `INSERT INTO public.documents (sha256, mime, filename, bytes, byte_len)
            VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sha256) DO NOTHING`,
      {
        bind: [sha256, PPTX_MIME, filename, Buffer.from(bytes), bytes.byteLength],
        transaction: t,
        type: QueryTypes.INSERT,
      },
    );

    // Đọc lại tên ĐÃ LƯU thay vì vọng lại tên vừa gửi lên. Khi đụng `DO NOTHING`, hai tên
    // đó KHÁC nhau — và `/tai-lieu/[id]` phục vụ tên trong bảng, nên trả tên mới về cho
    // form là để admin thấy một tên rồi tải về ra tên khác. Đã gặp thật lúc kiểm bằng
    // trình duyệt: tải lại cùng nội dung dưới tên tiếng Việt, header vẫn trả tên cũ.
    // Cùng transaction nên phải TUẦN TỰ — `Promise.all` trên một transaction Sequelize
    // gửi hai câu lệnh chồng lên nhau trên một connection và hỏng.
    const rows = await sequelize.query<{ filename: string }>(
      "SELECT filename FROM public.documents WHERE sha256 = $1",
      { bind: [sha256], transaction: t, type: QueryTypes.SELECT },
    );
    return rows[0]?.filename ?? filename;
  });

  return ok({ url: `/tai-lieu/${sha256}`, sha256, filename: daLuu, bytes: bytes.byteLength });
}
