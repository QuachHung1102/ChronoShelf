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
