import { QueryTypes } from "sequelize";
import { sequelize } from "@/lib/db/sequelize";
import { withRole } from "@/lib/db/tx";
import { getAdminUserId } from "./gate";

/**
 * ĐỌC câu hỏi trắc nghiệm KÈM ĐÁP ÁN của một quyển. Không có `"use server"` — xem `shelves.ts`.
 *
 * Đây là đường đọc đáp án DUY NHẤT của tầng Node, và nó cố tình không đi qua model
 * `BookQuestion`: model đó không khai cột `correct_index`, và role ứng dụng cũng không
 * có `GRANT SELECT` trên cột đó. Cửa duy nhất là hàm SECURITY DEFINER
 * `public.admin_book_questions`, hàm tự kiểm `is_admin()` bên trong — nên kể cả khi
 * `getAdminUserId()` ở đây lỡ bị bỏ qua, người thường vẫn nhận về một exception chứ
 * không phải đáp án.
 */

export interface AdminQuestionRow {
  id: string;
  position: number;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

interface QuestionRow {
  id: string;
  position: number;
  prompt: string;
  choices: string[];
  correct_index: number;
}

export async function listQuestions(bookSlug: string): Promise<AdminQuestionRow[]> {
  const userId = await getAdminUserId();
  if (!userId) return [];

  const rows = await withRole(userId, (t) =>
    sequelize.query<QuestionRow>("SELECT * FROM public.admin_book_questions($1)", {
      bind: [bookSlug],
      transaction: t,
      type: QueryTypes.SELECT,
    }),
  );

  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    prompt: r.prompt,
    choices: r.choices,
    correctIndex: Number(r.correct_index),
  }));
}
