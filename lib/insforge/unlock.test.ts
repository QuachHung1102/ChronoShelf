import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveState } from "./unlock.ts";

const none = new Set<string>();
const withDrum = new Set(["trong-dong"]);

test("quyển đầu kệ luôn mở, kể cả khi túi rỗng", () => {
  assert.equal(resolveState(null, true, false, none), "unlocked");
});

test("quyển sau bị khóa khi chưa có vật phẩm mở khóa", () => {
  assert.equal(resolveState("trong-dong", false, false, none), "locked");
});

test("có đúng vật phẩm thì mở", () => {
  assert.equal(resolveState("trong-dong", false, false, withDrum), "unlocked");
});

test("vật phẩm khác không mở được", () => {
  assert.equal(resolveState("trong-dong", false, false, new Set(["no-than"])), "locked");
});

test("đã đọc xong thì luôn là completed, kể cả khi mất vật phẩm", () => {
  assert.equal(resolveState("trong-dong", false, true, none), "completed");
});

test("quyển trước không thưởng gì thì quyển sau không có cổng", () => {
  assert.equal(resolveState(null, false, false, none), "unlocked");
});

test("quyển đầu kệ mở bất kể tham số vật phẩm — không có 'quyển trước' để mà đòi", () => {
  assert.equal(resolveState("trong-dong", true, false, none), "unlocked");
});
