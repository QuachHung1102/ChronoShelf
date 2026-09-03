"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { getSessionUserId } from "@/lib/auth/session";
import { docLoaiBai, docNoiDung } from "./validation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function dangBai(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "Bạn cần đăng nhập trước khi đăng bài." };

  const kind = docLoaiBai(formData.get("kind"));
  if (!kind) return { error: "Loại bài không hợp lệ." };

  const noiDung = docNoiDung(formData.get("body"), 1_000);
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

  const noiDung = docNoiDung(formData.get("body"), 500);
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
