# Bẫy đã gặp

> Tách khỏi `CLAUDE.md` ngày 2026-09-07. Mục này là một **nhật ký chỉ-thêm**: nó chỉ dài ra,
> không bao giờ ngắn lại, và đã chiếm 23% một file mà mọi phiên đều phải đọc trọn. Bốn cái
> đắt nhất vẫn ở lại `CLAUDE.md`; phần còn lại ở đây.
>
> **Mỗi mục là một lỗi đã xảy ra thật, kèm phép đo.** Không thêm mục nào vì "nghe hợp lý" —
> chỉ thêm khi đã mất thời gian vì nó.


- **`sequelize` KHÔNG nằm trong danh sách Next tự loại khỏi bundle, `pg` thì có.** Sequelize
  nạp dialect bằng `require()` động nên bundler không lần ra. Thiếu
  `serverExternalPackages: ["sequelize"]` trong `next.config.ts` là hỏng lúc chạy, không phải
  lúc build.
- **Thư mục có tiền tố `_` trong `app/` là private folder — Next bỏ qua hoàn toàn.** Đã mất một
  lượt vì đặt route thử ở `app/api/_probe/`: `next build` vẫn xanh, route không hề tồn tại, và
  phép thử rỗng nghĩa mà trông y như đạt. Nhìn bảng Route sau khi build để biết route có thật.
- **`next start`/`next dev` không chết theo `TaskStop`.** Tiến trình cũ còn giữ cổng, nên lần
  chạy sau nhận `EADDRINUSE` và mọi request bắn vào **server cũ với bản build cũ** — triệu chứng
  là "route mới trả 404" trong khi nó có trong bảng Route. Kiểm bằng
  `Get-NetTCPConnection -LocalPort <cổng>` rồi `Stop-Process`.
- **`Model.upsert()` của Sequelize ghi LẠI MỌI CỘT.** `chronoshelf_auth` chỉ có
  `GRANT UPDATE (current_page)` trên `user_book_progress`, nên upsert sẽ đâm vào quyền cột. Dùng
  `INSERT … ON CONFLICT DO UPDATE SET current_page` viết tay (`app/api/me/progress/route.ts`).
- **`has_function_privilege('role', 'schema.fn()', …)` phải phân giải tên, việc đó đòi USAGE
  trên schema.** Hỏi về một role không có USAGE thì chính phép kiểm nổ thay vì trả lời. Tra OID
  trong `pg_proc` khi cần hỏi về `chronoshelf_app`.
- **`Promise.all` trên hai truy vấn cùng một transaction Sequelize sẽ hỏng** — chúng chồng lên
  nhau trên một connection. Trong `withRole` thì chạy tuần tự.
- **Không bao giờ gọi `sequelize.sync()`.** Nó không biết gì về RLS, policy, ràng buộc
  DEFERRABLE hay hàm SECURITY DEFINER — bảng nó tạo ra là bảng không có hàng rào nào.
- **Trong file có `"use server"`, MỌI export đều là một endpoint POST công khai** — kể cả hàm
  chỉ đọc. Vì vậy `lib/admin/shelves.ts` (đọc) tách khỏi `lib/admin/actions.ts` (ghi), và mọi
  action bắt đầu bằng `requireAdmin()`. Tài liệu Next: *"the route is reachable to anyone who
  can send the same POST. Treat every action as an untrusted entry point."*
- **Không truyền được function làm `children` từ Server Component xuống Client Component.**
  React báo `Functions are not valid as a child of Client Components`. Trạng thái `pending` của
  form lấy bằng `useFormStatus` trong một nút con, không phải bằng render prop.
- **Vào dev server bằng `127.0.0.1` thay vì `localhost` làm React không hydrate xong.** Next 16
  chặn tài nguyên dev cross-origin, WebSocket HMR hỏng, và form submit kiểu native — triệu chứng
  nhìn y như một bug của app (URL mất sạch query param). Dùng `localhost`, hoặc thêm
  `allowedDevOrigins` vào `next.config.ts`.
- **`designmd export` ĐÁNH RƠI `lineHeight`.** Nó xuất `fontWeight` và `letterSpacing` vào tuple
  `fontSize` nhưng không xuất `lineHeight`, nên mọi chữ chạy 1.5 mặc định của Tailwind thay vì
  1.15–1.75 như DESIGN.md. Không cổng nào bắt được: `design:lint` chỉ đọc DESIGN.md (nơi giá trị
  vẫn đúng). `scripts/design-line-height.mjs` vá lại và tự nó là một cổng — thiếu lineHeight cho
  bất kỳ token nào thì nó thoát mã 1.
- **Phân loại lỗi Postgres bằng SQLSTATE, đừng bằng văn xuôi.** Đã vấp: `/violates foreign key/`
  không khớp `violates RESTRICT setting of foreign key constraint` (có chữ chen vào giữa), và
  sqlstate là `23001` chứ không phải `23503`. Văn xuôi đổi theo phiên bản và theo `lc_messages`;
  sqlstate thì không. Sequelize bọc lỗi gốc vào `.parent` nên `e.code` ở tầng ngoài luôn
  `undefined` — xem `pgInfo()` ở `lib/admin/actions.ts`.
- **Đoạn tĩnh thắng đoạn động trong App Router.** `/quan-tri/vat-pham` che `/quan-tri/[shelf]`,
  nên một kệ đặt tên "Vật phẩm" (slug `vat-pham`) sẽ mất màn quản trị. `createShelf` coi slug đó
  như đã dùng. **Thêm route TĨNH nào ở gốc URL thì phải thêm slug đó vào `RESERVED_SLUGS`
  (`lib/admin/actions.ts`) trong cùng lượt.** Đã quên hai lần: `cong-dong` và `media` lọt ra
  ngoài danh sách cho tới 2026-09-04 — một kệ đặt tên "Cộng đồng" sẽ vào `/cong-dong` ra bảng
  tin, và màn quản trị của kệ đó biến mất.
- **Kho địa chỉ hóa theo nội dung phải trả về TÊN ĐÃ LƯU, không vọng lại tên vừa gửi.** Cùng
  byte = cùng dòng, nên `ON CONFLICT DO NOTHING` giữ tên của lần tải đầu; trả tên mới về cho
  form là để người dùng thấy một tên rồi tải về ra tên khác. Đã đo thật trong trình duyệt trên
  `/api/quan-tri/tai-lieu`. Sửa bằng một câu `SELECT` đọc lại sau khi ghi.
- **Tên tệp đi vào `Content-Disposition` phải có bản chỉ-ASCII.** Giá trị header đi qua undici,
  và một ký tự ngoài Latin-1 làm chính `new Response()` NÉM — route chết, không phải tải về sai
  tên. Tên bài giảng tiếng Việt gần như chắc chắn có dấu. Dùng `filename=` bản ASCII đã lọc +
  `filename*=UTF-8''…` bản đủ dấu.
- **Hai nhánh của một điều kiện mà cùng mở đầu bằng `<input>` thì React TÁI DÙNG phần tử đó.**
  Ô file (uncontrolled) biến thành ô hidden (controlled) và console cảnh báo đúng thế. Xảy ra ở
  `SlideField`; `ImageField` thoát vì nhánh sau của nó mở đầu bằng `<div>`. Cho hai nhánh hai
  `key` khác nhau để React tháo ra dựng lại.
- **Ghi file vào `public/` LÚC CHẠY không phục vụ được.** `next start` trả 404, `next dev` trả
  200 — bẫy "chạy tốt trên máy tôi" chỉ nổ ở production. File commit sẵn thì vẫn bình thường. Đó
  là lý do ảnh nằm trong bảng `media` (bytea) chứ không nằm trên đĩa.
- **`sequelize.query()` không truyền `type` trả `[rows, pg.Result]` — phần tử thứ hai là OBJECT,
  không phải số dòng.** Mười phép `affected === 0` trong `lib/admin/actions.ts` vì thế là mã chết
  suốt một thời gian dài: ép kiểu `as [unknown, number]` che mất điều đó lúc biên dịch, nên khi RLS
  chặn một UPDATE thì giao diện vẫn báo "Đã lưu." Dùng `rowsAffected()` ở `lib/db/rows-affected.ts`,
  và `db:check` có một phép chạy UPDATE trúng 0 dòng để bắt khi Sequelize đổi hình dạng trả về.
- **`RAISE EXCEPTION` trong hàm SECURITY DEFINER hủy CẢ transaction của request — kể cả câu UPDATE
  ngay phía trên nó.** Giới hạn 5 lần thử mã OTP từng hoàn toàn vô hiệu vì đúng chuyện này:
  `UPDATE login_codes SET attempts = attempts + 1` bị roll back cùng exception, nên bộ đếm vĩnh viễn
  bằng 0 và nhánh `attempts + 1 > 5` không bao giờ với tới — tức là chiếm tài khoản từ xa chỉ bằng
  cách thử hết 10^6 mã. Hàm nào cần GHI LẠI dấu vết của một lần gọi thất bại thì phải `RETURN NULL`
  rồi để tầng Node ném lỗi SAU khi transaction đã commit. Luồng OTP đó nay đã bị gỡ, nhưng LUẬT thì
  còn nguyên và đang áp cho `app.ket_thuc_dang_nhap` / `app.ket_thuc_khoi_phuc` — xem
  `lib/auth/dang-nhap.ts`, chỗ `throw` bắt buộc nằm NGOÀI `withRole()`.
- **Phép kiểm khóa ngoại của Postgres BỎ QUA row-level security** (tài liệu PG, mục Row Security
  Policies). Một INSERT tham chiếu tới dòng mà RLS đang giấu vẫn thành công, nên route nào phân biệt
  "khóa ngoại hỏng" với "ok" thì thành máy dò slug sách nháp. Cho câu lệnh tự đi qua RLS
  (`INSERT … SELECT … FROM public.books WHERE slug = $2`) thay vì để khóa ngoại trả lời.
- **`crypto.timingSafeEqual` so BYTE, còn `String.length` đếm KÝ TỰ.** Chốt chặn độ dài viết theo ký
  tự để lọt một chữ ký 43 ký tự nhưng 44 byte, và hàm ném `RangeError` thay vì trả `null`.
  `getSessionUserId()` nằm trên đường đi của gần như MỌI trang và MỌI route handler (12 module
  gọi nó), nên đó là 500 toàn site gây ra bởi một cookie méo. Dựng `Buffer` trước rồi so
  `.length` của buffer.
- **`empty:hidden` trên một vùng `aria-live` giết chính vùng đó.** `display: none` gỡ phần tử khỏi
  cây trợ năng, nên khi Server Action trả kết quả thì nội dung VÀ việc hiện lại xảy ra trong cùng một
  lần cập nhật DOM — trình đọc màn hình coi đó là vùng live vừa được THÊM chứ không phải một thay
  đổi, và thường không đọc. Vùng live phải có mặt sẵn: rỗng nhưng vẫn hiện.
- **`design:lint` KHÔNG tự chặn lỗi tương phản.** Rule `contrast-ratio` có severity `warning`, mà CLI
  đặt `exitCode = errors > 0` — cảnh báo in ra rồi thoát 0. Đó là lý do ô nhập quản trị chạy ở 1.00:1
  cho tới lúc có người mở trình duyệt ra đo. Nay `design:lint` đi qua `scripts/design-lint-gate.mjs`,
  thoát 1 khi có BẤT KỲ error hoặc warning nào; và `design:verify` (trong `check`) chặn `DESIGN.md`
  trôi lệch khỏi `tailwind.theme.json`.
- **Agent nền chết vì hết hạn mức thì trả `null`, và script nào gộp `null` với "đã bị bác bỏ" sẽ báo
  cáo NGƯỢC sự thật.** Một đợt review đối kháng từng mất 101/120 agent phản biện đúng kiểu đó:
  workflow vẫn kết thúc `status: completed`, tổng kết ghi "33 phát hiện bị bác" trong khi 32 cái chưa
  từng được ai xem — và cả 25 cái sau đó được xác nhận là lỗi thật. Luôn tách BA trạng thái —
  sống-sót, bị-bác, CHƯA-XỬ — rồi chạy lại nhóm cuối. Đừng để phiếu trắng đếm thành phiếu chống.
- **`array_length('{}'::text[], 1)` trả NULL, và CHECK chỉ TỪ CHỐI khi biểu thức ra FALSE.** NULL
  thì cho qua. Nên `CHECK (array_length(a,1) BETWEEN 2 AND 4)` nhận thẳng một mảng rỗng — đúng thứ
  nó tuyên bố là chặn. Đã đo thật 2026-09-07 trên `book_questions`: `('{}'::text[], 7)` ghi được,
  qua cả hai ràng buộc. Mọi CHECK trên `text[]` phải bọc `coalesce(array_length(a, 1), 0)`.
- **`ON CONFLICT` KHÔNG dùng được với ràng buộc UNIQUE `DEFERRABLE`** — Postgres từ chối dùng nó
  làm trọng tài, sqlstate `55000`. Ba bảng nội dung đều có ràng buộc vị trí deferrable, nên upsert
  theo `(book_slug, position)` là không viết được; dùng `DELETE` rồi `INSERT`, hoặc
  `INSERT … SELECT … WHERE NOT EXISTS`. Đây là lý do thật sự đằng sau cách `seed-content.mjs` xóa
  sạch trang rồi chèn lại.
- **`CREATE TABLE IF NOT EXISTS` KHÔNG sửa được bảng đã tồn tại.** Ràng buộc viết trong thân
  `CREATE TABLE` chỉ có hiệu lực với database chưa có bảng đó — sửa nó trên máy đã migrate là
  không có gì xảy ra, âm thầm. Ràng buộc nào còn phải sửa thì đặt riêng bằng
  `ALTER TABLE … DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`.

