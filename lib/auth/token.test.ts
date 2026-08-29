import test from "node:test";
import assert from "node:assert/strict";
import { mintToken, readToken, type SessionPayload } from "./token.ts";

const SECRET = "bi-mat-dung-de-test";
const OTHER = "mot-bi-mat-khac";
const SUB = "11111111-1111-1111-1111-111111111111";
const NOW = 1_800_000_000;
const valid: SessionPayload = { sub: SUB, exp: NOW + 3600 };

test("token phát ra thì đọc lại được", () => {
  assert.deepEqual(readToken(mintToken(valid, SECRET), SECRET, NOW), valid);
});

test("sai bí mật thì từ chối", () => {
  assert.equal(readToken(mintToken(valid, SECRET), OTHER, NOW), null);
});

test("hết hạn thì từ chối, kể cả khi chữ ký đúng", () => {
  const expired = mintToken({ sub: SUB, exp: NOW - 1 }, SECRET);
  assert.equal(readToken(expired, SECRET, NOW), null);
});

test("đúng ngay giây hết hạn cũng là hết hạn", () => {
  const t = mintToken({ sub: SUB, exp: NOW }, SECRET);
  assert.equal(readToken(t, SECRET, NOW), null);
});

test("sửa payload thì chữ ký không còn khớp", () => {
  const [, sig] = mintToken(valid, SECRET).split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "ke-gia-mao", exp: NOW + 3600 }), "utf8")
    .toString("base64url");
  assert.equal(readToken(`${forged}.${sig}`, SECRET, NOW), null);
});

test("sửa một ký tự của chữ ký thì từ chối", () => {
  const t = mintToken(valid, SECRET);
  const flipped = t.slice(0, -1) + (t.at(-1) === "A" ? "B" : "A");
  assert.equal(readToken(flipped, SECRET, NOW), null);
});

test("chữ ký chứa ký tự đa byte thì trả null, không ném lỗi", () => {
  // Đúng số KÝ TỰ nhưng nhiều hơn về số BYTE. Nếu chốt độ dài quay lại so `sig.length`
  // với `expected.length`, nó lọt qua, crypto.timingSafeEqual ném RangeError, và test
  // này ĐỔ — đó chính là việc của nó. Xem chú thích ở token.ts.
  const [body, sig] = mintToken(valid, SECRET).split(".");
  for (const ch of ["é", "€"]) {
    const meo = ch + sig.slice(1);
    assert.equal(meo.length, sig.length, "phải giữ nguyên số ký tự");
    assert.ok(Buffer.byteLength(meo, "utf8") > sig.length, "và phải nhiều byte hơn");
    assert.equal(readToken(`${body}.${meo}`, SECRET, NOW), null, `phải từ chối: ${ch}`);
  }
});

test("token cụt hoặc thừa dấu chấm đều từ chối", () => {
  const t = mintToken(valid, SECRET);
  for (const bad of ["", ".", t.split(".")[0], `${t}.them`, "khong-co-dau-cham"]) {
    assert.equal(readToken(bad, SECRET, NOW), null, `phải từ chối: ${JSON.stringify(bad)}`);
  }
});

test("payload không phải JSON hợp lệ thì từ chối, không ném lỗi", () => {
  const body = Buffer.from("day khong phai json", "utf8").toString("base64url");
  const t = mintToken(valid, SECRET);
  // Ký lại đúng phần thân rác để chắc chắn nó rớt ở bước parse chứ không ở bước ký.
  const sig = t.split(".")[1];
  assert.equal(readToken(`${body}.${sig}`, SECRET, NOW), null);
});

test("thiếu sub hoặc exp sai kiểu thì từ chối", () => {
  for (const payload of [{ exp: NOW + 60 }, { sub: SUB }, { sub: "", exp: NOW + 60 }, { sub: SUB, exp: "mai" }]) {
    const t = mintToken(payload as unknown as SessionPayload, SECRET);
    assert.equal(readToken(t, SECRET, NOW), null, `phải từ chối: ${JSON.stringify(payload)}`);
  }
});

test("không có trường alg để mà đánh tráo — đó là điểm khác JWT", () => {
  const [body] = mintToken(valid, SECRET).split(".");
  const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(decoded).sort(), ["exp", "sub"]);
});
