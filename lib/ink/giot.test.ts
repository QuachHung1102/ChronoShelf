import assert from "node:assert/strict";
import test from "node:test";
import { CACH_TOI_THIEU, GOC_VANG, SO_TIA, chonGiot, giotRoi, nhipNgauNhien, viTriGiot } from "./giot.ts";

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

test("giotRoi: một giọt mực ở tâm, phần còn lại chỉ là vận tốc", () => {
  const cu = giotRoi(0.5, 0.5, 2);
  assert.equal(cu.length, SO_TIA + 1);
  assert.equal(cu.filter((c) => c.amount > 0).length, 1, "chỉ ĐÚNG một cú thả mực");
  assert.deepEqual(
    { x: cu[0].x, y: cu[0].y, dx: cu[0].dx, dy: cu[0].dy },
    { x: 0.5, y: 0.5, dx: 0, dy: 0 },
    "mực đổ đúng tâm và KHÔNG kèm vector đẩy nào — đó là chỗ bản cũ làm mực bay lệch",
  );
});

test("giotRoi: tổng động lượng bằng 0 — loang tròn, không bắn về một phía", () => {
  const cu = giotRoi(0.3, 0.7, 1, 200);
  const tong = cu.reduce((s, c) => ({ dx: s.dx + c.dx, dy: s.dy + c.dy }), { dx: 0, dy: 0 });
  // Đây là bất biến phân biệt "giọt rơi" với "mực phun": các tia phải triệt tiêu nhau theo
  // cặp đối xứng, nên cả cụm không có hướng ưu tiên nào.
  assert.ok(Math.abs(tong.dx) < 1e-9, `dx tổng ${tong.dx}`);
  assert.ok(Math.abs(tong.dy) < 1e-9, `dy tổng ${tong.dy}`);
});

test("giotRoi: mọi tia đẩy RA NGOÀI khỏi tâm", () => {
  const cu = giotRoi(0.5, 0.5, 1).slice(1);
  for (const c of cu) {
    const rx = c.x - 0.5;
    const ry = c.y - 0.5;
    // Tích vô hướng giữa vector vị-trí-so-với-tâm và vector đẩy phải dương: đẩy vào trong
    // thì giọt tự bóp lại thành một chấm thay vì loang.
    assert.ok(rx * c.dx + ry * c.dy > 0, "tia phải hướng ra ngoài");
  }
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

test("chonGiot: không rơi lại sát chỗ giọt trước khi còn chỗ khác để rơi", () => {
  const ds = [
    { x: 0.6, y: 0.3 },
    { x: 0.8, y: 0.7 },
    { x: 0.7, y: 0.5 },
  ];
  let seed = 11;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let truoc = chonGiot(ds, rand);
  let sat = 0;
  for (let i = 0; i < 300; i++) {
    const g = chonGiot(ds, rand, 0.07, truoc)!;
    if (Math.hypot(g.x - truoc!.x, g.y - truoc!.y) < CACH_TOI_THIEU) sat++;
    truoc = g;
  }
  // Sáu lần bốc lại không bảo đảm tuyệt đối, nhưng phải hiếm: dưới 2%.
  assert.ok(sat < 6, `${sat}/300 giọt rơi sát giọt trước`);
});

test("chonGiot: danh sách một giọt vẫn rơi được, không treo vòng lặp", () => {
  assert.ok(chonGiot([{ x: 0.7, y: 0.5 }], Math.random, 0.07, { x: 0.7, y: 0.5 }));
});
