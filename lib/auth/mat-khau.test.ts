import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bamMoi,
  bamTheoThamSo,
  chuanHoaDapAn,
  docThamSo,
  kiemMatKhau,
  MAT_KHAU_TOI_THIEU,
} from "./mat-khau.ts";

test("băm rồi băm lại theo đúng tham số thì khớp", async () => {
  const { thamSo, bam } = await bamMoi("mat-khau-cua-toi");
  assert.equal(await bamTheoThamSo("mat-khau-cua-toi", thamSo), bam);
});

test("mật khẩu khác thì bản băm khác", async () => {
  const { thamSo, bam } = await bamMoi("mat-khau-cua-toi");
  assert.notEqual(await bamTheoThamSo("mat-khau-cua-toi ", thamSo), bam);
  assert.notEqual(await bamTheoThamSo("Mat-khau-cua-toi", thamSo), bam);
});

test("hai lần băm cùng một mật khẩu ra salt khác nhau", async () => {
  const a = await bamMoi("giong-het-nhau");
  const b = await bamMoi("giong-het-nhau");
  assert.notEqual(a.thamSo, b.thamSo);
  assert.notEqual(a.bam, b.bam, "salt khác mà bản băm giống nhau nghĩa là salt không vào băm");
});

test("mật khẩu tiếng Việt gõ bằng tổ hợp hay dựng sẵn đều khớp", async () => {
  // Cùng một chuỗi nhìn giống hệt: một bản NFC, một bản NFD (dấu tách rời).
  const nfc = "mậtkhẩuTiếngViệt";
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfc, nfd, "hai bản phải khác nhau ở mức chuỗi, nếu không phép thử rỗng nghĩa");

  const { thamSo, bam } = await bamMoi(nfc);
  assert.equal(await bamTheoThamSo(nfd, thamSo), bam);
});

test("tham số méo trả null chứ không ném", async () => {
  for (const xau of ["", "khong-phai-tham-so", "scrypt$N=abc,r=8,p=1,len=64$AAAAAAAAAAA", null, 7]) {
    assert.equal(docThamSo(xau), null, `"${String(xau)}" lẽ ra phải bị từ chối`);
    assert.equal(await bamTheoThamSo("x", xau), null);
  }
});

test("N không phải lũy thừa của 2 bị từ chối — scrypt sẽ ném nếu để lọt", () => {
  assert.equal(docThamSo("scrypt$N=1000,r=8,p=1,len=64$AAAAAAAAAAAAAAAAAAAAAA"), null);
  assert.ok(docThamSo("scrypt$N=1024,r=8,p=1,len=64$AAAAAAAAAAAAAAAAAAAAAA"));
});

test("N khổng lồ bị chặn — nếu không thì ô đăng nhập thành nút tắt máy chủ", () => {
  // 128 · 2^30 · 8 byte ≈ 1 TiB. Không được để scrypt nhận con số này.
  assert.equal(docThamSo("scrypt$N=1073741824,r=8,p=1,len=64$AAAAAAAAAAAAAAAAAAAAAA"), null);
});

test("salt quá ngắn bị từ chối", () => {
  assert.equal(docThamSo("scrypt$N=32768,r=8,p=1,len=64$AAAA"), null);
});

test("chuẩn hóa đáp án: bỏ dấu, hạ chữ thường, gộp khoảng trắng", () => {
  const chuan = chuanHoaDapAn("Hà Nội");
  assert.equal(chuan, "ha noi");
  for (const bien of ["hà nội", "HÀ NỘI", "  Hà   Nội  ", "ha noi", "Ha Noi"]) {
    assert.equal(chuanHoaDapAn(bien), chuan, `"${bien}" phải khớp với "Hà Nội"`);
  }
});

test("chữ đ được chuẩn hóa — NFD không tách được nó", () => {
  assert.equal(chuanHoaDapAn("Đà Nẵng"), "da nang");
  assert.equal(chuanHoaDapAn("đà nẵng"), "da nang");
});

test("hai đáp án khác nhau vẫn khác nhau sau khi chuẩn hóa", () => {
  assert.notEqual(chuanHoaDapAn("Hà Nội"), chuanHoaDapAn("Hà Nam"));
});

test("mật khẩu ngắn hơn ngưỡng bị từ chối, đếm theo KÝ TỰ chứ không theo byte", () => {
  assert.ok(kiemMatKhau("a".repeat(MAT_KHAU_TOI_THIEU - 1)));
  assert.equal(kiemMatKhau("a".repeat(MAT_KHAU_TOI_THIEU)), null);

  // 8 ký tự tiếng Việt = 24 byte UTF-8. Đếm theo byte thì chuỗi này "đủ dài" một cách
  // giả tạo; đếm theo ký tự mới đúng. 7 ký tự phải trượt dù đã 21 byte.
  const bay = "mậtkhẩu";
  assert.equal([...bay].length, 7);
  assert.ok(Buffer.byteLength(bay) > MAT_KHAU_TOI_THIEU);
  assert.ok(kiemMatKhau(bay), "7 ký tự phải bị từ chối dù nhiều hơn 8 byte");
});

test("thiếu mật khẩu hoặc sai kiểu đều bị từ chối, không ném", () => {
  assert.ok(kiemMatKhau(undefined));
  assert.ok(kiemMatKhau(null));
  assert.ok(kiemMatKhau(12345678));
});

test("mật khẩu quá dài bị từ chối", () => {
  assert.ok(kiemMatKhau("a".repeat(201)));
  assert.equal(kiemMatKhau("a".repeat(200)), null);
});
