import crypto from "node:crypto";

/**
 * Token phiên: một payload JSON kèm chữ ký HMAC-SHA256. Thuần, import tương đối — đó
 * là điều kiện để `node --test` chạy được nó (alias `@/` không resolve dưới test
 * runner của Node), và cũng là lý do file này tách khỏi `session.ts`.
 *
 * CỐ Ý KHÔNG DÙNG JWT, và cũng không cài thư viện JWT nào. Định dạng ở đây thiếu
 * đúng thứ đã sinh ra cả một họ lỗ hổng của JWT: **trường `alg`**. Không có nó thì
 * không có gì để kẻ tấn công thương lượng — không "alg: none", không đánh tráo
 * RS256 thành HS256. Thuật toán là một hằng số nằm trong code này.
 *
 * Ta cũng không cần thứ gì khác của JWT: không có bên thứ ba nào phải xác minh
 * token này, nên toàn bộ phần header/JWKS/xoay khóa là chi phí không mua được gì.
 */

export interface SessionPayload {
  /** user id, dạng uuid. */
  sub: string;
  /** Hết hạn, tính bằng giây kể từ epoch. */
  exp: number;
}

const b64u = (b: Buffer): string => b.toString("base64url");

function sign(body: string, secret: string): string {
  return b64u(crypto.createHmac("sha256", secret).update(body).digest());
}

export function mintToken(payload: SessionPayload, secret: string): string {
  const body = b64u(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(body, secret)}`;
}

/**
 * Trả về payload khi token hợp lệ VÀ chưa hết hạn; mọi trường hợp khác trả `null`.
 *
 * Trả null chứ không ném lỗi là chủ ý: phía gọi chỉ có một câu hỏi — "có phiên hợp
 * lệ không" — và mọi câu trả lời "không" đều dẫn tới cùng một xử lý. Phân biệt "chữ
 * ký sai" với "hết hạn" chỉ có ích cho người đang dò.
 */
export function readToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  if (typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = sign(body, secret);
  // So sánh phải hằng thời gian. `===` trên chuỗi thoát ra ở byte khác nhau đầu tiên,
  // đủ để dò dần từng byte chữ ký qua thời gian phản hồi.
  // timingSafeEqual ném lỗi nếu hai buffer khác độ dài, nên phải chặn trước — và bản
  // thân phép so độ dài không rò rỉ gì (độ dài chữ ký là hằng số công khai).
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  // Chữ ký đúng nghĩa là payload do CHÍNH TA phát ra, nhưng vẫn kiểm hình dạng: một
  // bản cũ của code có thể đã phát ra định dạng khác, và token cũ thì vẫn còn trong
  // trình duyệt người dùng sau khi deploy.
  if (typeof parsed !== "object" || parsed === null) return null;
  const { sub, exp } = parsed as Record<string, unknown>;
  if (typeof sub !== "string" || sub.length === 0) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (exp <= nowSeconds) return null;

  return { sub, exp };
}
