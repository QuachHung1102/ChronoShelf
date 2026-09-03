import { strict as assert } from "node:assert";
import { test } from "node:test";
import { laGoiZip, PPTX_MIME, sniffImage } from "./sniff.ts";

const goiZip = (them: number[] = []) => new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...them]);

test("gói ZIP được nhận", () => {
  assert.equal(laGoiZip(goiZip([0x14, 0x00, 0x06, 0x00])), true);
});

test("file rỗng và file ngắn hơn chữ ký không làm hàm nổ", () => {
  assert.equal(laGoiZip(new Uint8Array([])), false);
  assert.equal(laGoiZip(new Uint8Array([0x50, 0x4b])), false);
});

test("PK nhưng sai hai byte sau bị từ chối — 'PK\x05\x06' là ZIP RỖNG, không có tệp nào", () => {
  assert.equal(laGoiZip(new Uint8Array([0x50, 0x4b, 0x05, 0x06])), false);
});

test("ảnh và rác không phải gói ZIP", () => {
  assert.equal(laGoiZip(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
  assert.equal(laGoiZip(new Uint8Array([0x3c, 0x21, 0x44, 0x4f])), false); // "<!DO"
});

test("hai phép sniff không nhận nhầm nhau", () => {
  // Một tấm PNG không được coi là bộ slide, và một gói ZIP không được coi là ảnh.
  assert.equal(laGoiZip(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), false);
  assert.equal(sniffImage(goiZip()), null);
});

test("MIME của pptx viết đúng chuỗi OOXML — sai một ký tự là CHECK của DB từ chối", () => {
  assert.equal(
    PPTX_MIME,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
});
