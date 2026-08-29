/**
 * Biến `designmd lint` thành một CỔNG thật.
 *
 * CLI của designmd đặt `process.exitCode = summary.errors > 0 ? 1 : 0`, mà rule
 * `contrast-ratio` có severity `"warning"` — nên một cặp màu dưới AA in ra cảnh báo rồi
 * **thoát mã 0**, và `npm run check` vẫn xanh. CLAUDE.md thì khẳng định ngược lại
 * ("`design:lint` chặn lỗi tương phản"). Đã đo: phá DESIGN.md cho viền còn 2.06:1 →
 * cảnh báo hiện ra, exit code vẫn 0.
 *
 * Đó chính là lý do lỗi tương phản 1.00:1 của ô nhập quản trị đi lọt tới tận lúc có
 * người mở trình duyệt ra đo. Script này đọc JSON từ stdin, in nguyên văn ra lại (để
 * output của `npm run check` không đổi), rồi thoát 1 khi có BẤT KỲ error hoặc warning nào.
 *
 * Baseline lúc gắn cổng: 0 error, 0 warning — nên nó không làm đỏ gì đang xanh.
 */
let raw = "";
for await (const chunk of process.stdin) raw += chunk;
process.stdout.write(raw);

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error("design:lint không trả về JSON đọc được — coi như hỏng, đừng nuốt.");
  process.exit(1);
}

const { errors = 0, warnings = 0 } = report.summary ?? {};
if (errors > 0 || warnings > 0) {
  console.error(`\ndesign:lint — ${errors} lỗi, ${warnings} cảnh báo. Cảnh báo cũng chặn: rule`);
  console.error("`contrast-ratio` là severity warning, mà tương phản dưới AA là lỗi thật.");
  process.exit(1);
}
