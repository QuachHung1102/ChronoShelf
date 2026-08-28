"use server";

import { revalidatePath } from "next/cache";
import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { requireAdmin } from "./gate";
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

/** Bọc phần thân để mọi lỗi thành một `ActionState` thay vì một trang lỗi trắng. */
async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    // Thông điệp do CHÍNH TA ném ra thì hiện thẳng; lỗi của Postgres thì không —
    // chúng lộ tên bảng, tên policy, tên ràng buộc.
    if (message && !/^[a-z_]+:|violates|permission denied|duplicate key/i.test(message)) {
      return { error: message };
    }
    if (/duplicate key/i.test(message)) return { error: "Giá trị này đã tồn tại." };
    if (/violates|permission denied/i.test(message)) {
      return { error: "Bạn không có quyền thực hiện việc này." };
    }
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
