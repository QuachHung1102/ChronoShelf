import crypto from "node:crypto";
import { QueryTypes } from "sequelize";
import { requireAdmin } from "@/lib/admin/gate";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { sniffImage } from "@/lib/media/sniff";
import { fail, ok } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** 2 MiB. Ảnh tư liệu lịch sử ở kích thước hiển thị được thừa sức nằm dưới ngưỡng này. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/quan-tri/anh — nhận một tệp ảnh, trả về `{ url: "/media/<sha256>" }`.
 *
 * VÌ SAO LÀ ROUTE HANDLER CHỨ KHÔNG PHẢI SERVER ACTION — ba lý do đo được:
 *
 *  1. `serverActions.bodySizeLimit` là **toàn cục**. Nâng nó lên để nhận ảnh là nâng luôn
 *     cho `createShelf`/`updateShelf`/`deleteShelf` — nới hàng rào ở nơi không cần nới.
 *     Route Handler đặt được trần riêng, đúng tại chỗ nhận ảnh.
 *  2. Next dispatch Server Action **tuần tự cho mỗi client** (tài liệu, mục "Sequential
 *     dispatch"). Một lượt tải 2 MB đang bay sẽ chặn mọi action khác của cùng người dùng.
 *     `fetch` thường không vào hàng đợi đó.
 *  3. Không phải sửa `next.config.ts` một dòng nào.
 *
 * Đánh đổi phải trả: Route Handler KHÔNG có lớp kiểm CSRF của Server Action. Bù bằng
 * cookie `sameSite=lax` đã có sẵn, cộng một phép so `Origin` bên dưới.
 */
export async function POST(req: Request): Promise<Response> {
  // Route Handler cũng là endpoint POST công khai y hệt Server Action.
  try {
    await requireAdmin();
  } catch {
    return fail("Chỉ quản trị viên mới tải được ảnh lên.", 403);
  }

  // Bù cho việc không có CSRF check sẵn. `sameSite=lax` đã chặn phần lớn, đây là lớp hai:
  // request từ trang khác mang Origin khác Host.
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
  // `formData()` nạp cả body vào RAM. Không có cổng này thì một body 500 MB vẫn được đọc
  // hết rồi mới bị từ chối.
  //
  // KHÔNG KHAI BÁO ĐỘ DÀI LÀ KHÔNG HỢP LỆ, chứ không phải bằng 0. Bản trước viết
  // `Number(header ?? 0)`: thiếu header ra 0, header rác ("abc") ra NaN, và cả hai đều làm
  // phép so `> MAX_BYTES` thành false — nên chỉ cần BỎ header đi là vô hiệu hóa được cổng
  // này, gửi `Transfer-Encoding: chunked` với thân 4 GB rồi để `formData()` nuốt hết vào
  // heap. Route Handler của Next không có trần body mặc định (khác Server Action).
  // Đường dùng thật không hỏng: `fetch` với body là FormData luôn tự đặt `Content-Length`
  // vì trình duyệt biết trước độ dài.
  const declared = Number(req.headers.get("content-length"));
  if (!Number.isFinite(declared) || declared <= 0) {
    return fail("Yêu cầu phải khai báo Content-Length.", 411);
  }
  if (declared > MAX_BYTES * 1.1) {
    return fail(`Ảnh quá lớn. Tối đa ${MAX_BYTES / 1024 / 1024} MB.`, 413);
  }

  let file: unknown;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return fail("Không đọc được dữ liệu tải lên.", 400);
  }
  if (!(file instanceof File)) return fail("Thiếu tệp ảnh.");

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Cổng kích thước THỨ HAI, sau khi đọc thật: `content-length` là header của client và
  // nó nói dối được.
  if (bytes.byteLength === 0) return fail("Tệp rỗng.");
  if (bytes.byteLength > MAX_BYTES) {
    return fail(`Ảnh quá lớn. Tối đa ${MAX_BYTES / 1024 / 1024} MB.`, 413);
  }

  // Kiểu do MAGIC BYTE quyết định. `file.type` và đuôi tệp đều do client đặt nên cả hai
  // bị vứt, không bao giờ vọng lại.
  const mime = sniffImage(bytes);
  if (!mime) {
    return fail("Chỉ nhận ảnh PNG, JPEG, WebP hoặc GIF. (SVG không được chấp nhận.)", 415);
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const userId = await requireAdmin();
  await withRole(userId, (t) =>
    // Địa chỉ hóa theo nội dung: cùng byte = cùng dòng. Tải lại đúng ảnh cũ là không-op,
    // hai admin tải cùng một ảnh Wikimedia ra một dòng duy nhất.
    sequelize.query(
      `INSERT INTO public.media (sha256, mime, bytes, byte_len)
            VALUES ($1, $2, $3, $4)
       ON CONFLICT (sha256) DO NOTHING`,
      { bind: [sha256, mime, Buffer.from(bytes), bytes.byteLength], transaction: t, type: QueryTypes.INSERT },
    ),
  );

  return ok({ url: `/media/${sha256}`, mime, bytes: bytes.byteLength });
}
