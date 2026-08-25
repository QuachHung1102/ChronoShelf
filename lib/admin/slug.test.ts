import test from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug } from "./slug.ts";

test("bỏ dấu tiếng Việt, giữ số", () => {
  assert.equal(slugify("Trận chiến Bạch Đằng 938"), "tran-chien-bach-dang-938");
});

test("chữ đ không tách được bằng NFD nên phải thay riêng", () => {
  assert.equal(slugify("Đường mòn"), "duong-mon");
});

test("gộp mọi khoảng trắng và dấu câu thành một gạch nối", () => {
  assert.equal(slugify("Nhà  Trần —  thế kỷ XIII!"), "nha-tran-the-ky-xiii");
});

test("không để gạch nối thừa ở hai đầu", () => {
  assert.equal(slugify("  ...Hào khí Đông A...  "), "hao-khi-dong-a");
});

test("chuỗi không còn ký tự nào dùng được thì trả về rỗng", () => {
  assert.equal(slugify("!!! ???"), "");
});

test("slug chưa ai dùng thì giữ nguyên", () => {
  assert.equal(uniqueSlug("bach-dang", new Set()), "bach-dang");
});

test("trùng thì thêm hậu tố số, đếm từ 2", () => {
  assert.equal(uniqueSlug("bach-dang", new Set(["bach-dang"])), "bach-dang-2");
});

test("nhảy qua mọi hậu tố đã bị chiếm", () => {
  assert.equal(
    uniqueSlug("bach-dang", new Set(["bach-dang", "bach-dang-2", "bach-dang-3"])),
    "bach-dang-4",
  );
});
