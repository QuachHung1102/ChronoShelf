"use server";

import { revalidatePath } from "next/cache";
import { QueryTypes } from "sequelize";
import type { ActionState } from "@/lib/action-state";
import { rowsAffected } from "@/lib/db/rows-affected";
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
 *
 * `deleting` để phân biệt hai chuyện mà 23001/23503 gộp lại làm một — xem nhánh đó.
 */
async function guard(fn: () => Promise<ActionState>, deleting = false): Promise<ActionState> {
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
      // 23503 foreign_key_violation — họ hàng gần, nhưng KHÔNG cùng nghĩa: 23503 cũng nổ
      // theo chiều ngược lại, khi một INSERT/UPDATE trỏ tới một dòng vừa biến mất (chọn
      // phần thưởng là vật phẩm mà tab khác vừa xóa, thêm sách vào kệ vừa bị xóa…). Nói
      // "không xóa được" lúc đó là chỉ sai chỗ hoàn toàn, nên chỉ nói vậy khi đang xóa.
      case "23001":
      case "23503":
        if (!deleting) {
          return { error: "Thứ bạn vừa chọn không còn tồn tại — tải lại trang rồi chọn lại." };
        }
        return {
          error:
            "Không xóa được: thứ này đang được dữ liệu khác tham chiếu. " +
            (constraint.includes("user_items")
              ? "Đã có người sở hữu vật phẩm này, nên nó phải ở lại."
              : "Gỡ những chỗ đang dùng nó trước."),
        };

      case "23505": // unique_violation
        // `shelves.country_code` là UNIQUE. Với ô nhập số thì lỗi này gần như không ai
        // gặp; với bản đồ bấm được thì bấm trúng nước kệ khác đang giữ là chuyện thường.
        return constraint === "shelves_country_code_key"
          ? { error: "Một kệ khác đã gắn với quốc gia này rồi." }
          : { error: "Giá trị này đã tồn tại." };

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

/**
 * Slug bị coi như đã dùng vì có một đoạn TĨNH mang đúng tên đó che mất đoạn động.
 *
 * Danh sách này là "thư mục route CÓ `page.tsx`", không phải "mọi thư mục trong `app/`":
 * `app/api` và `app/media` không có page nên `/api` và `/media` vẫn rơi vào `/[shelf]` —
 * đã đo bằng `next start`. Còn `vat-pham` thì che `/quan-tri/[shelf]`.
 *
 * Thêm một thư mục route gốc CÓ `page.tsx` thì phải cập nhật danh sách này.
 */
// Mọi đoạn TĨNH ở gốc URL. Đoạn tĩnh thắng đoạn động trong App Router, nên một kệ mang
// slug trùng ở đây sẽ bị route tĩnh che mất — vào `/<slug>` ra trang khác, và màn quản
// trị của kệ đó biến mất. Thêm route gốc mới thì THÊM VÀO ĐÂY.
const RESERVED_SLUGS = [
  "vat-pham",
  "quan-tri",
  "dang-nhap",
  "tui-hanh-trang",
  "cong-dong",
  "bai-giang",
  "tai-lieu",
  "media",
];

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
      // Đoạn tĩnh thắng đoạn động trong App Router, nên một kệ mang slug trùng tên một
      // đoạn tĩnh sẽ bị che mất — cả màn quản trị lẫn trang kệ của học sinh. Admin đặt
      // tên kệ là "Vật phẩm" hay "Quản trị" là ra đúng những slug đó, không hiếm như nó
      // tưởng. `uniqueSlug` sẽ tự đổi thành `vat-pham-2`, `quan-tri-2`…
      const slug = uniqueSlug(base, new Set([...taken.map((r) => r.slug), ...RESERVED_SLUGS]));

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

    // Ảnh bìa kệ. Ràng buộc `shelves_cover_credit_ck` (db/schema/12) cưỡng chế ở tầng
    // database, còn `readImageFields` chặn sớm để lỗi dễ hiểu — cả hai đều cần: cái sau
    // quên gọi được, cái trước thì không.
    const bia = readImageFields(fd, "cover");
    if ("error" in bia) return { error: bia.error };

    // Policy chặn thì UPDATE trúng 0 dòng mà KHÔNG báo lỗi. Không có phép so này thì
    // giao diện báo "đã lưu" trong khi database không đổi gì. Phải qua `rowsAffected`
    // chứ không ép kiểu phần tử thứ hai thành số — nó là một đối tượng `pg.Result`, và
    // một bản trước đã ép kiểu như vậy nên phép so này chết câm. Xem lib/db/rows-affected.ts.
    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          `UPDATE public.shelves
              SET name = $2, blurb = $3, country_code = $4,
                  cover_url = $5, cover_source = $6, cover_credit = $7
            WHERE slug = $1`,
          {
            bind: [slug, name, blurb, countryCode || null, bia.url, bia.source, bia.credit],
            transaction: t,
          },
        ),
      ),
    );
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

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query("UPDATE public.shelves SET published = $2 WHERE slug = $1", {
          bind: [slug, publish],
          transaction: t,
        }),
      ),
    );
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

      const affected = rowsAffected(
        await sequelize.query("DELETE FROM public.shelves WHERE slug = $1", {
          bind: [slug],
          transaction: t,
        }),
      );
      if (affected === 0) return { error: "Không xóa được kệ này." };

      revalidatePath("/quan-tri");
      revalidatePath("/");
      return { ok: "Đã xóa kệ." };
    });
  }, true);
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

    // Trả về một câu trạng thái THẬT chứ không phải EMPTY: người dùng bàn phím bấm ▲/▼
    // xong thì tiêu điểm rời khỏi nút, và nếu vùng aria-live không có gì để đọc thì
    // trình đọc màn hình im lặng — thao tác đã xảy ra mà không ai được báo (WCAG 4.1.3).
    const moved = await withRole(userId, async (t) => {
      const rows = await sequelize.query<{ slug: string; name: string }>(
        "SELECT slug, name FROM public.shelves ORDER BY position",
        { transaction: t, type: QueryTypes.SELECT },
      );
      const order = rows.map((r) => r.slug);
      const i = order.indexOf(slug);
      const j = i + direction;
      // Đã ở đầu/cuối thì không làm gì — nút tương ứng cũng đã bị vô hiệu hóa ở giao
      // diện, nhưng action là endpoint công khai nên phải tự kiểm lại.
      if (i === -1 || j < 0 || j >= order.length) return null;

      [order[i], order[j]] = [order[j], order[i]];
      await sequelize.query("SELECT public.reorder_shelves($1::text[])", {
        bind: [order],
        transaction: t,
        type: QueryTypes.SELECT,
      });
      return { name: rows[i].name, pos: j + 1, n: order.length };
    });

    revalidatePath("/quan-tri");
    revalidatePath("/");
    return moved
      ? { ok: `Đã đưa kệ “${moved.name}” về vị trí ${moved.pos}/${moved.n}.` }
      : { error: "Kệ này đã ở đầu hoặc cuối danh sách." };
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

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          `UPDATE public.items
              SET name = $2, description = $3, image_url = $4, image_source = $5, image_credit = $6
            WHERE slug = $1`,
          {
            bind: [slug, name, field(fd, "description"), img.url, img.source, img.credit],
            transaction: t,
          },
        ),
      ),
    );

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
      const affected = rowsAffected(
        await sequelize.query("DELETE FROM public.items WHERE slug = $1", {
          bind: [slug],
          transaction: t,
        }),
      );
      if (affected === 0) return { error: "Không xóa được vật phẩm này." };

      revalidatePath("/quan-tri/vat-pham");
      return { ok: "Đã xóa vật phẩm." };
    });
  }, true);
}

// ---------------------------------------------------------------------------
// Sách trong kệ
//
// KHÔNG có ô nhập "vật phẩm cần để mở" ở bất kỳ đâu, và không phải vì quên: cột đó
// KHÔNG TỒN TẠI. Quyển `i` mở bằng vật phẩm thưởng của quyển `i-1`, suy ra từ vị trí —
// nên chuỗi không thể đứt, vì không có gì lưu để mà sai. Spec §2.2.
// ---------------------------------------------------------------------------

export async function createBook(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const shelfSlug = field(fd, "shelfSlug");
    const title = field(fd, "title");
    const era = field(fd, "era");
    if (!shelfSlug) return { error: "Thiếu kệ." };
    if (!title) return { error: "Tiêu đề không được để trống." };
    // `era` là NOT NULL và không có DEFAULT trong schema, nên bỏ trống là vỡ ở tầng DB
    // với một thông điệp khó hiểu. Chặn ở đây cho câu rõ ràng.
    if (!era) return { error: "Niên đại không được để trống (ví dụ: Năm 938)." };
    const base = slugify(title);
    if (!base) return { error: "Tiêu đề phải có ít nhất một chữ cái hoặc chữ số." };

    await withRole(userId, async (t) => {
      // Slug là khóa chính TOÀN CỤC của `books`, không phải chỉ trong kệ — nên phải soi
      // cả bảng, không chỉ kệ này.
      const taken = await sequelize.query<{ slug: string }>("SELECT slug FROM public.books", {
        transaction: t,
        type: QueryTypes.SELECT,
      });
      const slug = uniqueSlug(base, new Set(taken.map((r) => r.slug)));

      await sequelize.query(
        `INSERT INTO public.books (slug, shelf_slug, position, title, era, published)
              VALUES ($1, $2,
                      coalesce((SELECT max(position) FROM public.books WHERE shelf_slug = $2), 0) + 1,
                      $3, $4, false)`,
        { bind: [slug, shelfSlug, title, era], transaction: t, type: QueryTypes.INSERT },
      );
    });

    revalidatePath(`/quan-tri/${shelfSlug}`);
    return { ok: `Đã tạo "${title}" ở dạng nháp. Soạn trang rồi mới xuất bản được.` };
  });
}

export async function updateBook(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const shelfSlug = field(fd, "shelfSlug");
    const title = field(fd, "title");
    const era = field(fd, "era");
    // Chuỗi rỗng ⇒ NULL: "Không thưởng gì" là một lựa chọn hợp lệ và nó cắt chuỗi mở
    // khóa một cách CÓ CHỦ Ý (quyển sau thành mở sẵn).
    const rewardItemSlug = field(fd, "rewardItemSlug") || null;

    if (!slug) return { error: "Thiếu quyển cần sửa." };
    if (!title) return { error: "Tiêu đề không được để trống." };
    if (!era) return { error: "Niên đại không được để trống (ví dụ: Năm 938)." };

    // Ảnh bìa sách. Ràng buộc `books_cover_credit_ck` cưỡng chế ở tầng database;
    // `readImageFields` chặn sớm để lỗi dễ hiểu — cả hai đều cần.
    const bia = readImageFields(fd, "cover");
    if ("error" in bia) return { error: bia.error };

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          `UPDATE public.books
              SET title = $2, era = $3, reward_item_slug = $4, updated_at = now(),
                  cover_url = $5, cover_source = $6, cover_credit = $7
            WHERE slug = $1`,
          {
            bind: [slug, title, era, rewardItemSlug, bia.url, bia.source, bia.credit],
            transaction: t,
          },
        ),
      ),
    );

    if (affected === 0) {
      return { error: "Không sửa được quyển này (không tồn tại, hoặc thiếu quyền)." };
    }

    revalidatePath(`/quan-tri/${shelfSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return { ok: "Đã lưu." };
  });
}

export async function setBookPublished(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const shelfSlug = field(fd, "shelfSlug");
    const publish = field(fd, "publish") === "1";
    if (!slug) return { error: "Thiếu quyển sách." };

    if (publish) {
      // Quyển 0 trang mà xuất bản thì học sinh mở ra thấy sách rỗng — và `complete_book`
      // sẽ ném `Book has no pages` khi họ cố đọc xong. Chặn ở đây cho khớp, thay vì để
      // lỗi đó nổ ra ở phía học sinh.
      const rows = await withRole(userId, (t) =>
        sequelize.query<{ n: string }>(
          "SELECT count(*) AS n FROM public.pages WHERE book_slug = $1",
          { bind: [slug], transaction: t, type: QueryTypes.SELECT },
        ),
      );
      if (Number(rows[0]?.n ?? 0) === 0) {
        return { error: "Quyển này chưa có trang nào — soạn ít nhất một trang trước khi xuất bản." };
      }
    }

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          "UPDATE public.books SET published = $2, updated_at = now() WHERE slug = $1",
          { bind: [slug, publish], transaction: t },
        ),
      ),
    );
    if (affected === 0) return { error: "Không đổi được trạng thái quyển này." };

    revalidatePath(`/quan-tri/${shelfSlug}`);
    revalidatePath(`/${shelfSlug}`);
    revalidatePath("/quan-tri");

    // Gỡ xuất bản quyển ĐÃ XUẤT BẢN CUỐI CÙNG của một kệ đang xuất bản tạo ra đúng cái
    // trạng thái mà `setShelfPublished` cất công chặn: kệ hiện ra với học sinh nhưng
    // trống trơn. Không chặn (đây là thao tác hợp lệ khi đang biên tập), chỉ nói ra.
    if (!publish) {
      const rest = await withRole(userId, (t) =>
        sequelize.query<{ n: string }>(
          `SELECT count(*) AS n FROM public.books b
            WHERE b.shelf_slug = $1 AND b.published
              AND EXISTS (SELECT 1 FROM public.shelves s WHERE s.slug = $1 AND s.published)`,
          { bind: [shelfSlug], transaction: t, type: QueryTypes.SELECT },
        ),
      );
      if (Number(rest[0]?.n ?? 0) === 0) {
        return {
          ok:
            "Đã chuyển về nháp. Lưu ý: kệ này đang xuất bản mà không còn quyển nào — " +
            "học sinh sẽ thấy một kệ trống.",
        };
      }
    }

    return { ok: publish ? "Đã xuất bản." : "Đã chuyển về nháp." };
  });
}

export async function deleteBook(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const shelfSlug = field(fd, "shelfSlug");
    if (!slug) return { error: "Thiếu quyển cần xóa." };

    return withRole(userId, async (t) => {
      // Xóa một quyển cuốn theo TOÀN BỘ trang của nó VÀ tiến độ đọc của MỌI người dùng,
      // qua ON DELETE CASCADE — im lặng và không hoàn tác được. Tệ hơn: admin không có
      // cách nào biết trước bao nhiêu người đang đọc dở, vì `user_book_progress` chỉ có
      // policy "own progress select", không có vế is_admin().
      //
      // Vì vậy đòi quyển phải ở dạng NHÁP trước. Đó là một bước tường minh, giải thích
      // được, và nó chặn đúng tai nạn hay xảy ra nhất: xóa nhầm một quyển đang chạy.
      const rows = await sequelize.query<{ published: boolean; title: string }>(
        "SELECT published, title FROM public.books WHERE slug = $1",
        { bind: [slug], transaction: t, type: QueryTypes.SELECT },
      );
      const book = rows[0];
      if (!book) return { error: "Không tìm thấy quyển này." };
      if (book.published) {
        return {
          error:
            `"${book.title}" đang xuất bản. Chuyển về nháp trước khi xóa — ` +
            "xóa sẽ cuốn theo mọi trang và tiến độ đọc của học sinh.",
        };
      }

      const affected = rowsAffected(
        await sequelize.query("DELETE FROM public.books WHERE slug = $1", {
          bind: [slug],
          transaction: t,
        }),
      );
      if (affected === 0) return { error: "Không xóa được quyển này." };

      revalidatePath(`/quan-tri/${shelfSlug}`);
      revalidatePath(`/${shelfSlug}`);
      return { ok: "Đã xóa quyển sách." };
    });
  }, true);
}

/** Đổi chỗ quyển sách với quyển liền kề. `direction` là -1 (lên) hoặc 1 (xuống). */
export async function moveBook(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const shelfSlug = field(fd, "shelfSlug");
    const direction = Number(field(fd, "direction"));
    if (!slug || !shelfSlug || (direction !== -1 && direction !== 1)) {
      return { error: "Yêu cầu không hợp lệ." };
    }

    const moved = await withRole(userId, async (t) => {
      const rows = await sequelize.query<{ slug: string; title: string }>(
        "SELECT slug, title FROM public.books WHERE shelf_slug = $1 ORDER BY position",
        { bind: [shelfSlug], transaction: t, type: QueryTypes.SELECT },
      );
      const order = rows.map((r) => r.slug);
      const i = order.indexOf(slug);
      const j = i + direction;
      if (i === -1 || j < 0 || j >= order.length) return null;

      [order[i], order[j]] = [order[j], order[i]];
      await sequelize.query("SELECT public.reorder_books($1, $2::text[])", {
        bind: [shelfSlug, order],
        transaction: t,
        type: QueryTypes.SELECT,
      });
      return { title: rows[i].title, pos: j + 1, n: order.length };
    });

    revalidatePath(`/quan-tri/${shelfSlug}`);
    // Đổi thứ tự là ĐỔI CẢ CHUỖI MỞ KHÓA — trang kệ của học sinh phải tính lại.
    revalidatePath(`/${shelfSlug}`);
    return moved
      ? { ok: `Đã đưa “${moved.title}” về vị trí ${moved.pos}/${moved.n}.` }
      : { error: "Quyển này đã ở đầu hoặc cuối kệ." };
  });
}

// ---------------------------------------------------------------------------
// Trang sách
// ---------------------------------------------------------------------------

/**
 * Ô "Ý chính" nhận mỗi ý một dòng, đổi thành `text[]`.
 *
 * Một textarea nhiều dòng thay vì n ô nhập động: cột là `text[]` nên số phần tử tùy ý,
 * và một danh sách ô có nút thêm/bớt cần JavaScript trạng thái ở client cho một việc mà
 * phím Enter đã làm được. Dòng trắng bị bỏ, nên gõ thừa một dòng không tạo ra ý rỗng.
 */
function readSummary(fd: FormData): string[] {
  return String(fd.get("summary") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function createPage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    const heading = field(fd, "heading");
    const body = field(fd, "body");
    if (!bookSlug) return { error: "Thiếu quyển sách." };
    if (!heading) return { error: "Tiêu đề trang không được để trống." };
    if (!body) return { error: "Nội dung trang không được để trống." };

    const img = readImageFields(fd, "image");
    if ("error" in img) return { error: img.error };

    await withRole(userId, (t) =>
      sequelize.query(
        `INSERT INTO public.pages
              (book_slug, position, heading, body, image_url, image_source, image_credit, caption, summary)
         VALUES ($1,
                 coalesce((SELECT max(position) FROM public.pages WHERE book_slug = $1), 0) + 1,
                 $2, $3, $4, $5, $6, $7, $8::text[])`,
        {
          bind: [
            bookSlug,
            heading,
            body,
            img.url,
            img.source,
            img.credit,
            field(fd, "caption") || null,
            readSummary(fd),
          ],
          transaction: t,
          type: QueryTypes.INSERT,
        },
      ),
    );

    revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
    revalidatePath(`/quan-tri/${shelfSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return { ok: "Đã thêm trang." };
  });
}

export async function updatePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const id = field(fd, "id");
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    const heading = field(fd, "heading");
    const body = field(fd, "body");
    if (!id) return { error: "Thiếu trang cần sửa." };
    // `bookSlug` không còn là thứ chỉ dùng để `revalidatePath` nữa — nó là một nửa của
    // điều kiện WHERE, nên thiếu nó thì câu lệnh trúng 0 dòng. Đòi trước cho lỗi rõ ràng.
    if (!bookSlug) return { error: "Thiếu quyển sách." };
    if (!heading) return { error: "Tiêu đề trang không được để trống." };
    if (!body) return { error: "Nội dung trang không được để trống." };

    const img = readImageFields(fd, "image");
    if ("error" in img) return { error: img.error };

    // `AND book_slug = $9` — action là endpoint POST công khai, nên một id trang bất kỳ
    // không được phép sửa được chỉ vì nó là uuid hợp lệ: nó phải thuộc đúng quyển đang
    // thao tác. ($9 chứ không phải $2 — $2..$8 đã dùng hết cho các cột đang SET.)
    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          `UPDATE public.pages
              SET heading = $2, body = $3, image_url = $4, image_source = $5,
                  image_credit = $6, caption = $7, summary = $8::text[]
            WHERE id = $1::uuid AND book_slug = $9`,
          {
            bind: [
              id,
              heading,
              body,
              img.url,
              img.source,
              img.credit,
              field(fd, "caption") || null,
              readSummary(fd),
              bookSlug,
            ],
            transaction: t,
          },
        ),
      ),
    );

    if (affected === 0) {
      return {
        error: "Không sửa được trang này (không tồn tại, không thuộc quyển này, hoặc thiếu quyền).",
      };
    }

    revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return { ok: "Đã lưu." };
  });
}

export async function deletePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const id = field(fd, "id");
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    if (!id || !bookSlug) return { error: "Yêu cầu không hợp lệ." };

    return withRole(userId, async (t) => {
      // Xóa trang của một quyển ĐANG XUẤT BẢN làm đổi tổng số trang, mà `complete_book`
      // so `current_page` với đúng con số đó. Học sinh đang ở trang cuối bỗng thành
      // "chưa đọc hết" và không hoàn thành được. Không chặn — biên tập nội dung đang
      // chạy là việc hợp lệ — nhưng phải nói ra.
      const meta = await sequelize.query<{ published: boolean; n: string }>(
        `SELECT b.published, (SELECT count(*) FROM public.pages p WHERE p.book_slug = b.slug) AS n
           FROM public.books b WHERE b.slug = $1`,
        { bind: [bookSlug], transaction: t, type: QueryTypes.SELECT },
      );
      const book = meta[0];
      // Không có quyển nào mang slug đó thì phép kiểm bên dưới không có gì để dựa vào,
      // và câu DELETE (ràng theo `book_slug`) cũng sẽ trúng 0 dòng. Nói thẳng ra đây.
      if (!book) return { error: "Không tìm thấy quyển sách này." };
      if (Number(book.n) <= 1 && book.published) {
        // Quyển 0 trang mà published là trạng thái `complete_book` từ chối bằng
        // `Book has no pages` — nó biến quyển sách thành ngõ cụt cho học sinh.
        return {
          error:
            "Đây là trang cuối cùng của một quyển đang xuất bản. " +
            "Chuyển quyển về nháp trước, hoặc thêm trang khác rồi mới xóa trang này.",
        };
      }

      // `AND book_slug = $2` — hàng rào "trang cuối của quyển đang xuất bản" ở trên tra
      // theo `bookSlug` của form, nên câu xóa cũng phải ràng theo đúng quyển đó. Xóa
      // theo mỗi `id` là gọi thẳng action với một id lạ thì lách được cả hàng rào.
      const affected = rowsAffected(
        await sequelize.query("DELETE FROM public.pages WHERE id = $1::uuid AND book_slug = $2", {
          bind: [id, bookSlug],
          transaction: t,
        }),
      );
      if (affected === 0) {
        return { error: "Không xóa được trang này (không tồn tại, hoặc không thuộc quyển này)." };
      }

      // Vị trí còn lại có thể thành 1,2,4… (thủng chỗ vừa xóa). Không sao: mọi truy vấn
      // đều ORDER BY position, và lần đổi thứ tự kế tiếp sẽ ghi lại thành 1..n. Đánh số
      // lại ngay ở đây chỉ thêm một lượt ghi mà không ai thấy khác biệt.
      revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
      revalidatePath(`/quan-tri/${shelfSlug}`);
      revalidatePath(`/${shelfSlug}`);
      return { ok: "Đã xóa trang." };
    });
  }, true);
}

/** Đổi chỗ trang với trang liền kề. `direction` là -1 (lên) hoặc 1 (xuống). */
export async function movePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const id = field(fd, "id");
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    const direction = Number(field(fd, "direction"));
    if (!id || !bookSlug || (direction !== -1 && direction !== 1)) {
      return { error: "Yêu cầu không hợp lệ." };
    }

    const moved = await withRole(userId, async (t) => {
      const rows = await sequelize.query<{ id: string; heading: string }>(
        "SELECT id, heading FROM public.pages WHERE book_slug = $1 ORDER BY position",
        { bind: [bookSlug], transaction: t, type: QueryTypes.SELECT },
      );
      const order = rows.map((r) => r.id);
      const i = order.indexOf(id);
      const j = i + direction;
      if (i === -1 || j < 0 || j >= order.length) return null;

      [order[i], order[j]] = [order[j], order[i]];
      await sequelize.query("SELECT public.reorder_pages($1, $2::uuid[])", {
        bind: [bookSlug, order],
        transaction: t,
        type: QueryTypes.SELECT,
      });
      return { heading: rows[i].heading, pos: j + 1, n: order.length };
    });

    revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return moved
      ? { ok: `Đã đưa trang “${moved.heading}” về vị trí ${moved.pos}/${moved.n}.` }
      : { error: "Trang này đã ở đầu hoặc cuối quyển." };
  });
}

// ---------------------------------------------------------------------------
// Bài trắc nghiệm cuối sách (content.md §4.3)
//
// KHÔNG có đổi thứ tự. Một bài kiểm tra chỉ 2–3 câu và thứ tự giữa chúng không mang
// nghĩa gì — thêm một RPC `reorder_book_questions` cùng hai nút mũi tên là công sức thật
// cho một thứ không ai cần. Ràng buộc UNIQUE vẫn DEFERRABLE giống `pages` để đường nâng
// cấp còn mở, và `90-verify.sql` giữ cho nó ở nguyên như vậy.
// ---------------------------------------------------------------------------

/** Số ô lựa chọn trên biểu mẫu. PHẢI khớp trần trong `book_questions_choices_ck`. */
const MAX_CHOICES = 4;

/**
 * Đọc bốn ô lựa chọn + ô đánh dấu đáp án, đổi thành `{ choices, correctIndex }`.
 *
 * Chỗ dễ sai và là lý do hàm này tồn tại: ô radio trên biểu mẫu trỏ tới Ô THỨ MẤY, còn
 * `correct_index` lưu trong database là CHỈ SỐ TRONG MẢNG ĐÃ NÉN. Admin bỏ trống ô 2 rồi
 * điền ô 3 là hai con số đó lệch nhau. Nén và dịch chỉ số trong cùng một vòng lặp thì
 * chúng không thể lệch.
 */
function readChoices(
  fd: FormData,
): { choices: string[]; correctIndex: number } | { error: string } {
  // `Number("")` là `0`, nên đọc thẳng bằng `Number(field(...))` biến "thiếu trường
  // `correct`" thành "đáp án là ô 1" trong im lặng. Mỗi export ở file này là một endpoint
  // POST công khai — một POST không kèm `correct` phải nhận câu từ chối rõ ràng, không
  // phải một câu hỏi có đáp án bịa. Qua giao diện thì không xảy ra (form nào cũng có sẵn
  // một radio `defaultChecked`), nhưng giao diện không phải hàng rào.
  const rawSlot = field(fd, "correct");
  const chosenSlot = /^\d+$/.test(rawSlot) ? Number(rawSlot) : -1;
  const choices: string[] = [];
  let correctIndex = -1;

  for (let slot = 0; slot < MAX_CHOICES; slot++) {
    const text = field(fd, `choice${slot}`);
    if (!text) continue;
    if (slot === chosenSlot) correctIndex = choices.length;
    choices.push(text);
  }

  if (choices.length < 2) return { error: "Câu hỏi cần ít nhất hai lựa chọn." };
  // Ràng buộc `book_questions_correct_range_ck` chỉ bắt được chỉ số ngoài mảng; nó không
  // biết gì về việc admin đánh dấu vào một ô để trống.
  if (correctIndex < 0) {
    return { error: "Chọn đáp án đúng, và ô được chọn phải có nội dung." };
  }
  // Database không cấm hai lựa chọn trùng nhau (một CHECK cho việc đó cần subquery).
  // Nhưng một câu có hai đáp án giống hệt mà chỉ một cái "đúng" thì học sinh không có
  // cách nào trả lời đúng bằng lý lẽ — chặn ở đây.
  if (new Set(choices).size !== choices.length) {
    return { error: "Hai lựa chọn trùng nhau — học sinh không có cách nào chọn đúng." };
  }
  return { choices, correctIndex };
}

export async function createQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    const prompt = field(fd, "prompt");
    if (!bookSlug) return { error: "Thiếu quyển sách." };
    if (!prompt) return { error: "Câu hỏi không được để trống." };

    const c = readChoices(fd);
    if ("error" in c) return { error: c.error };

    await withRole(userId, (t) =>
      sequelize.query(
        `INSERT INTO public.book_questions (book_slug, position, prompt, choices, correct_index)
         VALUES ($1,
                 coalesce((SELECT max(position) FROM public.book_questions WHERE book_slug = $1), 0) + 1,
                 $2, $3::text[], $4)`,
        {
          bind: [bookSlug, prompt, c.choices, c.correctIndex],
          transaction: t,
          type: QueryTypes.INSERT,
        },
      ),
    );

    revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return { ok: "Đã thêm câu hỏi." };
  });
}

export async function updateQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const id = field(fd, "id");
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    const prompt = field(fd, "prompt");
    if (!id) return { error: "Thiếu câu hỏi cần sửa." };
    if (!bookSlug) return { error: "Thiếu quyển sách." };
    if (!prompt) return { error: "Câu hỏi không được để trống." };

    const c = readChoices(fd);
    if ("error" in c) return { error: c.error };

    // `AND book_slug = $5` cùng lý do như `updatePage`: mỗi export ở file này là một
    // endpoint POST công khai, nên một uuid hợp lệ bất kỳ không được sửa được câu hỏi của
    // quyển khác.
    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          `UPDATE public.book_questions
              SET prompt = $2, choices = $3::text[], correct_index = $4
            WHERE id = $1::uuid AND book_slug = $5`,
          {
            bind: [id, prompt, c.choices, c.correctIndex, bookSlug],
            transaction: t,
          },
        ),
      ),
    );

    if (affected === 0) {
      return {
        error: "Không sửa được câu hỏi này (không tồn tại, không thuộc quyển này, hoặc thiếu quyền).",
      };
    }

    revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return { ok: "Đã lưu câu hỏi." };
  });
}

export async function deleteQuestion(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const id = field(fd, "id");
    const bookSlug = field(fd, "bookSlug");
    const shelfSlug = field(fd, "shelfSlug");
    if (!id || !bookSlug) return { error: "Yêu cầu không hợp lệ." };

    // Không có hàng rào "câu cuối cùng" như `deletePage`: xóa hết câu hỏi đưa quyển về
    // đúng trạng thái mặc định — đọc hết trang là nhận vật phẩm — chứ không tạo ra ngõ
    // cụt nào. Đó là trạng thái của mọi quyển chưa được soạn câu hỏi.
    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          "DELETE FROM public.book_questions WHERE id = $1::uuid AND book_slug = $2",
          { bind: [id, bookSlug], transaction: t },
        ),
      ),
    );
    if (affected === 0) {
      return { error: "Không xóa được câu hỏi này (không tồn tại, hoặc không thuộc quyển này)." };
    }

    revalidatePath(`/quan-tri/${shelfSlug}/${bookSlug}`);
    revalidatePath(`/${shelfSlug}`);
    return { ok: "Đã xóa câu hỏi." };
  }, true);
}

// ---------------------------------------------------------------------------
// Bài giảng & slide (content.md §7)
//
// KHÔNG có đổi thứ tự: `lessons` cố ý không có cột `position` — thứ tự hiển thị là
// `grade, title`. Lý do đầy đủ ở db/schema/14-learning-hub.sql.
// ---------------------------------------------------------------------------

/** Đọc và kiểm khối lớp. Chuỗi rỗng hoặc ngoài 10/11/12 đều là `null`. */
function readGrade(fd: FormData): number | null {
  const raw = field(fd, "grade");
  return raw === "10" || raw === "11" || raw === "12" ? Number(raw) : null;
}

/**
 * Bộ slide đã tải lên: `/tai-lieu/<sha256>` cộng tên tệp. Cả hai cùng có hoặc cùng vắng —
 * `lessons_slide_filename_ck` cưỡng chế lại điều đó ở tầng DB.
 */
function readSlide(fd: FormData): { sha: string | null; ten: string | null } | { error: string } {
  const url = field(fd, "slideUrl");
  if (!url) return { sha: null, ten: null };

  const m = /^\/tai-lieu\/([0-9a-f]{64})$/.exec(url);
  if (!m) return { error: "Đường dẫn slide không hợp lệ — hãy tải tệp lên thay vì dán liên kết." };

  const ten = field(fd, "slideFilename");
  if (!ten) return { error: "Thiếu tên tệp slide." };
  return { sha: m[1], ten };
}

export async function createLesson(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const title = field(fd, "title");
    const grade = readGrade(fd);
    if (!title) return { error: "Tên bài giảng không được để trống." };
    if (grade === null) return { error: "Phải chọn khối lớp 10, 11 hoặc 12." };

    const base = slugify(title);
    if (!base) return { error: "Tên bài giảng phải có ít nhất một chữ cái hoặc chữ số." };

    await withRole(userId, async (t) => {
      const taken = await sequelize.query<{ slug: string }>("SELECT slug FROM public.lessons", {
        transaction: t,
        type: QueryTypes.SELECT,
      });
      const slug = uniqueSlug(base, new Set(taken.map((r) => r.slug)));

      // Luôn ở trạng thái nháp. Xuất bản là một hành động riêng, có ý thức — tạo xong đã
      // hiện ngay cho học sinh là cách chắc chắn nhất để một bài rỗng lọt ra ngoài.
      await sequelize.query(
        `INSERT INTO public.lessons (slug, grade, title) VALUES ($1, $2, $3)`,
        { bind: [slug, grade, title], transaction: t, type: QueryTypes.INSERT },
      );
    });

    revalidatePath("/quan-tri/bai-giang");
    revalidatePath("/bai-giang");
    return { ok: `Đã tạo bài giảng "${title}". Bài đang ở dạng nháp.` };
  });
}

export async function updateLesson(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const title = field(fd, "title");
    const grade = readGrade(fd);
    if (!slug) return { error: "Thiếu bài giảng cần sửa." };
    if (!title) return { error: "Tên bài giảng không được để trống." };
    if (grade === null) return { error: "Phải chọn khối lớp 10, 11 hoặc 12." };

    const preview = readImageFields(fd, "preview");
    if ("error" in preview) return { error: preview.error };
    const mindmap = readImageFields(fd, "mindmap");
    if ("error" in mindmap) return { error: mindmap.error };
    const slide = readSlide(fd);
    if ("error" in slide) return { error: slide.error };

    // Chuỗi rỗng ⇒ NULL, không phải chuỗi rỗng: cột này là khóa ngoại sang `books.slug`.
    const bookSlug = field(fd, "bookSlug") || null;

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query(
          `UPDATE public.lessons
              SET grade = $2, title = $3, summary = $4, book_slug = $5,
                  slide_sha256 = $6, slide_filename = $7,
                  preview_url = $8, preview_source = $9, preview_credit = $10,
                  mindmap_url = $11, mindmap_source = $12, mindmap_credit = $13
            WHERE slug = $1`,
          {
            bind: [
              slug, grade, title, field(fd, "summary"), bookSlug,
              slide.sha, slide.ten,
              preview.url, preview.source, preview.credit,
              mindmap.url, mindmap.source, mindmap.credit,
            ],
            transaction: t,
          },
        ),
      ),
    );
    if (affected === 0) return { error: "Không tìm thấy bài giảng này." };

    revalidatePath("/quan-tri/bai-giang");
    revalidatePath("/bai-giang");
    return { ok: "Đã lưu." };
  });
}

export async function setLessonPublished(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    const published = field(fd, "published") === "1";
    if (!slug) return { error: "Thiếu bài giảng." };

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query("UPDATE public.lessons SET published = $2 WHERE slug = $1", {
          bind: [slug, published],
          transaction: t,
        }),
      ),
    );
    if (affected === 0) return { error: "Không tìm thấy bài giảng này." };

    revalidatePath("/quan-tri/bai-giang");
    revalidatePath("/bai-giang");
    return { ok: published ? "Đã xuất bản bài giảng." : "Đã đưa bài giảng về dạng nháp." };
  });
}

export async function deleteLesson(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guard(async () => {
    const userId = await requireAdmin();
    const slug = field(fd, "slug");
    if (!slug) return { error: "Thiếu bài giảng cần xóa." };

    const affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query("DELETE FROM public.lessons WHERE slug = $1", {
          bind: [slug],
          transaction: t,
        }),
      ),
    );
    if (affected === 0) return { error: "Không tìm thấy bài giảng này." };

    revalidatePath("/quan-tri/bai-giang");
    revalidatePath("/bai-giang");
    // Byte của bộ slide KHÔNG bị xóa theo: `documents` là bảng chỉ-ghi-thêm và không role
    // nào có GRANT DELETE. Đổi lại thì một tệp bị nhiều bài dùng chung sẽ chết theo bài
    // đầu tiên bị xóa. Dọn tệp mồ côi là việc bảo trì bằng superuser, không phải việc của
    // màn quản trị.
    return { ok: "Đã xóa bài giảng." };
  }, true);
}
