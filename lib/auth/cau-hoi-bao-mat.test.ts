import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { CAU_HOI_BAO_MAT, laMaCauHoi, timCauHoi } from "./cau-hoi-bao-mat.ts";

test("mã câu hỏi không trùng nhau", () => {
  const ma = CAU_HOI_BAO_MAT.map((c) => c.ma);
  assert.equal(new Set(ma).size, ma.length);
});

test("mã ngoài danh sách bị từ chối, kể cả giá trị không phải chuỗi", () => {
  assert.equal(laMaCauHoi("truong-tieu-hoc"), true);
  assert.equal(laMaCauHoi("khong-co-that"), false);
  assert.equal(laMaCauHoi(""), false);
  assert.equal(laMaCauHoi(null), false);
  assert.equal(laMaCauHoi(42), false);
  assert.equal(timCauHoi(undefined), null);
});

test("mỗi câu hỏi đều có nội dung hỏi thật", () => {
  for (const c of CAU_HOI_BAO_MAT) {
    assert.match(c.ma, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(c.hoi.trim().length > 10, `câu hỏi "${c.ma}" quá ngắn`);
    assert.ok(c.hoi.endsWith("?"), `câu hỏi "${c.ma}" phải là một câu hỏi`);
  }
});

/**
 * CỔNG CHỐNG LỆCH. Danh sách câu hỏi tồn tại ở HAI nơi: mảng trên và ràng buộc
 * `users_security_question_ck` trong `db/schema/15-mat-khau.sql`. Lệch nhau thì hoặc là
 * một câu hỏi hiện trên giao diện mà database từ chối (người dùng đăng ký hỏng với một
 * lỗi khó hiểu), hoặc là database nhận một mã mà giao diện không biết hiển thị.
 *
 * Đọc thẳng file SQL thay vì chép tay lần thứ ba — chép tay là đúng cái lỗi đang cần chặn.
 */
test("danh sách TS khớp allowlist trong 15-mat-khau.sql", () => {
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "schema", "15-mat-khau.sql"),
    "utf8",
  );

  const khoi = /CONSTRAINT users_security_question_ck\s+CHECK \(security_question IN \(([^)]*)\)\)/.exec(sql);
  assert.ok(khoi, "không tìm thấy ràng buộc users_security_question_ck trong file SQL");

  const trongSql = [...khoi[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(trongSql, CAU_HOI_BAO_MAT.map((c) => c.ma));
});

/**
 * Hàm `app.cau_hoi_khoi_phuc` chọn câu hỏi mồi bằng `% array_length(v_ds, 1)` trên CHÍNH
 * một mảng chép tay thứ ba nằm trong thân hàm. Lệch mảng đó thì email không tồn tại sẽ
 * nhận về một mã mà giao diện không dựng được câu hỏi — lộ ngay ra rằng tài khoản không
 * tồn tại, đúng thứ hàm đó sinh ra để giấu.
 */
test("mảng câu hỏi mồi trong hàm SQL cũng khớp", () => {
  const sql = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "db", "schema", "15-mat-khau.sql"),
    "utf8",
  );

  const khoi = /v_ds\s+text\[\]\s*:=\s*ARRAY\[([^\]]*)\]/.exec(sql);
  assert.ok(khoi, "không tìm thấy mảng v_ds trong app.cau_hoi_khoi_phuc");

  const trongSql = [...khoi[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(trongSql.sort(), CAU_HOI_BAO_MAT.map((c) => c.ma).sort());
});
