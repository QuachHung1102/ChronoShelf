/**
 * Chậu mực — bộ giải chất lỏng chạy trên GPU.
 *
 * VÌ SAO LÀ MÔ PHỎNG THẬT chứ không phải một tấm ảnh gradient. Thế giới thị giác của sản
 * phẩm (DESIGN.md § Ink) là suminagashi: mực nho thả trên mặt nước, vân chảy theo thủy động
 * lực. Vẽ giả bằng gradient thì mọi thứ còn lại chỉ là "màu xanh đậm" — vân sợi mảnh, xoáy
 * hoa cúc và mưa lông vũ đều là HỆ QUẢ của phương trình, không phải hình vẽ chép lại được.
 *
 * Đây là Stable Fluids (Jos Stam, 1999) trên texture: advect → curl → vorticity confinement
 * → divergence → giải áp suất bằng Jacobi → trừ gradient. Cộng một trường thuốc nhuộm được
 * advect theo vận tốc. Không thư viện nào được thêm vào dự án cho việc này.
 *
 * KHÔNG có `@/` import và không chạm React: file này thuần WebGL, nên `node --test` chạy
 * thẳng được phần hình học của nó (xem `fluid.test.ts`).
 */

/** Một sắc tố: ba kênh 0..1 cộng độ đậm. Mỗi kệ sách là một sắc tố (DESIGN.md § Ink). */
export interface Pigment {
  r: number;
  g: number;
  b: number;
}

export interface BasinOptions {
  /** Cạnh lưới VẬN TỐC. 128 là đủ: dòng chảy mượt sẵn, tăng nữa chỉ tốn GPU. */
  simSize?: number;
  /**
   * Cạnh lưới THUỐC NHUỘM — và đây là con số quyết định hướng thị giác này sống hay chết.
   *
   * Đo trên màn thật: với lưới mực 256 phóng lên canvas ~1200px, nội suy tuyến tính xoá sạch
   * vân sợi và mực đọc ra là KHÓI XÁM chứ không phải suminagashi. Vân sợi mảnh là toàn bộ lý
   * do thế giới này được chọn, nên mực phải có lưới riêng, dày hơn vận tốc nhiều lần.
   */
  dyeSize?: number;
  /** Số vòng lặp Jacobi cho bước áp suất. Dưới 16 thì mực "chảy" thành khối chứ không thành vân. */
  pressureIterations?: number;
  /** Mực tan dần. 1 là không tan; càng nhỏ càng nhanh về nước trong. */
  dyeDissipation?: number;
  /** Vận tốc tắt dần — độ nhớt biểu kiến của nước. */
  velocityDissipation?: number;
  /** Độ xoáy được bơm lại. Đây là thứ tạo ra vân hoa cúc; bằng 0 thì mực loang tròn và chán. */
  curlStrength?: number;
}

const DEFAULTS: Required<BasinOptions> = {
  simSize: 128,
  dyeSize: 1024,
  pressureIterations: 20,
  dyeDissipation: 0.9996,
  velocityDissipation: 0.985,
  // TẮT có chủ ý. Ở 26 (bản trước) xoáy băm nát mọi vòng mực thành khói xám; ở 5 nó vẫn
  // khuếch đại xoáy cỡ một ô lưới thành viền tưa lăn tăn sau ~20 giây. Màng mực của
  // suminagashi chảy TẦNG: vân là những đường song song bị uốn mềm, không phải nhiễu loạn.
  curlStrength: 0,
};

/**
 * Hình học của một cú thả mực.
 *
 * Tách khỏi phần WebGL vì đây là chỗ DUY NHẤT trong engine có thể sai một cách âm thầm:
 * toạ độ chuột tính sai thì mực vẫn loang đẹp, chỉ là loang sai chỗ, và không có gì báo.
 * Trả về toạ độ 0..1 với gốc ở GÓC DƯỚI TRÁI — quy ước của texture WebGL, ngược trục Y so
 * với DOM.
 */
export function toBasinCoords(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const x = (clientX - rect.left) / rect.width;
  const y = 1 - (clientY - rect.top) / rect.height;
  return { x: clamp01(x), y: clamp01(y) };
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Một tam giác phủ kín màn hình — rẻ hơn hai tam giác và không có đường nối ở giữa.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const ADVECT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uDissipation;
out vec4 outColor;
void main() {
  // Truy ngược theo dòng chảy: hạt bây giờ ở đây thì một bước trước nó ở đâu.
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  outColor = uDissipation * texture(uSource, coord);
}`;

// Bước sửa của MacCormack: kết quả xuôi cộng nửa sai số khứ hồi, rồi KẸP vào khoảng của bốn
// texel quanh điểm truy ngược. Thiếu cái kẹp thì sai số đổi dấu thành vòng sáng-tối dao động
// quanh mỗi mép vân và bộ giải nổ dần.
const MACCORMACK = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uPhi;
uniform sampler2D uXuoi;
uniform sampler2D uNguoc;
uniform vec2 uTexel;
uniform vec2 uDyeTexel;
uniform float uDt;
uniform float uDissipation;
out vec4 outColor;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;
  vec2 st = coord / uDyeTexel - 0.5;
  vec2 i = floor(st);
  vec2 c0 = (i + 0.5) * uDyeTexel;
  float a = texture(uPhi, c0).x;
  float b = texture(uPhi, c0 + vec2(uDyeTexel.x, 0.0)).x;
  float c = texture(uPhi, c0 + vec2(0.0, uDyeTexel.y)).x;
  float d = texture(uPhi, c0 + uDyeTexel).x;
  float lo = min(min(a, b), min(c, d));
  float hi = max(max(a, b), max(c, d));
  float v = texture(uXuoi, vUv).x + 0.5 * (texture(uPhi, vUv).x - texture(uNguoc, vUv).x);
  outColor = vec4(uDissipation * clamp(v, lo, hi), 0.0, 0.0, 1.0);
}`;

const DIVERGENCE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  outColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

const CURL = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).y;
  float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).y;
  float b = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).x;
  outColor = vec4(0.5 * (r - l - (t - b)), 0.0, 0.0, 1.0);
}`;

// Vorticity confinement: bơm lại phần xoáy mà lưới rời rạc đã ăn mất. Đây là bước làm nên
// vân hoa cúc của suminagashi — bỏ nó ra thì giọt mực loang thành một vòng tròn nhoè.
const VORTICITY = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uCurlStrength;
uniform float uDt;
out vec4 outColor;
void main() {
  float l = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float c = texture(uCurl, vUv).x;

  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * c;
  force.y *= -1.0;

  vec2 vel = texture(uVelocity, vUv).xy + force * uDt;
  outColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`;

const PRESSURE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float d = texture(uDivergence, vUv).x;
  outColor = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(r - l, t - b);
  outColor = vec4(vel, 0.0, 1.0);
}`;

const SPLAT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uValue;
uniform vec2 uPoint;
uniform float uRadius;
out vec4 outColor;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uValue;
  outColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0);
}`;

// Bước hiển thị. Mực KHÔNG được vẽ bằng cách trộn tuyến tính về đen: mực nho thật đậm dần
// theo Beer–Lambert, và chính đường cong đó cho ra rìa vân sắc mà mắt đọc ra là "sợi".
//
// Hai chi tiết vật liệu, cả hai đều rẻ:
//   - Mép vân đậm hơn lòng vân: mực nho dồn về rìa màng khi khô. Đo bằng độ dốc của trường
//     mực — chỗ mực đổi nhanh là mép.
//   - Thớ giấy: nhiễu băm theo pixel, biên độ ~1%. Không có nó mặt nước đọc ra là màn hình
//     phẳng chứ không phải tờ giấy hút mực.
const DISPLAY = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDye;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec2 uDyeTexel;
out vec4 outColor;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
void main() {
  float d = max(texture(uDye, vUv).x, 0.0);
  float gx = texture(uDye, vUv + vec2(uDyeTexel.x, 0.0)).x - texture(uDye, vUv - vec2(uDyeTexel.x, 0.0)).x;
  float gy = texture(uDye, vUv + vec2(0.0, uDyeTexel.y)).x - texture(uDye, vUv - vec2(0.0, uDyeTexel.y)).x;
  float mep = clamp(length(vec2(gx, gy)) * 1.6, 0.0, 0.35);
  // Ngưỡng 0.03: mực loãng hơn mức đó coi như đã tan vào nước. Không cắt thì phần đuôi
  // khuếch tán còn sót tô cả chậu một lớp sương xám.
  float a = 1.0 - exp(-max(d + mep * d - 0.03, 0.0) * 3.2);
  vec3 col = mix(uPaper, uInk, a);
  col *= 1.0 - 0.012 * hash(gl_FragCoord.xy);
  outColor = vec4(col, 1.0);
}`;

// Một giọt chạm mặt nước — phép biến đổi giọt mực của "Mathematical Marbling" (Jaffer & Lu,
// 2012). Điểm p ngoài giọt bán kính r tâm c bị đẩy tới c + (p−c)·√(1 + r²/|p−c|²): mọi vân cũ
// bị nén ra ngoài và DIỆN TÍCH ĐƯỢC BẢO TOÀN, đúng như màng mực trên mặt nước thật. Ở đây
// chạy NGƯỢC (mỗi pixel đích hỏi nguồn của nó), nên là một lượt vẽ toàn texture mực.
//
// VÌ SAO KHÔNG dùng splat vận tốc hướng ra ngoài như bản trước: bộ giải ép dòng chảy không
// nén được, nên mọi nguồn phát tán bị bước áp suất xoá sạch — giọt chỉ còn là một vết Gauss
// bị xoáy băm thành khói. Màng mực trên mặt nước thật thì NÉN ĐƯỢC.
//
// Thả xen kẽ một giọt mực rồi một giọt nước trong ở cùng tâm là ra vân vòng đồng tâm — đúng
// thao tác của nghệ nhân (bút mực, rồi bút chất hoạt động bề mặt).
const DROP = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uDye;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uAmount;
uniform float uAspect;
uniform float uPx;
out vec4 outColor;
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 c = vec2(uPoint.x * uAspect, uPoint.y);
  vec2 d = p - c;
  float l2 = max(dot(d, d), 1e-12);
  float r2 = uRadius * uRadius;
  vec2 src = c + d * sqrt(max(1.0 - r2 / l2, 0.0));
  float ngoai = texture(uDye, vec2(src.x / uAspect, src.y)).x;
  // Mép giọt khử răng cưa trên ~1.5 texel của lưới mực, nếu không vòng mực lởm chởm bậc thang.
  float t = smoothstep(uRadius - uPx, uRadius + uPx, sqrt(l2));
  outColor = vec4(mix(uAmount, ngoai, t), 0.0, 0.0, 1.0);
}`;

interface Fbo {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

interface DoubleFbo {
  read: Fbo;
  write: Fbo;
  swap(): void;
}

export interface InkBasin {
  /**
   * Thả một giọt mực kèm một cú đẩy. Toạ độ 0..1, gốc dưới-trái.
   *
   * `amount = 0` là một cú KHUẤY: nó chỉ bơm vận tốc, không thêm mực. Đó là cách làm cả
   * chậu sống mà không nhuộm thêm gì — cần thiết vì lượng mực trên mặt nước MANG NGHĨA
   * (mỗi giọt là một bài đã đọc xong), nên không được phép tự sinh thêm.
   *
   * `radius` là bán kính bình phương của hàm Gauss, mặc định 0.0011 — cỡ một giọt rơi.
   * Cú khuấy nền cần lớn hơn nhiều (~0.02) để đẩy được cả một vùng nước thay vì chọc một
   * lỗ kim vào nó.
   */
  splat(
    x: number,
    y: number,
    dx: number,
    dy: number,
    amount?: number,
    radius?: number,
  ): void;
  /**
   * Một giọt chạm mặt nước tại (x, y): đẩy mọi vân cũ ra ngoài mà giữ diện tích, rồi lấp
   * lòng giọt bằng `amount` mực (0 = nước trong). `radius` tính theo CHIỀU CAO chậu.
   */
  drop(x: number, y: number, radius: number, amount: number): void;
  /** Chạy tới một trạng thái đã lắng rồi vẽ MỘT lần. Dùng cho `prefers-reduced-motion`. */
  settle(steps?: number): void;
  /** Bắt đầu vòng lặp khung hình. */
  start(): void;
  stop(): void;
  resize(): void;
  destroy(): void;
}

/**
 * Dựng chậu mực trên một canvas. Trả `null` khi máy không có WebGL2 hoặc không render được
 * vào texture số thực — gọi phải có đường vẽ tĩnh cho trường hợp đó, và đó là yêu cầu thật:
 * mất mực thì màn hình vẫn phải đọc được.
 */
export function createInkBasin(
  canvas: HTMLCanvasElement,
  pigment: Pigment,
  paper: Pigment,
  options: BasinOptions = {},
): InkBasin | null {
  const opt = { ...DEFAULTS, ...options };
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  // Không có phần mở rộng này thì không render được vào texture half-float, và toàn bộ bộ
  // giải phải chạy trên RGBA8 — nơi vận tốc âm không biểu diễn được. Thà trả null.
  if (!gl.getExtension("EXT_color_buffer_float")) return null;
  gl.getExtension("OES_texture_float_linear");

  const programs = {
    advect: buildProgram(gl, VERT, ADVECT),
    divergence: buildProgram(gl, VERT, DIVERGENCE),
    curl: buildProgram(gl, VERT, CURL),
    vorticity: buildProgram(gl, VERT, VORTICITY),
    pressure: buildProgram(gl, VERT, PRESSURE),
    gradient: buildProgram(gl, VERT, GRADIENT),
    splat: buildProgram(gl, VERT, SPLAT),
    drop: buildProgram(gl, VERT, DROP),
    maccormack: buildProgram(gl, VERT, MACCORMACK),
    display: buildProgram(gl, VERT, DISPLAY),
  };
  if (Object.values(programs).some((p) => p === null)) return null;

  const vao = gl.createVertexArray();

  const n = opt.simSize;
  const velocity = createDoubleFbo(gl, n, n, gl.RG16F, gl.RG, gl.HALF_FLOAT);
  const m = opt.dyeSize;
  const dye = createDoubleFbo(gl, m, m, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const dyeXuoi = createFbo(gl, m, m, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const dyeNguoc = createFbo(gl, m, m, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const divergence = createFbo(gl, n, n, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const curl = createFbo(gl, n, n, gl.R16F, gl.RED, gl.HALF_FLOAT);
  const pressure = createDoubleFbo(gl, n, n, gl.R16F, gl.RED, gl.HALF_FLOAT);

  const texel: [number, number] = [1 / n, 1 / n];
  let raf = 0;
  let last = 0;
  let disposed = false;

  function draw(target: Fbo | null) {
    if (target) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, target.fbo);
      gl!.viewport(0, 0, target.width, target.height);
    } else {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, canvas.width, canvas.height);
    }
    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function bind(
    program: WebGLProgram,
    name: string,
    tex: WebGLTexture,
    unit: number,
  ) {
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(gl!.getUniformLocation(program, name), unit);
  }

  function step(dt: number) {
    const g = gl!;

    // 1. Xoáy: đo curl rồi bơm lại phần lưới đã ăn mất. Bỏ qua hẳn khi tắt.
    if (opt.curlStrength > 0) {
      g.useProgram(programs.curl!);
      g.uniform2f(
        g.getUniformLocation(programs.curl!, "uTexel"),
        texel[0],
        texel[1],
      );
      bind(programs.curl!, "uVelocity", velocity.read.texture, 0);
      draw(curl);

      g.useProgram(programs.vorticity!);
      g.uniform2f(
        g.getUniformLocation(programs.vorticity!, "uTexel"),
        texel[0],
        texel[1],
      );
      g.uniform1f(
        g.getUniformLocation(programs.vorticity!, "uCurlStrength"),
        opt.curlStrength,
      );
      g.uniform1f(g.getUniformLocation(programs.vorticity!, "uDt"), dt);
      bind(programs.vorticity!, "uVelocity", velocity.read.texture, 0);
      bind(programs.vorticity!, "uCurl", curl.texture, 1);
      draw(velocity.write);
      velocity.swap();
    }

    // 2. Ép dòng chảy không nén được: divergence → áp suất → trừ gradient.
    g.useProgram(programs.divergence!);
    g.uniform2f(
      g.getUniformLocation(programs.divergence!, "uTexel"),
      texel[0],
      texel[1],
    );
    bind(programs.divergence!, "uVelocity", velocity.read.texture, 0);
    draw(divergence);

    g.useProgram(programs.pressure!);
    g.uniform2f(
      g.getUniformLocation(programs.pressure!, "uTexel"),
      texel[0],
      texel[1],
    );
    for (let i = 0; i < opt.pressureIterations; i++) {
      bind(programs.pressure!, "uPressure", pressure.read.texture, 0);
      bind(programs.pressure!, "uDivergence", divergence.texture, 1);
      draw(pressure.write);
      pressure.swap();
    }

    g.useProgram(programs.gradient!);
    g.uniform2f(
      g.getUniformLocation(programs.gradient!, "uTexel"),
      texel[0],
      texel[1],
    );
    bind(programs.gradient!, "uPressure", pressure.read.texture, 0);
    bind(programs.gradient!, "uVelocity", velocity.read.texture, 1);
    draw(velocity.write);
    velocity.swap();

    // 3. Cuốn vận tốc theo chính nó, rồi cuốn mực theo vận tốc.
    g.useProgram(programs.advect!);
    g.uniform2f(
      g.getUniformLocation(programs.advect!, "uTexel"),
      texel[0],
      texel[1],
    );
    g.uniform1f(g.getUniformLocation(programs.advect!, "uDt"), dt);
    g.uniform1f(
      g.getUniformLocation(programs.advect!, "uDissipation"),
      opt.velocityDissipation,
    );
    bind(programs.advect!, "uVelocity", velocity.read.texture, 0);
    bind(programs.advect!, "uSource", velocity.read.texture, 1);
    draw(velocity.write);
    velocity.swap();

    // uTexel giữ nguyên 1/n (lưới VẬN TỐC) cho cả hai lần advect, kể cả khi mực có lưới
    // riêng dày hơn. Vận tốc lưu theo đơn vị ô-lưới-vận-tốc trên giây, nên quãng truy ngược
    // phải chia cho n; chia cho 1024 thì mực dịch đi 1/8 quãng đúng và gần như đứng yên trong
    // khi dòng chảy vẫn chạy — đã suýt ship đúng lỗi đó.
    //
    // Mực đi theo MacCormack chứ không semi-Lagrange một lượt: lấy mẫu song tuyến tính mỗi
    // khung hình là làm mờ một chút, cộng dồn 60 lần một giây thì sau vài giây mọi vân mảnh
    // tan thành một lớp sương xám phủ cả chậu — đã thấy trên màn thật. Lượt xuôi rồi lượt
    // ngược đo được chính sai số đó và trừ nó đi.
    g.uniform1f(g.getUniformLocation(programs.advect!, "uDissipation"), 1);
    bind(programs.advect!, "uVelocity", velocity.read.texture, 0);
    bind(programs.advect!, "uSource", dye.read.texture, 1);
    draw(dyeXuoi);

    g.uniform1f(g.getUniformLocation(programs.advect!, "uDt"), -dt);
    bind(programs.advect!, "uSource", dyeXuoi.texture, 1);
    draw(dyeNguoc);

    const mc = programs.maccormack!;
    g.useProgram(mc);
    g.uniform2f(g.getUniformLocation(mc, "uTexel"), texel[0], texel[1]);
    g.uniform2f(g.getUniformLocation(mc, "uDyeTexel"), 1 / m, 1 / m);
    g.uniform1f(g.getUniformLocation(mc, "uDt"), dt);
    g.uniform1f(g.getUniformLocation(mc, "uDissipation"), opt.dyeDissipation);
    bind(mc, "uVelocity", velocity.read.texture, 0);
    bind(mc, "uPhi", dye.read.texture, 1);
    bind(mc, "uXuoi", dyeXuoi.texture, 2);
    bind(mc, "uNguoc", dyeNguoc.texture, 3);
    draw(dye.write);
    dye.swap();
  }

  function render() {
    const g = gl!;
    g.useProgram(programs.display!);
    g.uniform3f(
      g.getUniformLocation(programs.display!, "uPaper"),
      paper.r,
      paper.g,
      paper.b,
    );
    g.uniform3f(
      g.getUniformLocation(programs.display!, "uInk"),
      pigment.r,
      pigment.g,
      pigment.b,
    );
    g.uniform2f(
      g.getUniformLocation(programs.display!, "uDyeTexel"),
      1 / m,
      1 / m,
    );
    bind(programs.display!, "uDye", dye.read.texture, 0);
    draw(null);
  }

  const basin: InkBasin = {
    splat(x, y, dx, dy, amount = 1, radius = 0.0011) {
      const g = gl!;
      g.useProgram(programs.splat!);
      g.uniform1f(
        g.getUniformLocation(programs.splat!, "uAspect"),
        canvas.width / canvas.height,
      );
      g.uniform2f(g.getUniformLocation(programs.splat!, "uPoint"), x, y);
      g.uniform1f(g.getUniformLocation(programs.splat!, "uRadius"), radius);

      bind(programs.splat!, "uTarget", velocity.read.texture, 0);
      g.uniform3f(g.getUniformLocation(programs.splat!, "uValue"), dx, dy, 0);
      draw(velocity.write);
      velocity.swap();

      // Bỏ hẳn lượt vẽ vào texture mực khi đây là cú khuấy: nó là một full-screen pass và
      // dòng chảy nền gọi hàm này nhiều lần mỗi giây trên lưới mực 1024².
      if (amount === 0) return;

      bind(programs.splat!, "uTarget", dye.read.texture, 0);
      g.uniform3f(
        g.getUniformLocation(programs.splat!, "uValue"),
        amount,
        0,
        0,
      );
      draw(dye.write);
      dye.swap();
    },

    drop(x, y, radius, amount) {
      const g = gl!;
      const p = programs.drop!;
      g.useProgram(p);
      g.uniform2f(g.getUniformLocation(p, "uPoint"), x, y);
      g.uniform1f(g.getUniformLocation(p, "uRadius"), radius);
      g.uniform1f(g.getUniformLocation(p, "uAmount"), amount);
      g.uniform1f(
        g.getUniformLocation(p, "uAspect"),
        canvas.width / canvas.height,
      );
      g.uniform1f(g.getUniformLocation(p, "uPx"), 1.5 / m);
      bind(p, "uDye", dye.read.texture, 0);
      draw(dye.write);
      dye.swap();
    },

    settle(steps = 90) {
      for (let i = 0; i < steps; i++) step(0.016);
      render();
    },

    start() {
      if (raf || disposed) return;
      last = performance.now();
      const loop = (now: number) => {
        // Kẹp dt: tab bị ẩn rồi quay lại có thể trả về một bước nhảy hàng giây, và bộ giải
        // sẽ nổ tung thành nhiễu trắng. Kẹp là bắt buộc, không phải phòng xa.
        const dt = Math.min((now - last) / 1000, 0.033);
        last = now;
        step(dt);
        render();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    },

    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        render();
      }
    },

    destroy() {
      disposed = true;
      basin.stop();
      const g = gl!;
      for (const p of Object.values(programs)) if (p) g.deleteProgram(p);
      for (const f of [divergence, curl, dyeXuoi, dyeNguoc]) {
        g.deleteTexture(f.texture);
        g.deleteFramebuffer(f.fbo);
      }
      for (const d of [velocity, dye, pressure]) {
        for (const f of [d.read, d.write]) {
          g.deleteTexture(f.texture);
          g.deleteFramebuffer(f.fbo);
        }
      }
      g.deleteVertexArray(vao);
    },
  };

  basin.resize();
  return basin;
}

function buildProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createFbo(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number,
  format: number,
  type: number,
): Fbo {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // CLAMP_TO_EDGE là bờ chậu. REPEAT sẽ cho mực chảy ra mép này rồi hiện lại ở mép kia —
  // một cái chậu không làm thế.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    format,
    type,
    null,
  );

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return { texture: texture!, fbo: fbo!, width, height };
}

function createDoubleFbo(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number,
  format: number,
  type: number,
): DoubleFbo {
  const a = createFbo(gl, width, height, internalFormat, format, type);
  const b = createFbo(gl, width, height, internalFormat, format, type);
  return {
    read: a,
    write: b,
    swap() {
      const t = this.read;
      this.read = this.write;
      this.write = t;
    },
  };
}
