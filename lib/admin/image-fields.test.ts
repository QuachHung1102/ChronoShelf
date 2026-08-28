import test from "node:test";
import assert from "node:assert/strict";
import { readImageFields } from "./image-fields.ts";

const SHA = "a".repeat(64);
const URL_OK = `/media/${SHA}`;

/** Dựng FormData với tiền tố `image`. */
function fd(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

test("không có ảnh thì cả ba cột về null", () => {
  assert.deepEqual(readImageFields(fd({}), "image"), { url: null, source: null, credit: null });
});

test("gỡ ảnh gỡ luôn credit — không để lại trạng thái nửa vời", () => {
  // Người dùng bấm "Gỡ ảnh": ba input biến mất khỏi DOM nên form gửi lên rỗng. Kể cả khi
  // source/credit vẫn còn sót lại, không có ảnh thì chúng phải bị bỏ.
  const r = readImageFields(fd({ imageSource: "https://x.vn", imageCredit: "Ai đó" }), "image");
  assert.deepEqual(r, { url: null, source: null, credit: null });
});

test("đủ ba trường thì qua", () => {
  const r = readImageFields(
    fd({ imageUrl: URL_OK, imageSource: "https://commons.wikimedia.org/x", imageCredit: "Tác giả · CC BY-SA 4.0" }),
    "image",
  );
  assert.deepEqual(r, {
    url: URL_OK,
    source: "https://commons.wikimedia.org/x",
    credit: "Tác giả · CC BY-SA 4.0",
  });
});

test("có ảnh mà thiếu nguồn hoặc thiếu tác giả đều bị từ chối", () => {
  const cases: Record<string, string>[] = [
    { imageUrl: URL_OK },
    { imageUrl: URL_OK, imageSource: "https://x.vn" },
    { imageUrl: URL_OK, imageCredit: "Ai đó" },
    { imageUrl: URL_OK, imageSource: "   ", imageCredit: "Ai đó" },
  ];
  for (const partial of cases) {
    const r = readImageFields(fd(partial), "image");
    assert.ok("error" in r, `phải từ chối: ${JSON.stringify(partial)}`);
  }
});

test("hotlink ra ngoài bị chặn — link ngoài chết là ảnh biến mất khỏi bài học", () => {
  const r = readImageFields(
    fd({ imageUrl: "https://upload.wikimedia.org/a.jpg", imageSource: "s", imageCredit: "c" }),
    "image",
  );
  assert.ok("error" in r);
});

test("javascript: và data: bị chặn", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.vn/a.png"]) {
    const r = readImageFields(fd({ imageUrl: bad, imageSource: "s", imageCredit: "c" }), "image");
    assert.ok("error" in r, `phải chặn: ${bad}`);
  }
});

test("đường dẫn giả dạng /media/ nhưng sai dạng sha256 bị chặn", () => {
  for (const bad of [
    "/media/deadbeef", // quá ngắn
    `/media/${"A".repeat(64)}`, // chữ hoa — sha256 của ta luôn viết thường
    `/media/${"a".repeat(63)}`, // thiếu một ký tự
    `/media/${SHA}/../../etc/passwd`, // traversal nối đuôi
    `/media/${SHA}?x=1`, // query nhét thêm
  ]) {
    const r = readImageFields(fd({ imageUrl: bad, imageSource: "s", imageCredit: "c" }), "image");
    assert.ok("error" in r, `phải chặn: ${bad}`);
  }
});

test("SVG seed commit sẵn vẫn sửa được — nếu không thì mở vật phẩm cũ ra đổi tên cũng hỏng", () => {
  const r = readImageFields(
    fd({ imageUrl: "/items/trong-dong.svg", imageSource: "repo", imageCredit: "Tự vẽ · CC0" }),
    "image",
  );
  assert.ok(!("error" in r));
});

test("mẫu SVG seed vẫn chặt: không nhận đường dẫn lạ trong /items/", () => {
  for (const bad of ["/items/../secret.svg", "/items/a.png", "/items/Trong-Dong.svg", "/items/a/b.svg"]) {
    const r = readImageFields(fd({ imageUrl: bad, imageSource: "s", imageCredit: "c" }), "image");
    assert.ok("error" in r, `phải chặn: ${bad}`);
  }
});

test("tiền tố cover đọc đúng bộ trường của bảng books", () => {
  const r = readImageFields(
    fd({ coverUrl: URL_OK, coverSource: "s", coverCredit: "c", imageUrl: "/media/khac" }),
    "cover",
  );
  assert.deepEqual(r, { url: URL_OK, source: "s", credit: "c" });
});
