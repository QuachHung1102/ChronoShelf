/**
 * Tiếng giấy sột soạt khi lật trang (content.md §4.2 mục 3).
 *
 * **Sinh bằng Web Audio, không phải một file .mp3.** Ba lý do, theo thứ tự quan trọng:
 *
 *  1. Một file âm thanh là một tác phẩm có giấy phép, y như ảnh — mà cả dự án này đã dựng
 *     bốn ràng buộc CHECK và một component `GhiCongAnh` chỉ để không bao giờ hiển thị một
 *     tấm ảnh mà thiếu dòng ghi công. Thêm một file tiếng tải từ đâu đó là mở lại đúng cái
 *     lỗ ấy ở một chỗ không có ràng buộc nào canh.
 *  2. 0 byte tải về, 0 request. Tiếng lật trang phải kêu NGAY lúc bấm; một file phải chờ
 *     tải xong thì cú lật đầu tiên luôn im lặng.
 *  3. Mỗi cú lật kêu khác nhau một chút (xem `detune`), nên lật mười trang không nghe ra
 *     mười lần cùng một đoạn ghi âm.
 *
 * Cách dựng: một khối nhiễu trắng ngắn cho qua bộ lọc bandpass — đó chính là phổ của tiếng
 * giấy cọ nhau — rồi bọc trong một bao hình gõ nhanh, tắt chậm.
 */

/** Khóa localStorage. Có tiền tố để không đụng ai khác trên cùng origin. */
const KHOA = "chronoshelf:tat-tieng-lat";

/** Dài đúng một cú lật. Dài hơn thì nghe ra tiếng xé giấy chứ không phải lật giấy. */
const DAI_GIAY = 0.2;

let ctx: AudioContext | null = null;
let nhieu: AudioBuffer | null = null;

/**
 * Đọc lựa chọn đã lưu. Mọi lối vào `localStorage` đều bọc try/catch: ở chế độ riêng tư,
 * hoặc khi trình duyệt bị đặt chặn dữ liệu trang, chính việc ĐỌC thuộc tính đã ném lỗi —
 * và một quyển sách không mở ra được vì cái nút tắt tiếng thì tệ hơn nhiều so với việc
 * quên mất lựa chọn của người dùng.
 */
export function dangTatTieng(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KHOA) === "1";
  } catch {
    return false;
  }
}

export function ghiTatTieng(tat: boolean): void {
  try {
    window.localStorage.setItem(KHOA, tat ? "1" : "0");
  } catch {
    // Không lưu được thì lựa chọn chỉ sống hết phiên này. Không có gì để báo cho ai.
  }
}

/**
 * Phát một tiếng lật. Gọi được nhiều lần liên tiếp — mỗi lần dựng một chuỗi node riêng,
 * và chúng tự được thu dọn khi node nguồn phát xong.
 *
 * Im lặng khi trình duyệt không có Web Audio, thay vì ném lỗi làm hỏng cú lật trang.
 */
export function phatTiengLat(): void {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return;

  try {
    // Dựng LƯỜI, ở lần lật đầu tiên. Chính sách autoplay của trình duyệt chỉ cho một
    // AudioContext chạy khi nó sinh ra (hoặc được resume) từ trong một thao tác thật của
    // người dùng — mà hàm này luôn được gọi từ handler của cú bấm hoặc phím mũi tên.
    ctx ??= new window.AudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    // Khối nhiễu dựng MỘT lần rồi dùng lại: `AudioBufferSourceNode` là thứ dùng một lần,
    // nhưng `AudioBuffer` bên trong nó thì không.
    if (!nhieu) {
      const soMau = Math.floor(ctx.sampleRate * DAI_GIAY);
      nhieu = ctx.createBuffer(1, soMau, ctx.sampleRate);
      const mau = nhieu.getChannelData(0);
      for (let i = 0; i < soMau; i += 1) mau[i] = Math.random() * 2 - 1;
    }

    const bayGio = ctx.currentTime;

    const nguon = ctx.createBufferSource();
    nguon.buffer = nhieu;
    // ±350 cent quanh cao độ gốc: đủ để hai cú lật liền nhau không giống hệt nhau, chưa
    // đủ để nghe ra là hai vật liệu khác nhau.
    nguon.detune.value = (Math.random() - 0.5) * 700;

    const loc = ctx.createBiquadFilter();
    loc.type = "bandpass";
    loc.frequency.value = 2400;
    // Q thấp ⇒ dải rộng. Q cao cho ra một tiếng "tuýt" có cao độ, nghe ra là điện tử.
    loc.Q.value = 0.7;

    const bao = ctx.createGain();
    bao.gain.setValueAtTime(0.0001, bayGio);
    // Gõ 12ms rồi tắt dần: tờ giấy bật ra nhanh, rơi xuống chậm.
    bao.gain.exponentialRampToValueAtTime(0.07, bayGio + 0.012);
    // `exponentialRamp` không bao giờ tới được 0 — phải là một số dương rất nhỏ, nếu
    // không Web Audio ném `RangeError` và cú lật trang gãy theo.
    bao.gain.exponentialRampToValueAtTime(0.0001, bayGio + DAI_GIAY);

    nguon.connect(loc).connect(bao).connect(ctx.destination);
    nguon.start(bayGio);
    nguon.stop(bayGio + DAI_GIAY);
  } catch {
    // Thiết bị không có đầu ra âm thanh, hoặc trình duyệt từ chối dựng context. Sách vẫn
    // phải lật được.
  }
}
