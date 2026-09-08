"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { rowsAffected } from "@/lib/db/rows-affected";
import { getSessionUserId } from "@/lib/auth/session";
import { BAI_TOI_DA, BINH_LUAN_TOI_DA, docLoaiBai, docNoiDung } from "./validation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function dangBai(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Bạn cần đăng nhập trước khi đăng bài." };

  const kind = docLoaiBai(formData.get("kind"));
  if (!kind) return { error: "Loại bài không hợp lệ." };

  const noiDung = docNoiDung(formData.get("body"), BAI_TOI_DA);
  if ("error" in noiDung) return noiDung;

  try {
    await withRole(userId, async (t) => {
      await sequelize.query(
        `INSERT INTO public.community_posts (author_id, kind, body)
         VALUES ($1, $2, $3)`,
        { bind: [userId, kind, noiDung.value], transaction: t },
      );
    });
  } catch (error) {
    console.error("Không đăng được bài cộng đồng", error);
    return { error: "Chưa đăng được bài. Thử lại giúp mình." };
  }

  revalidatePath("/cong-dong");
  return { ok: "Đã đăng bài và giữ lửa cho hôm nay." };
}

export async function dangBinhLuan(
  postId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Bạn cần đăng nhập trước khi bình luận." };
  if (!UUID_RE.test(postId)) return { error: "Bài viết không hợp lệ." };

  const noiDung = docNoiDung(formData.get("body"), BINH_LUAN_TOI_DA);
  if ("error" in noiDung) return noiDung;

  try {
    await withRole(userId, (t) =>
      sequelize.query(
        `INSERT INTO public.community_comments (post_id, author_id, body)
         VALUES ($1, $2, $3)`,
        { bind: [postId, userId, noiDung.value], transaction: t },
      ),
    );
  } catch (error) {
    console.error("Không đăng được bình luận cộng đồng", error);
    return { error: "Chưa gửi được bình luận. Bài viết có thể đã bị xóa." };
  }

  revalidatePath("/cong-dong");
  return { ok: "Đã gửi bình luận." };
}

/**
 * Gỡ một bài trên bảng tin.
 *
 * Hàng rào thật là **policy `delete own or admin post`** ở `db/schema/17`: câu DELETE
 * dưới đây không có vế `author_id = ...` nào cả, và cố ý như vậy — để RLS trả lời câu
 * hỏi "ai được xóa cái gì". Viết điều kiện đó ở đây nữa là dựng bản thứ hai của cùng một
 * luật, và hai bản thì sẽ trôi lệch. Người không có quyền chạy đúng câu này sẽ trúng
 * **0 dòng**, không phải nhận lỗi.
 *
 * Vì vậy `rowsAffected` KHÔNG phải phép kiểm cho vui: nó là cách duy nhất phân biệt
 * "đã xóa" với "policy vừa chặn bạn". Không có nó thì giao diện báo thành công trong khi
 * bài vẫn nằm nguyên trên bảng tin — đúng bẫy `sequelize.query()` đã ghi ở CLAUDE.md.
 *
 * Bình luận dưới bài đi theo nhờ `ON DELETE CASCADE`, kể cả bình luận của người khác.
 *
 * Không nhận `prev`/`formData` như hai action kia: hàm này không đọc gì từ biểu mẫu, mọi
 * thứ nó cần đã nằm trong `postId` bind sẵn. Một hàm ít tham số hơn vẫn gán được vào kiểu
 * đòi nhiều hơn, nên nó vừa khuôn `action` của `ActionForm` y như thường.
 */
export async function xoaBai(postId: string): Promise<ActionState> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Bạn cần đăng nhập." };
  if (!UUID_RE.test(postId)) return { error: "Bài viết không hợp lệ." };

  let affected = 0;
  try {
    affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query("DELETE FROM public.community_posts WHERE id = $1", {
          bind: [postId],
          transaction: t,
        }),
      ),
    );
  } catch (error) {
    console.error("Không gỡ được bài cộng đồng", error);
    return { error: "Chưa gỡ được bài. Thử lại giúp mình." };
  }

  // Không tách "bài không tồn tại" khỏi "bạn không có quyền": tách ra là biến nút này
  // thành máy dò xem một id bài có thật hay không.
  if (affected === 0) return { error: "Không gỡ được bài này (đã bị gỡ, hoặc không phải bài của bạn)." };

  revalidatePath("/cong-dong");
  return { ok: "Đã gỡ bài." };
}

/** Gỡ một bình luận. Cùng luật, cùng lý do như `xoaBai`. */
export async function xoaBinhLuan(commentId: string): Promise<ActionState> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Bạn cần đăng nhập." };
  if (!UUID_RE.test(commentId)) return { error: "Bình luận không hợp lệ." };

  let affected = 0;
  try {
    affected = rowsAffected(
      await withRole(userId, (t) =>
        sequelize.query("DELETE FROM public.community_comments WHERE id = $1", {
          bind: [commentId],
          transaction: t,
        }),
      ),
    );
  } catch (error) {
    console.error("Không gỡ được bình luận cộng đồng", error);
    return { error: "Chưa gỡ được bình luận. Thử lại giúp mình." };
  }

  if (affected === 0) {
    return { error: "Không gỡ được bình luận này (đã bị gỡ, hoặc không phải của bạn)." };
  }

  revalidatePath("/cong-dong");
  return { ok: "Đã gỡ bình luận." };
}
