import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "./safe-next.ts";

test("đường dẫn nội bộ đi qua nguyên vẹn", () => {
  assert.equal(safeNext("/lich-su-viet-nam"), "/lich-su-viet-nam");
  assert.equal(safeNext("/a?b=1#c"), "/a?b=1#c");
});

test("chặn URL tuyệt đối theo giao thức — đây là lỗ open redirect", () => {
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("///evil.com"), "/");
});

test("chặn URL tuyệt đối thường", () => {
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("javascript:alert(1)"), "/");
});

test("thiếu hoặc sai kiểu thì về trang chủ", () => {
  assert.equal(safeNext(undefined), "/");
  assert.equal(safeNext(["/a", "/b"]), "/");
  assert.equal(safeNext(""), "/");
});

// Dựng payload bằng mã ký tự chứ không phải literal: dấu gạch chéo ngược rất dễ mất một
// lớp escape khi đi qua nhiều lớp công cụ, và một phép kiểm mất escape thì đạt vì lý do sai.
const B = String.fromCharCode(92); // \
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

test("gạch chéo ngược và ký tự điều khiển không được thoát ra ngoài origin", () => {
  // Khẳng định theo ORIGIN của kết quả, không theo chuỗi trả về: hàng rào cần giữ là
  // "không đi ra khỏi app", chứ không phải một danh sách payload cụ thể.
  for (const sep of [B, B + B, B + "/", TAB + "/", LF + "/", CR + "/", TAB + B]) {
    const payload = "/" + sep + "evil.com";
    const out = safeNext(payload);
    assert.equal(
      new URL(out, "http://app.test/").origin,
      "http://app.test",
      `lọt: ${JSON.stringify(payload)} -> ${JSON.stringify(out)}`,
    );
  }
});
