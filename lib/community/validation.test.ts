import { test } from "node:test";
import assert from "node:assert/strict";
import { docLoaiBai, docNoiDung } from "./validation.ts";

test("nội dung hợp lệ được bỏ khoảng trắng thừa ở hai đầu", () => {
  assert.deepEqual(docNoiDung("  Trận Bạch Đằng diễn ra năm nào?  ", 1_000), {
    value: "Trận Bạch Đằng diễn ra năm nào?",
  });
});

test("nội dung rỗng sau khi trim bị từ chối", () => {
  assert.deepEqual(docNoiDung("   \n\t", 1_000), {
    error: "Nội dung không được để trống.",
  });
});

test("giá trị FormData bị thiếu hoặc không phải chuỗi bị từ chối", () => {
  assert.deepEqual(docNoiDung(null, 1_000), {
    error: "Nội dung không được để trống.",
  });
});

test("nội dung vượt giới hạn bị từ chối với đúng giới hạn trong thông báo", () => {
  assert.deepEqual(docNoiDung("a".repeat(1_001), 1_000), {
    error: "Nội dung không được vượt quá 1000 ký tự.",
  });
});

test("giới hạn ký tự khớp PostgreSQL với Unicode ngoài BMP", () => {
  assert.ok("value" in docNoiDung("😀".repeat(500), 500));
  assert.ok("error" in docNoiDung("😀".repeat(501), 500));
});

test("hai loại bài được đặc tả đều hợp lệ", () => {
  assert.deepEqual([docLoaiBai("chia-se"), docLoaiBai("cau-hoi")], ["chia-se", "cau-hoi"]);
});

test("loại bài ngoài allowlist bị từ chối", () => {
  assert.equal(docLoaiBai("thao-luan"), null);
});
