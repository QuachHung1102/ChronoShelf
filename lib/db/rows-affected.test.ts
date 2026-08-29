import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsAffected } from "./rows-affected.ts";

// Đây là hình dạng THẬT mà `sequelize.query(sql, { bind, transaction })` trả về trên
// dialect postgres: `[rows, pg.Result]`. Hai case dưới đây là lý do tồn tại của cả
// module — ai quay lại kiểu `(r as [unknown, number])[1]` sẽ làm chúng đỏ ngay.
test("postgres: đọc rowCount trong đối tượng pg.Result", () => {
  assert.equal(rowsAffected([[], { command: "UPDATE", rowCount: 0 }]), 0);
  assert.equal(rowsAffected([[], { command: "DELETE", rowCount: 3 }]), 3);
});

test("dialect trả thẳng một con số thì dùng luôn", () => {
  assert.equal(rowsAffected([[], 0]), 0);
  assert.equal(rowsAffected([[], 3]), 3);
});

// Không nhận ra thì phải là 0 — "coi như không đụng dòng nào" để lời gọi báo lỗi,
// chứ không phải một con số bịa khiến hàng rào báo đạt.
test("hình dạng lạ trả 0, không ném", () => {
  assert.equal(rowsAffected([[], { command: "SET", rowCount: null }]), 0);
  assert.equal(rowsAffected([[], {}]), 0);
  assert.equal(rowsAffected([[], undefined]), 0);
  assert.equal(rowsAffected([[]]), 0);
  assert.equal(rowsAffected({ rowCount: 3 }), 0);
  assert.equal(rowsAffected(undefined), 0);
  assert.equal(rowsAffected(null), 0);
});
