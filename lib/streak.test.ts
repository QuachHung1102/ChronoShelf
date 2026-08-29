import { test } from "node:test";
import assert from "node:assert/strict";
import { tinhStreak } from "./streak.ts";

test("chưa hoạt động ngày nào thì chuỗi bằng 0", () => {
  assert.equal(tinhStreak([], "2026-08-30"), 0);
});

test("học hôm nay, chưa có hôm trước — chuỗi bằng 1", () => {
  assert.equal(tinhStreak(["2026-08-30"], "2026-08-30"), 1);
});

test("ba ngày liền tính tới hôm nay", () => {
  assert.equal(tinhStreak(["2026-08-28", "2026-08-29", "2026-08-30"], "2026-08-30"), 3);
});

test("hôm nay chưa học nhưng hôm qua có — chuỗi CHƯA đứt", () => {
  // Nếu không có quy ước này thì chuỗi của mọi người về 0 lúc 0 giờ mỗi đêm.
  assert.equal(tinhStreak(["2026-08-28", "2026-08-29"], "2026-08-30"), 2);
});

test("trống trọn một ngày thì chuỗi đứt hẳn", () => {
  assert.equal(tinhStreak(["2026-08-27", "2026-08-28"], "2026-08-30"), 0);
});

test("chỉ đếm đoạn liền kề gần nhất, không cộng dồn các đoạn cũ", () => {
  const ngay = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-29", "2026-08-30"];
  assert.equal(tinhStreak(ngay, "2026-08-30"), 2);
});

test("ngày lặp lại không làm chuỗi dài thêm", () => {
  assert.equal(tinhStreak(["2026-08-30", "2026-08-30", "2026-08-29"], "2026-08-30"), 2);
});

test("thứ tự đầu vào không quan trọng", () => {
  const xuoi = ["2026-08-28", "2026-08-29", "2026-08-30"];
  assert.equal(tinhStreak([...xuoi].reverse(), "2026-08-30"), 3);
});

test("bắc qua ranh giới tháng", () => {
  assert.equal(tinhStreak(["2026-07-30", "2026-07-31", "2026-08-01"], "2026-08-01"), 3);
});

test("bắc qua ranh giới năm", () => {
  assert.equal(tinhStreak(["2026-12-31", "2027-01-01"], "2027-01-01"), 2);
});

test("ngày 29/2 của năm nhuận không làm đứt chuỗi", () => {
  // 2028 là năm nhuận. Một cách tính bằng "cộng 1 vào ngày" ngây thơ sẽ trượt ở đây.
  assert.equal(tinhStreak(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01"), 3);
});

test("ngày ở tương lai không được tính thành chuỗi, và không được làm hàm nổ", () => {
  // Đồng hồ máy khách chạy sai hoặc dữ liệu hỏng thì trả 0, chứ không phải một con số bịa.
  assert.equal(tinhStreak(["2027-01-01"], "2026-08-30"), 0);
});
