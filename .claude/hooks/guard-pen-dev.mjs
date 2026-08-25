#!/usr/bin/env node
/**
 * PreToolUse(Bash) — chặn mọi lệnh shell chạm tới `pen.dev/`.
 *
 * Deny rule `Read(pen.dev/**)` trong settings.json chỉ phủ các tool file của Claude Code
 * và các lệnh đọc file mà nó nhận ra (`cat`, `head`, `sed`…). Nó KHÔNG phủ subprocess tùy
 * ý: `git show HEAD:pen.dev/design.pen` vẫn trả về đủ 57361 byte — đã thử.
 *
 * Chặn ở đây thay vì liệt kê từng lệnh vì mọi lệnh shell đều đi qua đúng một cửa này.
 * Đây là hàng rào chống lỡ tay, không phải ranh giới bảo mật: ai muốn lách vẫn lách được
 * bằng cách ghép chuỗi. Mục tiêu là để một agent đang vội không vô tình kéo 57KB JSON cũ
 * vào context thay vì gọi Pencil MCP.
 */
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    // Payload hỏng thì không phải việc của hook này — để tool chạy tiếp.
  }

  if (/pen\.dev/i.test(command)) {
    console.error(
      "Bị chặn: lệnh này chạm tới pen.dev/. File .pen chỉ mở bằng Pencil MCP — " +
        "gọi mcp__pencil__get_app_state với đủ 3 flag, rồi mcp__pencil__execute. " +
        "Đọc thô file này chỉ ra một khối JSON lớn đã cũ, không phải trạng thái thật.",
    );
    process.exit(2);
  }
  process.exit(0);
});
