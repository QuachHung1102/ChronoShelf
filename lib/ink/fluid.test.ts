import assert from "node:assert/strict";
import test from "node:test";
import { clamp01, toBasinCoords } from "./fluid.ts";

/**
 * Chỉ phần hình học được test, và đó là chủ ý: bộ giải chạy trên GPU nên `node --test` không
 * chạm tới được, nhưng nó cũng hỏng RÕ RÀNG khi hỏng (không có mực, hoặc nhiễu trắng).
 *
 * `toBasinCoords` thì ngược lại — nó là chỗ duy nhất trong engine sai được trong IM LẶNG:
 * lật nhầm trục Y thì mực vẫn loang đẹp, chỉ loang ngược chỗ con trỏ, và không cổng nào kêu.
 */

const RECT = { left: 100, top: 50, width: 400, height: 200 };

test("gốc toạ độ nằm ở góc DƯỚI trái, không phải trên trái", () => {
  // Góc trên-trái của phần tử theo DOM = y 1.0 trong texture WebGL.
  assert.deepEqual(toBasinCoords(100, 50, RECT), { x: 0, y: 1 });
  // Góc dưới-trái = gốc.
  assert.deepEqual(toBasinCoords(100, 250, RECT), { x: 0, y: 0 });
});

test("tâm phần tử ra đúng tâm chậu", () => {
  assert.deepEqual(toBasinCoords(300, 150, RECT), { x: 0.5, y: 0.5 });
});

test("con trỏ ra ngoài phần tử bị kẹp vào bờ chậu", () => {
  // Kéo chuột ra ngoài rồi thả là chuyện thường; không kẹp thì splat rơi ngoài lưới và
  // biến mất, tức cú tương tác cuối cùng của người dùng không để lại dấu vết nào.
  const p = toBasinCoords(-9999, 9999, RECT);
  assert.deepEqual(p, { x: 0, y: 0 });
  const q = toBasinCoords(9999, -9999, RECT);
  assert.deepEqual(q, { x: 1, y: 1 });
});

test("clamp01 giữ nguyên giá trị trong khoảng", () => {
  assert.equal(clamp01(0.42), 0.42);
  assert.equal(clamp01(0), 0);
  assert.equal(clamp01(1), 1);
});
