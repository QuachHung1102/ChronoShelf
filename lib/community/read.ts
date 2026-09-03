import { createHash } from "node:crypto";
import { cache } from "react";
import { Op } from "sequelize";
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
}

export interface BaiCongDong {
  id: string;
  kind: LoaiBai;
  tacGia: string;
  body: string;
  createdAt: Date;
  binhLuan: BinhLuanCongDong[];
}

export interface BangTinCongDong {
  daDangNhap: boolean;
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

  const theoBai = new Map<string, BinhLuanCongDong[]>();
  for (const comment of [...comments].reverse()) {
    const list = theoBai.get(comment.postId) ?? [];
    list.push({
      id: comment.id,
      tacGia: biDanh(comment.authorId),
      body: comment.body,
      createdAt: comment.createdAt,
    });
    theoBai.set(comment.postId, list);
  }

  const cacNgay = activities.map((row) => String(row.activeOn));
  const homNay = homNayVietNam();
  const streakDaiNhat = tinhStreakDaiNhat(cacNgay);

  return {
    daDangNhap: Boolean(userId),
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
      binhLuan: theoBai.get(post.id) ?? [],
    })),
  };
});
