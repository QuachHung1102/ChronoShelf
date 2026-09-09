/**
 * Khung xương riêng cho màn kệ sách.
 *
 * Lý do tách khỏi `app/loading.tsx` đã ĐỔI cùng thế giới thị giác. Trước đây là vì màn kệ
 * nền tối còn mọi trang khác nền sáng; nay cả hai cùng nền `paper`, và lý do tách là HÌNH
 * DẠNG: màn kệ khoá chiều cao vào khung nhìn và không cuộn, còn các trang khác cuộn bình
 * thường. Dùng chung khung xương kia thì lúc nội dung thật tới, cả trang đổi từ "cuộn được"
 * sang "không cuộn", thanh cuộn biến mất và mọi thứ nhảy ngang một nhịp.
 *
 * **KHÔNG vẽ rail.** Rail sống ở `app/layout.tsx`, tức nằm NGOÀI ranh giới Suspense này và
 * không hề bị thay khi chuyển trang. Bản trước vẽ thêm một rail xương cạnh rail thật.
 *
 * Vẽ đúng BA hàng bài học giả, không nhiều hơn: số bài thật do dữ liệu quyết định, nên một
 * danh sách giả dài bằng danh sách thật là ăn may chứ không phải thiết kế.
 *
 * Vùng nước bên phải để TRỐNG, và đó không phải chỗ làm biếng: mặt nước chưa thả giọt nào
 * đúng là nước trong. Khung xương ở đây không hứa một vân mực nào mà nội dung thật có thể
 * không có.
 */
export default function DangTaiKeSach() {
  return (
    <main id="noi-dung" className="flex h-screen min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Bờ: cùng công thức bề rộng với `.bo` trong `ShelfBasin.module.scss`. */}
        <div className="flex min-h-0 w-[max(516px,56%)] flex-col justify-center bg-paper px-page-margin py-2xl">
          <p role="status" className="font-ui text-label-caps uppercase text-ink-dilute">
            Đang mở kệ sách…
          </p>
          {/* `mist` là mức thấp nhất còn đọc ra hình trên nền `paper`: `surface` chỉ 1.16:1,
              tức một khung xương vô hình — đúng thứ khung xương sinh ra để tránh. */}
          <div aria-hidden className="mt-md h-2xl w-3/4 rounded-md bg-mist" />
          <div aria-hidden className="mt-md h-md w-full max-w-measure rounded-md bg-mist" />

          <div aria-hidden className="mt-xl border-t border-mist pt-xl">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-md border-b border-mist py-md">
                <div className="h-md w-8 rounded-sm bg-mist" />
                <div className="flex-1">
                  <div className="h-lg w-1/2 rounded-md bg-mist" />
                  <div className="mt-xs h-md w-1/3 rounded-md bg-mist" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
