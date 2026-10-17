import assert from "node:assert/strict";
import test from "node:test";
import { GOC_VANG, chonGiot, giotRoi, nhipNgauNhien, viTriGiot } from "./giot.ts";

/**
 * Phép kiểm quan trọng nhất ở đây là phép ĐẦU TIÊN, và nó tồn tại vì một lỗi đã ship: giọt
 * mực tràn ra ngoài mép phải canvas rồi dồn thành một mảng ở góc. Trên màn hình nó vẫn là
 * mực đẹp, nên không ai nhận ra cho tới khi có người nhìn kỹ và hỏi "cố ý hay lỗi?".
 */

const BO = [0.56, 0.65, 0.72];
const TONG = [1, 4, 6, 12, 40];

test("mọi giọt nằm trong vùng nước, không tràn khung và không chui hết xuống bờ", () => {
  for (const bo of BO) {
    for (const tong of TONG) {
      for (let i = 0; i < tong; i++) {
        const { x, y } = viTriGiot(i, bo, tong);
        assert.ok(
          x > bo,
          `giọt ${i}/${tong} ở bờ ${bo} có x=${x.toFixed(3)} — chui xuống dưới tấm giấy`,
        );
        assert.ok(x < 1, `giọt ${i}/${tong} ở bờ ${bo} có x=${x.toFixed(3)} — tràn khỏi mép phải`);
        assert.ok(y > 0 && y < 1, `giọt ${i}/${tong} có y=${y.toFixed(3)} — tràn khỏi chậu`);
      }
    }
  }
});

test("tất định — cùng đầu vào cho cùng vị trí", () => {
  // Chậu không được nhảy chỗ giữa hai lần mở cùng một kệ.
  assert.deepEqual(viTriGiot(3, 0.56, 6), viTriGiot(3, 0.56, 6));
});

test("bờ rộng hơn thì giọt dồn sang phải theo", () => {
  // Ở 1024px bờ chiếm 65%, ở 1440px chỉ 56%. Giọt phải đi theo bờ chứ không đứng yên.
  const hep = viTriGiot(0, 0.56, 6);
  const rong = viTriGiot(0, 0.72, 6);
  assert.ok(rong.x > hep.x, "bờ rộng hơn mà giọt không dịch sang phải");
});

test("hai giọt liên tiếp không chồng lên nhau", () => {
  // Đó là toàn bộ lý do dùng góc vàng thay vì chia đều vòng tròn.
  const a = viTriGiot(4, 0.56, 12);
  const b = viTriGiot(5, 0.56, 12);
  const cach = Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(cach > 0.05, `hai giọt chỉ cách nhau ${cach.toFixed(4)}`);
});

test("kệ một bài thì giọt duy nhất không văng ra rìa", () => {
  // `Math.max(tong, 4)` giữ điều này: không chia cho 1 rồi đẩy giọt ra sát bờ chậu.
  const { x } = viTriGiot(0, 0.56, 1);
  assert.ok(x > 0.62 && x < 0.95, `giọt đơn ở x=${x.toFixed(3)}`);
});

test("góc vàng đúng giá trị", () => {
  assert.ok(Math.abs(GOC_VANG - Math.PI * (3 - Math.sqrt(5))) < 1e-9);
});

test("giotRoi: mọi lần chạm chung MỘT tâm — loang tròn, không bắn về một phía", () => {
  // Bất biến phân biệt "giọt rơi" với "mực phun": lệch tâm dù một lần là vân bị kéo về
  // một phía.
  for (const c of giotRoi(0.3, 0.7, 1, 5)) {
    assert.deepEqual({ x: c.x, y: c.y }, { x: 0.3, y: 0.7 });
  }
});

test("giotRoi: mực và nước trong XEN KẼ, bắt đầu bằng mực, kết thúc bằng nước", () => {
  // Kết thúc bằng nước trong là thứ biến lòng giọt thành vòng; kết thúc bằng mực thì tâm là
  // một chấm đặc và vân đồng tâm biến mất.
  const cu = giotRoi(0.5, 0.5, 0.6, 4);
  assert.equal(cu.length, 8);
  cu.forEach((c, i) => {
    if (i % 2 === 0) assert.ok(c.amount > 0, `lần chạm ${i} phải là mực`);
    else assert.equal(c.amount, 0, `lần chạm ${i} phải là nước trong`);
    assert.ok(c.r > 0, "bán kính phải dương");
  });
});

test("giotRoi: lượng mực tỉ lệ với amount — giọt 'đọc xong' và giọt 'mời gọi' khác nhau", () => {
  const nhat = giotRoi(0.5, 0.5, 0.3).reduce((s, c) => s + c.amount, 0);
  const dam = giotRoi(0.5, 0.5, 0.9).reduce((s, c) => s + c.amount, 0);
  assert.ok(Math.abs(dam / nhat - 3) < 1e-9);
});

test("chonGiot: giọt lệch đi vẫn luôn nằm TRONG chậu", () => {
  // Giọt sát bốn mép — chỗ duy nhất phép lệch có thể đẩy nó ra ngoài canvas, và mực rơi
  // ngoài khung là loại lỗi im lặng: trên màn hình chỉ thấy chậu vắng đi một giọt.
  const mep = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.02, y: 0.98 },
    { x: 0.99, y: 0.01 },
  ];
  let seed = 0;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 500; i++) {
    const g = chonGiot(mep, rand, 0.2);
    assert.ok(g, "danh sách không rỗng thì phải trả về một giọt");
    assert.ok(g.x >= 0 && g.x <= 1, `x = ${g.x}`);
    assert.ok(g.y >= 0 && g.y <= 1, `y = ${g.y}`);
  }
});

test("chonGiot: danh sách rỗng trả null, không phải NaN", () => {
  // Kệ chưa đọc quyển nào thì không có giọt nào để thả lại — mặt nước còn trong, đúng
  // DESIGN.md § Ink. Trả về một toạ độ NaN sẽ thả mực vào giữa hư không và bộ giải nổ.
  assert.equal(chonGiot([]), null);
});

test("chonGiot: mọi giọt trong danh sách đều tới lượt", () => {
  const ds = [
    { x: 0.2, y: 0.2 },
    { x: 0.5, y: 0.5 },
    { x: 0.8, y: 0.8 },
  ];
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const gan = new Set<number>();
  for (let i = 0; i < 400; i++) {
    const g = chonGiot(ds, rand, 0);
    gan.add(ds.findIndex((d) => d.x === g!.x && d.y === g!.y));
  }
  assert.equal(gan.size, 3, "chọn ngẫu nhiên phải phủ hết danh sách, không kẹt ở một giọt");
});

test("nhipNgauNhien: luôn dương và dao động quanh giá trị trung bình", () => {
  let seed = 3;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < 500; i++) {
    const ms = nhipNgauNhien(3, rand);
    assert.ok(ms > 0, "khoảng chờ âm hoặc 0 sẽ thành vòng lặp thả mực liên tục");
    min = Math.min(min, ms);
    max = Math.max(max, ms);
  }
  assert.ok(min >= 3 * 1000 * 0.55, `min ${min}`);
  assert.ok(max <= 3 * 1000 * 1.45, `max ${max}`);
  assert.ok(max - min > 1000, "phải thật sự dao động, không kẹt ở một giá trị");
});
