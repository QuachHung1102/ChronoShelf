import assert from "node:assert/strict";
import test from "node:test";
import { manhGhep } from "./tranh-ghep.ts";

test("mảnh đầu dán mép trái, mảnh cuối dán mép phải", () => {
  assert.deepEqual(manhGhep(0, 4), {
    backgroundSize: "400% 100%",
    backgroundPosition: "0% 0%",
  });
  assert.deepEqual(manhGhep(3, 4), {
    backgroundSize: "400% 100%",
    backgroundPosition: "100% 0%",
  });
});

test("mẫu số là tong-1, không phải tong", () => {
  // Sai mẫu số thì mảnh 1/4 ra 25% và mảnh cuối không bao giờ chạm mép phải — bức tranh
  // ghép lại vẫn hụt một dải. Đây là phép kiểm giữ đúng chuyện đó.
  assert.equal(manhGhep(1, 4).backgroundPosition, "33.333% 0%");
  assert.equal(manhGhep(2, 4).backgroundPosition, "66.667% 0%");
  assert.equal(manhGhep(1, 3).backgroundPosition, "50% 0%");
});

test("một mảnh hoặc không mảnh nào thì đó là nguyên bức tranh", () => {
  for (const tong of [0, 1, -3]) {
    assert.deepEqual(manhGhep(0, tong), {
      backgroundSize: "100% 100%",
      backgroundPosition: "0% 0%",
    });
  }
});

test("chỉ số ngoài khoảng bị kẹp chứ không trượt ra ngoài ảnh", () => {
  assert.equal(manhGhep(99, 4).backgroundPosition, "100% 0%");
  assert.equal(manhGhep(-5, 4).backgroundPosition, "0% 0%");
  assert.equal(manhGhep(1.9, 4).backgroundPosition, "33.333% 0%");
});
