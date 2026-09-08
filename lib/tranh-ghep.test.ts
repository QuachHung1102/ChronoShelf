import assert from "node:assert/strict";
import test from "node:test";
import { manhGhep } from "./tranh-ghep.ts";

test("mảnh đầu dán mép trái, mảnh cuối dán mép phải", () => {
  assert.deepEqual(manhGhep(0, 4), {
    backgroundSize: "400% auto",
    backgroundPosition: "0% 50%",
  });
  assert.deepEqual(manhGhep(3, 4), {
    backgroundSize: "400% auto",
    backgroundPosition: "100% 50%",
  });
});

test("chiều dọc để auto — ảnh giữ đúng tỉ lệ, không bị bóp vào dải 6.55:1", () => {
  // Ép `100%` chiều dọc là kéo ngang một tấm 4:3 lên 4,91 lần. Phép kiểm này giữ đúng
  // chuyện đó: mọi mảnh phải là `auto` và neo giữa theo chiều dọc.
  for (const [i, n] of [[0, 4], [2, 5], [0, 1]] as const) {
    const m = manhGhep(i, n);
    assert.ok(m.backgroundSize.endsWith(" auto"), `${i}/${n}: ${m.backgroundSize}`);
    assert.ok(m.backgroundPosition.endsWith(" 50%"), `${i}/${n}: ${m.backgroundPosition}`);
  }
});

test("mẫu số là tong-1, không phải tong", () => {
  // Sai mẫu số thì mảnh 1/4 ra 25% và mảnh cuối không bao giờ chạm mép phải — bức tranh
  // ghép lại vẫn hụt một dải. Đây là phép kiểm giữ đúng chuyện đó.
  assert.equal(manhGhep(1, 4).backgroundPosition, "33.333% 50%");
  assert.equal(manhGhep(2, 4).backgroundPosition, "66.667% 50%");
  assert.equal(manhGhep(1, 3).backgroundPosition, "50% 50%");
});

test("một mảnh hoặc không mảnh nào thì đó là nguyên bức tranh", () => {
  for (const tong of [0, 1, -3]) {
    assert.deepEqual(manhGhep(0, tong), {
      backgroundSize: "100% auto",
      backgroundPosition: "0% 50%",
    });
  }
});

test("chỉ số ngoài khoảng bị kẹp chứ không trượt ra ngoài ảnh", () => {
  assert.equal(manhGhep(99, 4).backgroundPosition, "100% 50%");
  assert.equal(manhGhep(-5, 4).backgroundPosition, "0% 50%");
  assert.equal(manhGhep(1.9, 4).backgroundPosition, "33.333% 50%");
});
