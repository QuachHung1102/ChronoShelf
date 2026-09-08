import { createHash } from "node:crypto";
import { cache } from "react";
import { Op } from "sequelize";
import { getAdminUserId } from "@/lib/admin/gate";
import { getSessionUserId } from "@/lib/auth/session";
import { CommunityComment, CommunityPost, UserActivity } from "@/lib/db/models";
import { withRole } from "@/lib/db/tx";
import {
  danhHieuTuStreakDaiNhat,
  homNayVietNam,
  tinhStreak,
  tinhStreakDaiNhat,
  type DanhHieuStreak,
} from "@/lib/streak";
import type { LoaiBai } from "./validation";

export interface BinhLuanCongDong {
  id: string;
  tacGia: string;
  body: string;
  createdAt: Date;
  /**
   * Của chính người đang xem. Suy ra Ở ĐÂY rồi vứt `authorId` đi — bảng tin dùng bí danh
   * (`Bạn đọc #A1B2`), nên đẩy `authorId` xuống client là phá luôn lớp ẩn danh đó: ai
   * cũng nối được id thật với bí danh chỉ bằng cách xem mã nguồn trang.
   */
  cuaToi: boolean;
}

export interface BaiCongDong {
  id: string;
  kind: LoaiBai;
  tacGia: string;
  body: string;
  createdAt: Date;
  /** Xem chú thích ở `BinhLuanCongDong.cuaToi`. */
  cuaToi: boolean;
  binhLuan: BinhLuanCongDong[];
}

export interface BangTinCongDong {
  daDangNhap: boolean;
  /**
   * Người đang xem là admin — chỉ để quyết định có VẼ nút gỡ hay không. Không phải hàng
   * rào: policy `delete own or admin post` mới là thứ chặn, và nó chặn cả người gọi
   * thẳng Server Action mà chưa từng nhìn thấy cái nút.
   */
  laAdmin: boolean;
  daGiuLuaHomNay: boolean;
  streak: number;
  streakDaiNhat: number;
  danhHieu: DanhHieuStreak;
  bai: BaiCongDong[];
}

function biDanh(userId: string): string {
  const ma = createHash("sha256").update(userId).digest("hex").slice(0, 4).toUpperCase();
  return `Bạn đọc #${ma}`;
}

/**
 * Bảng tin mới nhất cùng trạng thái giữ lửa của người đang xem.
 *
 * ponytail: 30 bài + 200 bình luận mới nhất; thêm cursor pagination khi một lớp học
 * thường xuyên vượt trần này, thay vì tải cả lịch sử vào một request.
 */
export const readBangTin = cache(async function readBangTin(): Promise<BangTinCongDong> {
  const userId = await getSessionUserId();

  const { posts, comments, activities } = await withRole(userId, async (t) => {
    const posts = await CommunityPost.findAll({
      attributes: ["id", "authorId", "kind", "body", "createdAt"],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: 30,
      transaction: t,
    });

    const comments = posts.length
      ? await CommunityComment.findAll({
          attributes: ["id", "postId", "authorId", "body", "createdAt"],
          where: { postId: { [Op.in]: posts.map((p) => p.id) } },
          order: [
            ["createdAt", "DESC"],
            ["id", "DESC"],
          ],
          limit: 200,
          transaction: t,
        })
      : [];

    const activities = userId
      ? await UserActivity.findAll({ attributes: ["activeOn"], transaction: t })
      : [];

    return { posts, comments, activities };
  });

  // Hỏi SAU khi transaction ở trên đã đóng: `getAdminUserId()` tự mở transaction của nó,
  // và hai transaction lồng nhau trên cùng một connection Sequelize sẽ chồng lệnh.
  const laAdmin = userId ? (await getAdminUserId()) !== null : false;

  const theoBai = new Map<string, BinhLuanCongDong[]>();
  for (const comment of [...comments].reverse()) {
    const list = theoBai.get(comment.postId) ?? [];
    list.push({
      id: comment.id,
      tacGia: biDanh(comment.authorId),
      body: comment.body,
      createdAt: comment.createdAt,
      cuaToi: comment.authorId === userId,
    });
    theoBai.set(comment.postId, list);
  }

  const cacNgay = activities.map((row) => String(row.activeOn));
  const homNay = homNayVietNam();
  const streakDaiNhat = tinhStreakDaiNhat(cacNgay);

  return {
    daDangNhap: Boolean(userId),
    laAdmin,
    daGiuLuaHomNay: cacNgay.includes(homNay),
    streak: tinhStreak(cacNgay, homNay),
    streakDaiNhat,
    danhHieu: danhHieuTuStreakDaiNhat(streakDaiNhat),
    bai: posts.map((post) => ({
      id: post.id,
      kind: post.kind,
      tacGia: biDanh(post.authorId),
      body: post.body,
      createdAt: post.createdAt,
      cuaToi: post.authorId === userId,
      binhLuan: theoBai.get(post.id) ?? [],
    })),
  };
});
