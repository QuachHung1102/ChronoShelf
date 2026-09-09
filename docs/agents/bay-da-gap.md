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

- **`overflow-x: clip` KHÔNG cắt trục dọc, và một lớp trang trí cao 200% thì nong cả trang.**
  `Room` có `.dust` cao `200%` và `.lightBeam` cao `132%` (top −12%); cả hai thò xuống dưới đáy
  phòng. Chú thích trong file khẳng định `clip` "cắt đúng phần phải cắt" — nó cắt, nhưng chỉ theo
  trục được nêu. Đo 2026-09-09 ở 1024×768 trên `/lich-su-quanh-cuoc-song`: `scrollHeight` 1440 so
  với `clientHeight` 768, tức cuộn được 672px vào một khoảng đen — và lỗi này có ở MỌI trang dùng
  `Room`, không riêng màn kệ. Sửa bằng một khung bao `.lopNen` với `overflow: clip` (cả hai trục)
  ôm trọn các lớp trang trí; kẹp `overflow` lên chính `.room` thì nuốt luôn nội dung tràn của
  trang khác. Sau khi sửa: `scrollHeight` 768, cuộn được 0.
- **`justify-content: center` trong một hộp cuộn cắt mất phần đầu và không cuộn ngược tới được.**
  Nội dung cao hơn hộp thì phần tràn chia đều hai đầu, nửa trên rơi vào toạ độ âm — vùng mà scroll
  container không với tới. Với chồng sách thì đó là "kệ 20 quyển mất mấy quyển đầu". Từ khóa đúng là
  `justify-content: safe center`: căn giữa khi còn vừa, tự rơi về `start` khi tràn.
- **`min-height` mặc định của flex/grid item là `auto`, nên vùng cuộn con không bao giờ tràn.**
  Item phình theo nội dung thay vì kẹp lại, và cả TRANG cuộn thay cho cái div đáng lẽ phải cuộn.
  Mọi tổ tiên nằm giữa khung khoá chiều cao và vùng `overflow-y: auto` đều phải có `min-height: 0`
  (Tailwind: `min-h-0`).
- **`.catch()` quanh một lời gọi trong Server Component NUỐT luôn tín hiệu bailout của Next,
  và `next build` chết ở một route không liên quan.** Next báo "trang này không prerender được"
  bằng cách NÉM một exception riêng khi ta đọc cookie hay database. `Rail` ở root layout bọc
  `readShelfList()` và `isAdmin()` trong `.catch()` để một cú nấc DB không giết cả site — hợp
  lý, nhưng nó nuốt luôn tín hiệu, Next tưởng mọi thứ ổn và tiếp tục prerender, rồi build
  chết ở `/dang-nhap` với "Error occurred prerendering page" kèm stack toàn ký tự rút gọn của
  runtime, không chỉ về file nào của mình. Đo 2026-09-09. Cách sửa: khai `force-dynamic` cho
  layout — không còn bước prerender thì không còn tín hiệu nào để nuốt. Đừng đi tìm lỗi ở
  route bị báo; nó chỉ là route đầu tiên chạm phải.
- **Mỗi page tự dựng thanh điều hướng của mình = điều hướng bị tháo ra dựng lại mỗi lần chuyển
  trang.** Triệu chứng người dùng thấy: chuyển trang "giật", logo và các con số nháy một nhịp.
  Triệu chứng máy đo được: mọi component client trong thanh đó mất state và gọi lại API
  (`/api/me/state`, `/api/auth/me`) sau mỗi lần điều hướng. Đưa nó lên `app/layout.tsx` thì
  Next giữ nguyên qua mọi lần chuyển route con. Phép kiểm rẻ: `setAttribute('data-probe', …)`
  lên phần tử đó, điều hướng, rồi xem thuộc tính còn không — còn nghĩa là cùng một node DOM.
  Kèm theo: `loading.tsx` phải THÔI vẽ khung xương cho thanh đó, nếu không sẽ có hai thanh.
- **Một hằng số bố cục chép từ CSS sang TypeScript là một nguồn sự thật thứ hai.** Vị trí giọt
  mực trong chậu neo cứng "bờ chiếm 56%", trong khi CSS là `max(516px, 56%)` — tức 65% ở
  1024px. Hệ quả: giọt tính theo bề ngang toàn canvas, bán kính vượt vùng nước 40%, mực tràn
  khỏi mép phải và dồn thành một mảng ở góc. Trên màn hình nó vẫn là mực đẹp nên không ai
  nhận ra. Đo bằng `ResizeObserver` thay vì chép số, và đưa công thức ra một module thuần để
  `node --test` canh được bất biến "giọt phải nằm trong vùng nước".
- **Tailwind bỏ qua class nó không hiểu trong IM LẶNG, và không cổng nào của repo canh việc
  đó** — cho tới `npm run design:dead-class` (thêm 2026-09-10). Sau lượt đổi ~805 chỗ dùng
  token sang thế giới mực, còn sót đúng 7 dòng, và cả bảy đều qua được `design:lint`,
  `tsc`, `eslint` lẫn `next build`. Thứ đắt nhất trong đó: bản đồ chọn quốc gia ở `/quan-tri`
  ra `fill: rgb(0,0,0)` trên cả **705** `<path>` — một mảng đen không biên giới, nước đang
  chọn không khác nước không chọn; và ô chọn đáp án trắc nghiệm rơi về `accent-color: auto`,
  tức xanh dương của hệ điều hành, ngay giữa thao tác quan trọng nhất của sản phẩm. Cổng
  không so với danh sách token viết tay (chính danh sách viết tay là thứ đã lỡ nhịp hai lần
  ở khối A của `90-verify.sql`) mà build CSS thật rồi đòi mọi class hình-dạng-token phải có
  mặt trong đó.
- **Đổi token màu xong thì `hover:` và `active:` có thể trở thành lệnh rỗng.** Hai token cũ
  khác nhau (`primary-dark` → `primary`) map về cùng một token mới, nên thẻ kệ sách ở trang
  chủ mang `bg-primary hover:bg-primary active:bg-primary`: không phản hồi hover, không phản
  hồi bấm, trong khi comment ngay trên đó vẫn hứa "hover sáng lên một bậc". Không lỗi, không
  cảnh báo — chỉ là một thẻ chết. Quét bằng cách so phần đuôi của `hover:x-y` với `x-y` trên
  cùng một phần tử.
- **Bộ class viết cho nền TỐI theo chân component sang nền SÁNG và không ai thấy.** `AuthMenu`
  giữ nguyên `navItemClass` — bộ viết cho dải header ngang nền chàm — khi chuyển vào rail nền
  giấy, nên tên tài khoản và nút Đăng xuất mang `text-on-ink` (#F6F7F9) đứng trên `bg-paper`
  (#F6F7F9): **1.00:1**. Với người chưa đăng nhập thì chính lối vào đăng nhập biến mất khỏi
  màn hình. Phép kiểm rẻ và chạy được trên MỌI màn: duyệt `document.querySelectorAll('body *')`,
  lấy phần tử có text node TRỰC TIẾP, dựng màu nền hiệu dụng bằng cách chồng ngược các lớp
  `background-color` bán trong suốt lên tới lớp đục đầu tiên, rồi so tỉ số tương phản với
  ngưỡng AA theo cỡ chữ. Chạy trên 13 màn ngày 2026-09-10: ra đúng hai chỗ, và cái thứ hai
  (chip "Nháp", `ink-dilute` trên `mist`, 4.03:1) thì mắt thường không bao giờ bắt được.
- **`<legend>` nhiều dòng bị chính đường viền của `<fieldset>` kẻ ngang qua.** Trình duyệt
  nhúng legend vào border-top và căn theo NỬA chiều cao của nó, nên legend hai dòng (nhãn
  "Câu 1/3" + câu hỏi) có dòng thứ hai nằm dưới đường viền — đo ở 1024×768: legend cao
  39.6px, viền đi qua giữa. Đừng bỏ câu hỏi ra khỏi legend để né (nó là TÊN của nhóm radio,
  bỏ ra là người dùng trình đọc màn hình nghe từng lựa chọn mà không bao giờ nghe câu hỏi):
  cho legend `sr-only` và vẽ lại phần nhìn được bằng `<p aria-hidden>`.
- **Đổi nền một màn từ TỐI sang SÁNG làm hỏng mọi cặp màu cùng lúc, và build vẫn xanh.** Gỡ
  căn phòng gỗ khỏi trình đọc là một dòng JSX; thứ đi theo nó là mọi `text-on-ink`,
  `text-son-light`, `text-feathered`, `border-feathered`, hai hằng nút `*_ON_DARK`, quầng son
  65% và một tấm thẻ cố ý không viền. Không cái nào là lỗi biên dịch. Phép quét tương phản
  bắt được đúng một chỗ sót — số trang "Trang 4/4" ở `text-feathered`, **1.91:1** trên
  `paper` — và đó là chỗ mắt thường dễ bỏ qua nhất vì nó vẫn *hiện ra*. Đổi nền thì chạy
  phép quét, đừng đọc lại từng dòng.
- **Một thước tiến độ dùng chung trên hai nền ngược nhau thì một trong hai bản luôn sai.**
  `components/ui/thuoc.module.scss` là bản gộp của BA bản chép trước đó — đúng, nhưng nó ra
  đời khi cả ba nơi dùng đều là nền tối. Khi túi hành trang và trang chủ chuyển sang nền
  giấy, sửa bản dùng chung cho nền sáng (rãnh `mist`, thanh đầy `primary`) làm thanh đầy trên
  **thẻ kệ nền mực** thành 1.00:1 — phần ĐÃ đạt biến mất, thước chỉ còn nói phần chưa đạt.
  Gộp được HÌNH DẠNG; màu thì phải theo nền, và chỗ đảo màu là ở file của màn đó.
- **`<Room>` kiểu "bối cảnh dùng chung" giấu một thế giới cũ sống rất lâu sau khi nó chết.**
  Sau khi đổi toàn bộ hệ thiết kế, hai màn vẫn dựng trong căn phòng gỗ — trình đọc (màn quan
  trọng nhất) và đăng nhập (màn đầu tiên người dùng gặp) — vì cả hai chỉ *gọi một component*,
  và lượt đổi token cơ học có chạm vào file đó nhưng chỉ đổi tên màu bên trong: gỗ vẫn là gỗ,
  chỉ là gỗ màu chàm. Cách thấy: grep component bối cảnh chứ đừng grep tên token.
- **Một chậu mực có mô phỏng thật vẫn đứng im nếu không ai khuấy nó.** Người dùng báo "hiệu
  ứng loang mực chỉ auto một chỗ", và có hai nguyên nhân cộng lại: nhịp tự động duy nhất của
  màn kệ chỉ `splat` tại ĐÚNG một điểm (giọt của bài nên đọc tiếp), còn
  `velocityDissipation: 0.991` tắt vận tốc sau vài giây nên những giọt đặt sẵn loang xong là
  nằm bất động — mặt nước thành một bức tranh tĩnh. Cách chữa KHÔNG phải là thả thêm mực:
  lượng mực mang nghĩa "đã đọc xong bao nhiêu quyển". Thả cú khuấy `amount = 0` (chỉ bơm vận
  tốc) ở nhiều điểm, bán kính lớn hơn giọt cỡ 18 lần (0.02 vs 0.0011 — bán kính giọt chỉ
  chọc một lỗ kim, dòng chảy tắt trước khi tới đâu), vị trí đi theo hai tần số không cùng ước
  để quỹ đạo không khép thành vòng lặp mắt nhận ra.
- **`preserveDrawingBuffer` tắt thì mọi phép đo pixel trên canvas WebGL đều nói dối, và nói
  dối theo hướng "đạt".** `drawImage(canvasWebGL, …)` sau khi khung hình đã present trả về
  buffer RỖNG, tức toàn màu đen — một phép kiểm "đếm pixel có mực" trên đó cho 4096/4096 và
  báo mực phủ kín chậu, đúng lúc chậu gần như trống. Đo hiệu ứng thị giác của WebGL thì chụp
  màn hình ở các mốc thời gian rồi nhìn, và nói rõ đó là quan sát chứ không phải phép đo số.
- **`requestAnimationFrame` ở tab nền bị throttle xuống ~1 fps, nên đừng đếm khung hình để
  chứng minh một hoạt cảnh còn sống.** Đo trên tab không được chọn: 3 khung trong 3 giây. Con
  số đó không nói gì về hoạt cảnh; nó nói về tab.
- **"Phía trên" của chậu là trục Oz, không phải mép trên của khung — và đoán sai chỗ này thì
  hai bản sửa liên tiếp đều trượt.** Chậu được nhìn TỪ TRÊN XUỐNG: giọt rơi về phía người
  xem, chạm mặt nước tại một điểm rồi đẩy nước ra MỌI hướng quanh điểm đó. Bản đầu đẩy giọt
  theo một vector `(dx, dy)` — mực bay lệch hẳn một phía, và người dùng gọi đúng tên: "giống
  con mực bắn mực hơn". Bản thứ hai thêm cả một pass trọng lực theo Oy vào bộ giải để giọt
  "rơi xuống"; nó chỉ đổi hướng bắn thành hướng xuống, tạo vệt dọc trên mặt phẳng Oxy — vẫn
  là bắn, và pass đó đã bị gỡ nguyên vẹn. Cái đúng là `giotRoi()` ở `lib/ink/giot.ts`: một
  giọt mực ở tâm cộng tám cú đẩy CHỈ-VẬN-TỐC xếp đều trên vòng tròn quanh nó, tất cả hướng ra
  ngoài. Bất biến canh được bằng `node --test`, và nó chính là ranh giới giữa hai hiệu ứng:
  **tổng động lượng của cụm phải bằng 0** — có hướng ưu tiên nào thì đó là phun, không phải rơi.
