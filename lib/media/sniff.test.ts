import test from "node:test";
import assert from "node:assert/strict";
import { sniffImage } from "./sniff.ts";

/** Dựng một buffer bắt đầu bằng `head`, độn thêm cho đủ `len` byte. */
const buf = (head: number[], len = 32): Uint8Array => {
  const b = new Uint8Array(len);
  b.set(head.slice(0, len));
  return b;
};

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

test("nhận đúng bốn kiểu trong allowlist", () => {
  assert.equal(sniffImage(buf(PNG)), "image/png");
  assert.equal(sniffImage(buf(JPEG)), "image/jpeg");
  assert.equal(sniffImage(buf(GIF87)), "image/gif");
  assert.equal(sniffImage(buf(GIF89)), "image/gif");
  assert.equal(sniffImage(buf(WEBP)), "image/webp");
});

test("SVG bị từ chối — nó là XML và sẽ thành stored XSS", () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.equal(sniffImage(svg), null);
});

test("SVG có khai báo XML ở đầu cũng bị từ chối", () => {
  const svg = new TextEncoder().encode('<?xml version="1.0"?><svg onload="alert(1)"/>');
  assert.equal(sniffImage(svg), null);
});

test("byte quyết định, không phải tên tệp: nội dung JPEG vẫn ra image/jpeg", () => {
  // Đây là toàn bộ lý do hàm này tồn tại — kẻ tấn công đặt tên .png và khai
  // content-type: image/png, nhưng byte mới là thứ trình duyệt thực thi.
  assert.equal(sniffImage(buf(JPEG)), "image/jpeg");
});

test("RIFF nhưng offset 8 không phải WEBP thì từ chối", () => {
  // "RIFF....WAVE" — file âm thanh, không phải ảnh. Chỉ kiểm 4 byte đầu là lọt.
  const wave = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45];
  assert.equal(sniffImage(buf(wave)), null);
});

test("buffer ngắn hơn chữ ký thì từ chối, không ném lỗi", () => {
  assert.equal(sniffImage(new Uint8Array(0)), null);
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50])), null);
  // Đúng "RIFF" nhưng cụt trước offset 8 — chỗ dễ đọc lệch mảng nhất.
  assert.equal(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00])), null);
});

test("rác ngẫu nhiên và HTML đều từ chối", () => {
  assert.equal(sniffImage(buf([0x00, 0x01, 0x02, 0x03])), null);
  assert.equal(sniffImage(new TextEncoder().encode("<!doctype html><h1>hi</h1>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("GIF")), null); // thiếu chữ số phiên bản
});

test("PNG thiếu một byte trong chữ ký 8 byte thì từ chối", () => {
  const almost = [...PNG];
  almost[7] = 0x00;
  assert.equal(sniffImage(buf(almost)), null);
});
