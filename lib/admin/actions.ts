"use server";

import { revalidatePath } from "next/cache";
import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { requireAdmin } from "./gate";
import { readImageFields } from "./image-fields";
import { slugify, uniqueSlug } from "./slug";

/**
 * Mọi thao tác GHI của khu quản trị.
 *
 * **Mỗi hàm trong file này là một endpoint POST công khai.** `"use server"` biến từng
 * export thành một action id nằm trong bundle của trình duyệt, và tài liệu Next nói
 * thẳng: "the route is reachable to anyone who can send the same POST. Treat every
 * action as an untrusted entry point."
 *
 * Vì vậy `requireAdmin()` là dòng ĐẦU TIÊN của mọi hàm ở đây, không ngoại lệ. Việc
 * người dùng không nhìn thấy nút bấm không liên quan gì tới việc họ gọi được hay không.
 *
 * Nếu dòng đó lỡ bị quên, policy `admin write` ở tầng database vẫn chặn — nhưng đừng
 * dựa vào đó: thông báo lỗi lúc ấy nói về row-level security, không nói "bạn không có
 * quyền", nên người dùng nhận một lỗi khó hiểu thay vì một câu rõ ràng.
 */

export interface ActionState {
  error?: string;
  ok?: string;
}

const EMPTY: ActionState = {};

/** Lấy một trường chuỗi đã trim từ FormData; `""` khi thiếu. */
const field = (fd: FormData, key: string): string => String(fd.get(key) ?? "").trim();

/** Tiền tố kỹ thuật trong thông điệp các hàm SQL của ta tự `RAISE EXCEPTION`. */
const OUR_SQL_PREFIX = /^(reorder_shelves|reorder_books|reorder_pages):\s*/;

/**
 * Lôi sqlstate và tên ràng buộc ra khỏi lỗi Sequelize.
 *
 * Sequelize bọc lỗi gốc của `pg` vào `.parent`/`.original`, nên `e.code` ở tầng ngoài là
 * `undefined` — phải đi xuống một tầng.
 */
function pgInfo(e: unknown): { code: string; constraint: string; message: string } {
  const err = e as { message?: string; parent?: unknown; original?: unknown };
  const inner = (err?.parent ?? err?.original ?? e) as { code?: string; constraint?: string };
  return {
    code: typeof inner?.code === "string" ? inner.code : "",
    constraint: typeof inner?.constraint === "string" ? inner.constraint : "",
    message: e instanceof Error ? e.message : "",
  };
}

/**
 * Bọc phần thân để mọi lỗi thành một `ActionState` thay vì một trang lỗi trắng.
 *
 * PHÂN LOẠI BẰNG SQLSTATE, KHÔNG BẰNG VĂN XUÔI. Bản trước so chuỗi tiếng Anh và sai
 * thật: Postgres báo `violates RESTRICT setting of foreign key constraint`, có chữ
 * "RESTRICT setting of" chen vào giữa nên `/violates foreign key/` không khớp — lỗi "vật
 * phẩm đang có người sở hữu" rơi xuống nhánh cuối và hiện thành "Không lưu được. Thử
 * lại.", đúng loại thông báo khiến người ta đi tìm sai chỗ.
 *
 * Đây là cùng một bài học đã ghi trong CLAUDE.md cho `42501`: neo vào tín hiệu chính xác
 * và ổn định, đừng so khớp câu chữ. Văn xuôi của Postgres đổi theo phiên bản và theo
 * `lc_messages`; sqlstate thì không.
 */
async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    const { code, constraint, message } = pgInfo(e);

    switch (code) {
      // Hàm SQL của ta tự ném (`RAISE EXCEPTION` trong plpgsql). Thông điệp viết cho
      // người đọc và không lộ gì về cấu trúc, nên hiện thẳng sau khi bỏ tiền tố.
      case "P0001":
        return { error: message.replace(OUR_SQL_PREFIX, "") };

      // 23001 restrict_violation — ON DELETE RESTRICT chặn.
      // 23503 foreign_key_violation — họ hàng gần, gộp chung một câu.
      case "23001":
      case "23503":
        return {
          error:
            "Không xóa được: thứ này đang được dữ liệu khác tham chiếu. " +
            (constraint.includes("user_items")
              ? "Đã có người sở hữu vật phẩm này, nên nó phải ở lại."
              : "Gỡ những chỗ đang dùng nó trước."),
        };

      case "23505": // unique_violation
        return { error: "Giá trị này đã tồn tại." };

      case "23514": // check_violation
        return constraint.endsWith("_credit_ck")
          ? { error: "Có ảnh thì bắt buộc điền cả nguồn và tác giả + giấy phép." }
          : { error: "Dữ liệu không hợp lệ." };

      case "42501": // insufficient_privilege — RLS hoặc thiếu GRANT
        return { error: "Bạn không có quyền thực hiện việc này." };
    }

    // Không có sqlstate ⇒ lỗi ném từ JS của chính ta (validate đầu vào), hiện thẳng.
    if (!code && message) return { error: message };

    // Còn lại là lỗi Postgres ta chưa lường trước: nuốt vì nó lộ tên bảng/policy/ràng
    // buộc, nhưng ghi log đầy đủ để còn lần ra.
    console.error("admin action:", e);
    return { error: "Không lưu được. Thử lại." };
  }
}

// ---------------------------------------------------------------------------
// Kệ
// ---------------------------------------------------------------------------

export async function createShelf(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const name = field(fd, "name");
    if (!name) return { error: "Tên kệ không được để trống." };

    const base = slugify(name);
    if (!base) return { error: "Tên kệ phải có ít nhất một chữ cái hoặc chữ số." };

    await withRole(userId, async (t) => {
      const taken = await sequelize.query<{ slug: string }>("SELECT slug FROM public.shelves", {
        transaction: t,
        type: QueryTypes.SELECT,
      });
      const slug = uniqueSlug(base, new Set(taken.map((r) => r.slug)));

      // Kệ mới xếp cuối, và LUÔN ở trạng thái nháp: xuất bản là một hành động riêng,
      // có ý thức. Tạo xong đã hiện ngay cho học sinh là cách chắc chắn nhất để một
      // kệ rỗng lọt ra ngoài.
      await sequelize.query(
        `INSERT INTO public.shelves (slug, name, position, published)
         VALUES ($1, $2, coalesce((SELECT max(position) FROM public.shelves), 0) + 1, false)`,
        { bind: [slug, name], transaction: t, type: QueryTypes.INSERT },
      );
    });

    revalidatePath("/quan-tri");
    return { ok: `Đã tạo kệ "${name}" ở dạng nháp.` };
  });
}

export async function updateShelf(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const name = field(fd, "name");
    const blurb = field(fd, "blurb");
    const countryCode = field(fd, "countryCode");
    if (!slug) return { error: "Thiếu kệ cần sửa." };
    if (!name) return { error: "Tên kệ không được để trống." };
    if (countryCode && !/^\d{1,3}$/.test(countryCode)) {
      return { error: "Mã quốc gia phải là số ISO-3166-1 numeric, ví dụ 704 cho Việt Nam." };
    }

    const [, affected] = await withRole(userId, (t) =>
      sequelize.query(
        `UPDATE public.shelves SET name = $2, blurb = $3, country_code = $4 WHERE slug = $1`,
        { bind: [slug, name, blurb, countryCode || null], transaction: t },
      ),
    ) as [unknown, number];

    // Policy chặn thì UPDATE trúng 0 dòng mà KHÔNG báo lỗi. Không có phép so này thì
    // giao diện báo "đã lưu" trong khi database không đổi gì.
    if (affected === 0) return { error: "Không sửa được kệ này (không tồn tại, hoặc thiếu quyền)." };

    revalidatePath("/quan-tri");
    return { ok: "Đã lưu." };
  });
}

export async function setShelfPublished(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const publish = field(fd, "publish") === "1";
    if (!slug) return { error: "Thiếu kệ." };

    if (publish) {
      // Kệ rỗng mà xuất bản thì học sinh mở ra thấy một căn phòng trống. Chặn ở đây
      // cho lỗi dễ hiểu; không có ràng buộc DB nào cấm việc này vì nó là quy tắc biên
      // tập, không phải quy tắc toàn vẹn dữ liệu.
      const rows = await withRole(userId, (t) =>
        sequelize.query<{ n: string }>(
          "SELECT count(*) AS n FROM public.books WHERE shelf_slug = $1 AND published",
          { bind: [slug], transaction: t, type: QueryTypes.SELECT },
        ),
      );
      if (Number(rows[0]?.n ?? 0) === 0) {
        return { error: "Kệ chưa có quyển sách nào đã xuất bản — xuất bản sách trước." };
      }
    }

    const [, affected] = await withRole(userId, (t) =>
      sequelize.query("UPDATE public.shelves SET published = $2 WHERE slug = $1", {
        bind: [slug, publish],
        transaction: t,
      }),
    ) as [unknown, number];
    if (affected === 0) return { error: "Không đổi được trạng thái kệ này." };

    revalidatePath("/quan-tri");
    revalidatePath("/");
    return { ok: publish ? "Đã xuất bản." : "Đã chuyển về nháp." };
  });
}

export async function deleteShelf(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    if (!slug) return { error: "Thiếu kệ cần xóa." };

    return withRole(userId, async (t) => {
      // Khóa ngoại của `books` là ON DELETE CASCADE, nên xóa một kệ có sách sẽ cuốn
      // theo toàn bộ sách VÀ trang của chúng, im lặng và không hoàn tác được. Đòi kệ
      // rỗng là hàng rào chắc hơn một hộp thoại "bạn có chắc không" — người ta bấm
      // "chắc" theo phản xạ.
      const rows = await sequelize.query<{ n: string }>(
        "SELECT count(*) AS n FROM public.books WHERE shelf_slug = $1",
        { bind: [slug], transaction: t, type: QueryTypes.SELECT },
      );
      const n = Number(rows[0]?.n ?? 0);
      if (n > 0) {
        return { error: `Kệ còn ${n} quyển sách. Gỡ hết sách khỏi kệ rồi mới xóa được.` };
      }

      const [, affected] = (await sequelize.query(
        "DELETE FROM public.shelves WHERE slug = $1",
        { bind: [slug], transaction: t },
      )) as [unknown, number];
      if (affected === 0) return { error: "Không xóa được kệ này." };

      revalidatePath("/quan-tri");
      revalidatePath("/");
      return { ok: "Đã xóa kệ." };
    });
  });
}

/**
 * Đổi chỗ kệ với kệ liền kề. `direction` là -1 (lên) hoặc 1 (xuống).
 *
 * Gọi `reorder_shelves` với TOÀN BỘ danh sách chứ không UPDATE hai dòng: hàm đó tự
 * kiểm "đã gửi đủ chưa" và tự biến "UPDATE trúng 0 dòng vì RLS chặn" thành một lỗi
 * nhìn thấy được. Xem `db/schema/08-reorder.sql`.
 */
export async function moveShelf(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const direction = Number(field(fd, "direction"));
    if (!slug || (direction !== -1 && direction !== 1)) return { error: "Yêu cầu không hợp lệ." };

    await withRole(userId, async (t) => {
      const rows = await sequelize.query<{ slug: string }>(
        "SELECT slug FROM public.shelves ORDER BY position",
        { transaction: t, type: QueryTypes.SELECT },
      );
      const order = rows.map((r) => r.slug);
      const i = order.indexOf(slug);
      const j = i + direction;
      // Đã ở đầu/cuối thì không làm gì — nút tương ứng cũng đã bị vô hiệu hóa ở giao
      // diện, nhưng action là endpoint công khai nên phải tự kiểm lại.
      if (i === -1 || j < 0 || j >= order.length) return;

      [order[i], order[j]] = [order[j], order[i]];
      await sequelize.query("SELECT public.reorder_shelves($1::text[])", {
        bind: [order],
        transaction: t,
        type: QueryTypes.SELECT,
      });
    });

    revalidatePath("/quan-tri");
    revalidatePath("/");
    return EMPTY;
  });
}

// ---------------------------------------------------------------------------
// Vật phẩm
//
// `items` không có cột `position` cũng không có `published`, nên màn này KHÔNG có đổi
// thứ tự và KHÔNG có xuất bản — không có gì để hai hành động đó bám vào.
// ---------------------------------------------------------------------------

export async function createItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const name = field(fd, "name");
    if (!name) return { error: "Tên vật phẩm không được để trống." };

    const base = slugify(name);
    if (!base) return { error: "Tên vật phẩm phải có ít nhất một chữ cái hoặc chữ số." };

    const img = readImageFields(fd, "image");
    if ("error" in img) return { error: img.error };

    await withRole(userId, async (t) => {
      const taken = await sequelize.query<{ slug: string }>("SELECT slug FROM public.items", {
        transaction: t,
        type: QueryTypes.SELECT,
      });
      const slug = uniqueSlug(base, new Set(taken.map((r) => r.slug)));

      await sequelize.query(
        `INSERT INTO public.items (slug, name, description, image_url, image_source, image_credit)
              VALUES ($1, $2, $3, $4, $5, $6)`,
        {
          bind: [slug, name, field(fd, "description"), img.url, img.source, img.credit],
          transaction: t,
          type: QueryTypes.INSERT,
        },
      );
    });

    revalidatePath("/quan-tri/vat-pham");
    return { ok: `Đã tạo vật phẩm "${name}".` };
  });
}

export async function updateItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const name = field(fd, "name");
    if (!slug) return { error: "Thiếu vật phẩm cần sửa." };
    if (!name) return { error: "Tên vật phẩm không được để trống." };

    const img = readImageFields(fd, "image");
    if ("error" in img) return { error: img.error };

    const [, affected] = (await withRole(userId, (t) =>
      sequelize.query(
        `UPDATE public.items
            SET name = $2, description = $3, image_url = $4, image_source = $5, image_credit = $6
          WHERE slug = $1`,
        {
          bind: [slug, name, field(fd, "description"), img.url, img.source, img.credit],
          transaction: t,
        },
      ),
    )) as [unknown, number];

    if (affected === 0) {
      return { error: "Không sửa được vật phẩm này (không tồn tại, hoặc thiếu quyền)." };
    }

    revalidatePath("/quan-tri/vat-pham");
    // Tên và ảnh vật phẩm hiện trên trang kệ (ô "Cần … để mở") và trong hoạt cảnh nhận
    // thưởng, nên trang học sinh cũng phải làm mới.
    revalidatePath("/", "layout");
    return { ok: "Đã lưu." };
  });
}

export async function deleteItem(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    if (!slug) return { error: "Thiếu vật phẩm cần xóa." };

    return withRole(userId, async (t) => {
      // Hàng rào 1 — CHẶN TRƯỚC và nêu đích danh. `books.reward_item_slug` là ON DELETE
      // RESTRICT nên Postgres sẽ chặn dù sao, nhưng thông điệp của nó nói về tên ràng
      // buộc chứ không nói admin phải đi sửa quyển nào.
      const used = await sequelize.query<{ title: string }>(
        "SELECT title FROM public.books WHERE reward_item_slug = $1 ORDER BY shelf_slug, position",
        { bind: [slug], transaction: t, type: QueryTypes.SELECT },
      );
      if (used.length > 0) {
        const names = used.map((b) => `"${b.title}"`).join(", ");
        return {
          error:
            `Không xóa được: ${used.length} quyển đang lấy vật phẩm này làm phần thưởng ` +
            `(${names}). Đổi phần thưởng của những quyển đó trước.`,
        };
      }

      // Hàng rào 2 — `user_items.item_slug` cũng là ON DELETE RESTRICT, nhưng ở đây KHÔNG
      // chặn trước được: admin không có policy nào cho phép đọc `user_items` của người
      // khác. Phải để khóa ngoại ném rồi dịch — `guard()` có nhánh riêng cho việc đó, và
      // nhánh ấy phải đứng TRƯỚC nhánh "violates" (xem chú thích ở guard).
      const [, affected] = (await sequelize.query("DELETE FROM public.items WHERE slug = $1", {
        bind: [slug],
        transaction: t,
      })) as [unknown, number];
      if (affected === 0) return { error: "Không xóa được vật phẩm này." };

      revalidatePath("/quan-tri/vat-pham");
      return { ok: "Đã xóa vật phẩm." };
    });
  });
}
