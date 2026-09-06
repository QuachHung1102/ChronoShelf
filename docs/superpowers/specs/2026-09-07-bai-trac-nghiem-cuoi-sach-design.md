# Bài trắc nghiệm cuối sách — thiết kế

Ngày: 2026-09-07

Nguồn: `content.md` §4.3, đoạn **"Tùy chọn nâng cao"**. Đây là phần cuối cùng còn thiếu
của cơ chế lõi *đọc sách → nhận vật phẩm → mở quyển sau*.

## 1. Phạm vi — `content.md` §4.3 đòi gì, đã dựng gì

`content.md` §4.3 viết nguyên văn:

> **Tùy chọn nâng cao:** trước khi thả vật phẩm, hiển thị 2–3 câu hỏi trắc nghiệm ngắn về
> nội dung vừa đọc. Trả lời đúng mới nhận được vật phẩm. Cơ chế này biến việc mở khóa
> thành phần thưởng cho việc *hiểu bài*, không chỉ *lướt qua bài*.

| Yêu cầu | Cách làm |
|---|---|
| 2–3 câu hỏi trắc nghiệm ngắn | Bảng `public.book_questions`, một dòng một câu, `position` quyết thứ tự |
| Hiện **trước** khi thả vật phẩm | `QuizPanel` thay chỗ quyển sách ở trang cuối, trước `ItemDropOverlay` |
| Trả lời đúng mới nhận vật phẩm | Chấm bài nằm trong `_complete_book_for`, cùng transaction với việc ghi `user_items` |
| "Tùy chọn" — không phải quyển nào cũng có | Quyển không có dòng `book_questions` nào giữ nguyên hành vi cũ, không cần cờ bật/tắt |
| Admin soạn được lúc chạy | `/quan-tri/[shelf]/[book]` có thêm khối `QuestionAdmin` |

Chữ "tùy chọn" được hiểu theo nghĩa **dữ liệu**, không phải theo nghĩa một cột `has_quiz`:
số câu hỏi của một quyển bằng 0 thì quyển đó không có bài kiểm tra. Một cột cờ riêng chỉ
tạo ra được một trạng thái vô nghĩa mới — "bật bài kiểm tra nhưng chưa có câu hỏi nào".

## 2. Mô hình dữ liệu — `book_questions`

Bảng nội dung **thứ năm**, nằm cuối `db/schema/04-content-tables.sql`:

```
id             uuid PK DEFAULT gen_random_uuid()
book_slug      text NOT NULL REFERENCES books(slug) ON DELETE CASCADE
position       integer NOT NULL CHECK (position >= 1)
prompt         text NOT NULL
choices        text[] NOT NULL
correct_index  smallint NOT NULL
```

| Ràng buộc | Nó ngăn chuyện gì |
|---|---|
| `book_questions_book_position_key` UNIQUE `(book_slug, position)` DEFERRABLE INITIALLY DEFERRED | Hai câu cùng vị trí trong một quyển. DEFERRABLE để cùng khuôn với `pages`/`books` — hiện chưa có RPC đổi thứ tự nào cần trạng thái trung gian, nhưng đường nâng cấp để mở, và `90-verify.sql` giữ nó ở nguyên dạng đó |
| `CHECK (btrim(prompt) <> '' AND length(prompt) <= 300)` | Câu hỏi rỗng hoặc chỉ toàn khoảng trắng; và một đoạn văn dài dán nhầm vào ô câu hỏi |
| `book_questions_choices_ck`: `array_length(choices,1) BETWEEN 2 AND 4`, `array_position(choices, NULL) IS NULL`, `NOT ('' = ANY (choices))` | Một-lựa-chọn (không phải câu hỏi), quá bốn lựa chọn (không vừa tấm giấy da), và lựa chọn NULL/rỗng lọt vào mảng |
| `book_questions_correct_range_ck`: `correct_index >= 0 AND correct_index < array_length(choices,1)` | Đáp án trỏ ra ngoài mảng — đúng chuyện xảy ra khi admin xóa bớt một lựa chọn mà quên hạ đáp án xuống |

### 2.1. Vì sao đáp án là CHỈ SỐ, không phải bản sao chuỗi

`correct_index` là chỉ số **0-based** vào `choices`, không phải một cột `correct_answer text`
chứa lại chuỗi đáp án.

Hai bản sao của cùng một sự thật là hai chỗ để lệch nhau. Admin sửa chính tả trong `choices`
mà quên sửa cột đáp án là câu hỏi thành **vô nghiệm** — không lựa chọn nào khớp, học sinh
không có cách nào đi tiếp, và không ràng buộc nào ở tầng database bắt được (một CHECK kiểu
`correct_answer = ANY (choices)` viết được, nhưng nó chỉ hợp thức hóa việc lưu hai lần).

Với chỉ số thì `book_questions_correct_range_ck` giữ cho đáp án **luôn trỏ vào một lựa chọn
có thật**, và sửa chính tả một lựa chọn không đụng gì tới đáp án.

Cùng lý do, `db/seed/*.json` lưu trường `correct` là chỉ số 0-based chứ không phải chuỗi:
đúng thứ database lưu, nên `scripts/seed-content.mjs` không có bước dịch nào để mà dịch sai.

## 3. Hàng rào: GRANT **THEO CỘT**, không phải policy

Đây là phần quan trọng nhất của cả subsystem.

Bốn bảng nội dung trước đó (`shelves`, `items`, `books`, `pages`) **không giấu gì cả** —
`CLAUDE.md` nói thẳng rằng nội dung của quyển "đang khóa" vốn đã công khai, khóa/mở chỉ là
chuyện hiển thị. `book_questions.correct_index` là ngoại lệ **duy nhất** trong toàn bộ nội
dung: đáp án tới được trình duyệt thì bài kiểm tra chỉ còn là trang trí.

### 3.1. Vì sao không phải RLS

**RLS lọc DÒNG. Nó không có khái niệm cột.** Một policy `USING (…)` chỉ trả lời được câu
hỏi "dòng này có được thấy không", không trả lời được "cột này trong dòng này có được thấy
không". Muốn giấu đúng một cột thì cửa duy nhất của Postgres là GRANT theo cột.

`db/schema/05-content-rls.sql` vì vậy làm hai việc tách bạch:

```sql
REVOKE ALL ON public.book_questions FROM PUBLIC, chronoshelf_anon, chronoshelf_auth;

GRANT SELECT (id, book_slug, position, prompt, choices) ON public.book_questions
  TO chronoshelf_anon, chronoshelf_auth;

GRANT INSERT, UPDATE, DELETE ON public.book_questions TO chronoshelf_auth;
```

`correct_index` **không có trong danh sách năm cột đó**. Còn RLS vẫn bật và vẫn có hai
policy như bốn bảng kia — `"read published"` (đọc câu hỏi của sách đã xuất bản, admin thấy
cả nháp) và `"admin write"` (`USING (is_admin())` và `WITH CHECK (is_admin())`) — nhưng
chúng lo việc *dòng nào*, không lo *cột nào*.

Quyền GHI thì cấp cả bảng: ghi không làm lộ gì, và admin buộc phải đặt được đáp án nên
INSERT/UPDATE bắt buộc chạm `correct_index`.

### 3.2. Lỗi nó chặn, và vì sao nó fail ĐÓNG

Lỗi dễ mắc nhất không phải một cuộc tấn công. Nó là một dòng `SELECT *` vô ý trong
`readShelf()` (`lib/content/read.ts`) rồi đẩy nguyên dòng xuống một client component — tức
là in đáp án ra HTML cho ai bấm "View source" cũng đọc được.

Với GRANT theo cột, câu lệnh đó **nổ ngay**: Postgres trả
`permission denied for table book_questions`. Đây đúng kiểu **fail đóng** mà `withRole()`
dựa vào — hỏng to và hỏng ngay, thay vì âm thầm chạy với quyền rộng hơn.

Hai chốt phụ trợ đi kèm, cùng một tinh thần:

- Model Sequelize `BookQuestion` (`lib/db/models.ts`) **cố ý không khai** `correctIndex`.
  Sequelize liệt kê tường minh các cột đã khai vào câu SELECT nó sinh ra, nên
  `BookQuestion.findAll()` không bao giờ chạm tới cột đáp án. Ai thêm cột đó vào model thì
  truy vấn nổ chứ không rò.
- Kiểu `ContentQuestion` (`lib/content/types.ts`) chỉ có `prompt` và `choices`. Không có
  trường đáp án, và đó là toàn bộ điểm của kiểu này.

`scripts/db-check.mjs` đo đúng chuyện này từ phía ứng dụng: nó gọi
`SELECT correct_index FROM public.book_questions` **và** `SELECT * FROM public.book_questions`
dưới role `chronoshelf_auth`, và đòi cả hai bị chặn với thông điệp
`permission denied for table book_questions`.

Chú ý hình dạng thông điệp: hàng rào ở đây là **GRANT**, nên thông điệp đúng là
`permission denied for table` — giống `user_items`, **khác** bốn bảng nội dung (ở đó hàng
rào là policy, nên thông điệp đúng là `new row violates row-level security policy`). Đây
chính là bài học thứ 3 trong mục "Ba bài học phải giữ" của `CLAUDE.md`: mỗi hàng rào phải
được khẳng định theo đúng cơ chế của **chính nó**. Ghi chú trong `db-check.mjs` nói rằng
chuỗi này đã được đo trên PostgreSQL 18 ngày 2026-09-07 và PG báo theo BẢNG kể cả khi câu
lệnh chỉ hỏi đúng một cột bị cấm — nếu ngày nào nó đổi thành `for column` thì đó là hình
dạng thông điệp đổi, không phải hàng rào hỏng.

Đi kèm là một **đối chứng bắt buộc**: `db-check.mjs` cũng đọc
`SELECT id, book_slug, position, prompt, choices` và đòi câu đó **thành công**. Không có
đối chứng thì một lần `REVOKE` quá tay cũng làm phép kiểm trên xanh, trong khi trình đọc
không hiện được câu hỏi nào và bài kiểm tra biến mất khỏi sản phẩm.

### 3.3. Hai cửa đọc được đáp án

Đáp án chỉ có đúng hai đường ra khỏi database, cả hai đều là `SECURITY DEFINER` và **không
đường nào đi qua model `BookQuestion`**:

| Cửa | Ai vào được | Nó làm gì |
|---|---|---|
| `public.complete_book(text, smallint[])` | `GRANT EXECUTE` cho `chronoshelf_auth` | Chấm bài **bên trong** database. Đáp án so xong là biến mất, không bao giờ trả ra ngoài |
| `public.admin_book_questions(text)` | `GRANT EXECUTE` cho `chronoshelf_auth`, nhưng tự `RAISE EXCEPTION` nếu `NOT public.is_admin()` | Trả `correct_index` cho **màn soạn câu hỏi** — nơi duy nhất trong sản phẩm hiện đáp án |

`admin_book_questions` là mặt sau bắt buộc của GRANT theo cột: admin cũng không SELECT được
`correct_index`, mà màn soạn thảo thì phải hiện đáp án đang chọn. Cách rẻ là nới GRANT ra
cho mọi người đã đăng nhập — tức là vứt bỏ toàn bộ §3. Cách đúng là một cửa hẹp tự kiểm
`is_admin()`.

Vì `SECURITY DEFINER` nên hàm **không chịu RLS**: mất dòng `is_admin()` bên trong là bất kỳ
ai đã đăng nhập cũng đọc được đáp án của mọi quyển, kể cả quyển còn nháp. Đó là lý do
`90-verify.sql` §B2 không chỉ hỏi hàm có tồn tại không mà còn soi
`pg_get_functiondef(...) LIKE '%is_admin()%'`, và `db-check.mjs` gọi thẳng hàm bằng một tài
khoản thường rồi đòi đúng `P0001` kèm chuỗi `chỉ admin`.

`lib/admin/questions.ts` là đường đọc đáp án duy nhất của tầng Node. Nó gọi
`SELECT * FROM public.admin_book_questions($1)` chứ không đọc bảng, nên kể cả khi
`getAdminUserId()` ở đó lỡ bị bỏ qua thì người thường vẫn nhận về exception chứ không phải
đáp án. File này **không có** `"use server"` — cùng lý do đã tách `lib/admin/shelves.ts`
khỏi `lib/admin/actions.ts`.

## 4. Chấm bài — trong `_complete_book_for`, không ở đâu khác

`db/schema/07-complete-book.sql` giữ nguyên hình dạng cũ (`_complete_book_for` nhận
`user_id` tường minh để kiểm được bằng fixture; `complete_book` là cửa duy nhất mở cho ứng
dụng), và thêm một bước chấm bài đúng giữa "đã đọc hết trang chưa" và "ghi `completed` +
trao vật phẩm":

```sql
SELECT coalesce(array_agg(q.n ORDER BY q.n), '{}')
  INTO v_wrong
  FROM (SELECT correct_index, row_number() OVER (ORDER BY position) AS n
          FROM public.book_questions
         WHERE book_slug = p_book_slug) q
 WHERE q.correct_index IS DISTINCT FROM p_answers[q.n::int];
```

**Vì sao ở đây:** đây là chỗ duy nhất trong sản phẩm đọc `correct_index`. Việc chấm bài
không thể chuyển lên tầng Node kể cả khi ai đó muốn — role ứng dụng không đọc nổi cột đáp
án. So với luật cũ ("việc trao vật phẩm phải nằm ở phía server", vì `chronoshelf_auth`
không có quyền ghi `user_items`), luật này chặt hơn một bậc: không phải "viết ở Node thì
không chạy được", mà là "viết ở Node thì không có dữ liệu để mà viết".

Bốn quyết định trong đoạn trên:

**Đối chiếu theo THỨ TỰ (`row_number()`), không theo giá trị `position`.** Xóa một câu để
lại lỗ thủng trong `position` — y hệt `pages`, không có RPC nào lấp lại. Client thì gửi về
một mảng **song song với danh sách câu hỏi nó nhận được**, đánh số liên tục từ 0. Neo vào
`position` là lệch chỉ số ngay lần admin xóa câu hỏi đầu tiên. Thứ tự trong
`ContentBook.cauHoi` (`ORDER BY position`) và `row_number() OVER (ORDER BY position)` là
cùng một thứ tự, nên hai bên nói cùng một ngôn ngữ.

**Trượt thì `RETURN`, KHÔNG `RAISE EXCEPTION`.** `CLAUDE.md` ghi bài học này bằng máu:
exception trong một hàm `SECURITY DEFINER` hủy **cả transaction của request**, kể cả câu
UPDATE ngay phía trên nó — đúng chuyện đã làm bộ đếm số lần thử OTP vĩnh viễn bằng 0 và
biến giới hạn 5 lần thành vô hiệu. Ở đây, tại thời điểm chấm bài, hàm chưa ghi gì nên chưa
mất gì; nhưng nếu ngày nào thêm việc đếm số lần làm bài thì lần ghi đó cũng sẽ bị cuốn
theo. Trả về một `jsonb` với `quizPassed: false` là hình dạng đúng ngay từ đầu, không phải
một tối ưu.

**Cố ý không giới hạn số lần thử.** Xem §6.

**Quyển không có câu hỏi nào giữ nguyên hành vi cũ, không cần trường hợp đặc biệt.**
`array_agg` trên không dòng trả `NULL`, `coalesce` biến thành `'{}'`,
`array_length('{}', 1)` là `NULL`, nên nhánh trượt không chạy. Không có `IF EXISTS
(SELECT 1 FROM book_questions …)` nào ở đây cả — trường hợp rỗng tự rơi vào đúng nhánh.

**`p_answers` thiếu hoặc NULL tính là SAI, không phải được miễn.** Truy cập ngoài biên một
mảng Postgres trả `NULL`, và `IS DISTINCT FROM` cho ra "sai". Nhờ vậy một client cũ chưa
biết gì về bài kiểm tra — nó gửi mảng rỗng — sẽ **trượt**, chứ không đi vòng qua được.

### 4.1. Làm sạch mảng đáp án ngay tại biên

`app/api/me/complete/route.ts` giữ đúng vai trò cũ: route mỏng, không quyết định gì. Nó chỉ
thêm một hàm `readAnswers()`:

- cắt còn `MAX_ANSWERS = 50` phần tử (mảng đến từ trình duyệt nên dài tùy ý, và nó đi thẳng
  vào một bind của Postgres; 50 rộng gấp nhiều lần con số 2–3 mà `content.md` §4.3 mô tả);
- mọi phần tử không phải số nguyên trong `[0, 4)` thành `-1`.

`-1` là một chỉ số **không bao giờ** khớp `correct_index`, vì
`book_questions_correct_range_ck` bắt nó phải `>= 0`. Nhờ vậy rác gửi lên chỉ có thể làm
bài kiểm tra **trượt** — không thể làm nó đạt, và cũng không làm truy vấn nổ.

`CompleteBookResult` (`lib/api/types.ts`) thêm hai trường và cố ý để **phẳng** thay vì dựng
union theo `quizPassed`: ba trường còn lại đều đã có giá trị "không có gì" hợp lệ
(`false` / `null` / `null`), nên một union chỉ đổi lấy an toàn kiểu bằng một đống thu hẹp
kiểu ở mọi chỗ dùng.

`wrongPositions` nói **rõ câu nào sai**, không chỉ "sai rồi". Đây là hệ quả trực tiếp của
§6: bài kiểm tra là hàng rào sư phạm, nên giấu đi chỉ làm học sinh bế tắc chứ không chặn
được ai.

## 5. Đổi chữ ký `complete_book` — và cái bẫy nạp chồng

Chữ ký đổi từ `complete_book(text)` sang `complete_book(text, smallint[])` (và
`_complete_book_for(uuid, text)` sang `_complete_book_for(uuid, text, smallint[])`).

`db/schema/07-complete-book.sql` vì vậy mở đầu bằng:

```sql
DROP FUNCTION IF EXISTS public.complete_book(text);
DROP FUNCTION IF EXISTS public._complete_book_for(uuid, text);
```

**`CREATE OR REPLACE` với chữ ký mới chỉ NẠP CHỒNG.** Postgres phân giải hàm theo tên *và*
kiểu tham số, nên bản hai-tham-số cũ sẽ ở lại nguyên vẹn — cùng cái tên, cùng quyền
EXECUTE, `SECURITY DEFINER`, và **trao vật phẩm mà không chấm bài**. Một cửa thứ hai, mở
toang, không ai thấy: `db:migrate` vẫn xanh, ứng dụng vẫn chạy đúng, chỉ cần một client gọi
`complete_book('slug')` một tham số là bỏ qua cả subsystem này.

Vì đó là loại lỗi im lặng, nó được canh bằng một khẳng định riêng trong `90-verify.sql` §C:

```sql
IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname IN ('complete_book','_complete_book_for')
              AND p.pronargs < CASE p.proname WHEN 'complete_book' THEN 2 ELSE 3 END) THEN
  RAISE EXCEPTION 'còn bản nạp chồng cũ của complete_book — trao vật phẩm mà KHÔNG chấm bài';
END IF;
```

Khẳng định theo **số tham số**, không theo danh sách chữ ký cụ thể: đó là cách nói "không
có bản nào ÍT tham số hơn", đúng tinh thần "liệt kê trạng thái còn nguyên, đừng liệt kê
trạng thái đã hỏng" của `CLAUDE.md`.

`scripts/db-mutation-check.mjs` chứng minh khẳng định đó biết kêu: một đột biến tạo thẳng
`CREATE FUNCTION public.complete_book(text)` rồi đòi `90-verify.sql` phải nổ với chuỗi
`bản nạp chồng cũ`.

Ba đột biến mới của mục B2, mỗi cái cho một đường làm lộ đáp án: cấp
`GRANT SELECT (correct_index)` cho role ứng dụng, hồi sinh chữ ký một-tham-số, và tạo lại
`admin_book_questions` mất dòng kiểm `is_admin()`.

## 6. Phạm vi thật — nói thẳng

**Bài kiểm tra này là hàng rào SƯ PHẠM, không phải hàng rào bảo mật. Đừng bao giờ trình
bày nó như một hàng rào bảo mật.**

Ba lý do, không cái nào sửa được và cũng không nên sửa:

1. **Nội dung sách vốn công khai.** `CLAUDE.md` đã ghi: khóa/mở chỉ là chuyện hiển thị, nội
   dung quyển "bị khóa" ai cũng đọc được. Đáp án nằm ngay trong trang sách.
2. **Chỉ 2–3 câu, mỗi câu 2–4 lựa chọn.** Không gian đáp án nhỏ tới mức thử hết là xong.
3. **Không giới hạn số lần thử, và đó là chủ ý.** Xem dưới.

Thêm giới hạn số lần thử sẽ **không** biến nó thành hàng rào bảo mật — nó chỉ trừng phạt
đúng những học sinh đang thật lòng làm bài, đúng nhóm người mà cơ chế này tồn tại vì họ.
`complete_book` cũng **không** ép thứ tự đọc (đo ngày 2026-08-29, ghi ở `CLAUDE.md`), nên
một bài kiểm tra chặt hơn cũng không đóng được ngõ đó.

Thứ nó **thật sự bảo đảm**, và chỉ ngần này:

- **Đáp án không bao giờ có mặt trong HTML.** Không có gì để "View source" ra rồi dán vào.
- **Không chấm bài được ở phía client.** Kết quả đạt/trượt do database quyết, trong cùng
  transaction với việc ghi `user_items`, nên không sửa được bằng DevTools.
- **Học sinh phải quay lại đọc trước khi đi tiếp** — đúng câu chữ của `content.md` §4.3:
  phần thưởng cho việc *hiểu bài*, không phải cho việc *lướt qua bài*.

Nói cách khác: hàng rào bảo mật ở đây bảo vệ **tính toàn vẹn của bài kiểm tra**, không bảo
vệ **nội dung sách**. Hai chuyện khác nhau.

## 7. Luồng trong trình đọc

`components/reader/BookReaderModal.tsx` thêm đúng một trạng thái mới, `quizOpen`:

1. Lật tới trang cuối. Nút chính đổi nhãn theo việc quyển này có bài kiểm tra hay không:
   `"Đọc xong — làm bài kiểm tra"` thay vì `"Đọc xong — nhận vật phẩm"`. Hứa "nhận vật
   phẩm" rồi mở ra một bài kiểm tra là đúng loại bất ngờ làm người dùng mất tin vào nút bấm.
2. `QuizPanel` **thay chỗ** quyển sách, không phủ lên trên: nó là trang cuối cùng của quyển,
   và một lớp phủ nữa bên trong một `<dialog>` đã modal sẵn chỉ đẻ thêm một tầng bẫy focus.
3. Nộp bài → `completeBook(bookSlug, answers)` → `POST /api/me/complete`.
4. `quizPassed === false`: ở lại màn bài kiểm tra, `wrongPositions` đánh dấu đúng những câu
   sai, các câu đã đúng giữ nguyên. Không đặt `result` — chưa có vật phẩm nào rơi ra.
5. `quizPassed === true`: `ItemDropOverlay` chạy như trước.

Chi tiết đáng giữ:

- **`coBaiKiemTra = book.cauHoi.length > 0 && !daHoanThanh`.** `ShelfPageClient` truyền
  `daHoanThanh={openBook.state === "completed"}`. Đọc lại một quyển đã xong thì không phải
  làm lại bài — và `complete_book` cũng bỏ qua phần chấm bài trong trường hợp đó (nhánh
  `alreadyCompleted`), nên giao diện và máy chủ nói cùng một chuyện thay vì hai chuyện khác
  nhau tình cờ trùng kết quả.
- **Phím mũi tên bị chặn khi `quizOpen`.** Hai phím mũi tên là cách di chuyển giữa các lựa
  chọn trong một nhóm radio; để nguyên thì mỗi lần học sinh đổi đáp án bằng bàn phím là
  quyển sách phía sau lật thêm một trang.
- **"Thử lại" ở khối lỗi mở lại bài kiểm tra** thay vì nộp thẳng mảng rỗng — nộp rỗng thì
  máy chủ chấm trượt và học sinh không thấy màn nào giải thích vì sao.
- **Chưa đăng nhập thì đóng bài kiểm tra lại**: lối sang trang đăng nhập nằm ở khối lỗi của
  màn đọc, và làm xong bài cũng vô ích khi chưa có tài khoản để ghi kết quả vào.

`QuizPanel` (`components/reader/QuizPanel.tsx`):

- `-1` là "chưa chọn". Nút nộp khóa khi còn câu chưa chọn — máy chủ vẫn coi bỏ trống là sai,
  nhưng chặn ở đây để học sinh không nộp bài thiếu rồi nhận về một danh sách câu sai gây
  hoang mang.
- `daNop` là bản chụp đáp án ở lần nộp gần nhất. Nhờ nó, "câu nào còn đang bị đánh dấu sai"
  là một giá trị **suy ra được lúc render** (`wrongPositions.filter(n => answers[n-1] === daNop[n-1])`)
  chứ không phải một state thứ hai phải đồng bộ bằng `useEffect`: dấu "chưa đúng" biến mất
  ngay khi học sinh đổi lựa chọn của đúng câu đó.
- Tấm giấy da `bg-surface`, không phải panel tối — bài kiểm tra là trang cuối của quyển sách,
  không phải hộp thoại chen ngang. Nhờ vậy nó dùng lại đúng cặp màu thân trang sách và không
  phát minh thêm cặp nào cho `design:lint` phải gác.
- Câu sai đổi viền sang `destructive`, **nhưng màu không phải tín hiệu duy nhất** (WCAG
  1.4.1): còn icon và dòng chữ. Vùng `aria-live` luôn có mặt, rỗng nhưng vẫn hiện — bẫy
  `empty:hidden` đã ghi ở `CLAUDE.md`.

## 8. Màn quản trị

`QuestionAdmin` nằm dưới `PageAdmin` trên `/quan-tri/[shelf]/[book]`, ngăn bằng một đường kẻ
— đúng thứ tự học sinh gặp: lật hết trang rồi mới tới câu hỏi. Hai lượt đọc (`listPages`,
`listQuestions`) chạy **tuần tự**, không `Promise.all`: cả hai đi qua `withRole`, và hai truy
vấn song song trên cùng một connection Sequelize sẽ chồng lên nhau (bẫy đã ghi ở `CLAUDE.md`).

Ba Server Action mới trong `lib/admin/actions.ts`: `createQuestion`, `updateQuestion`,
`deleteQuestion`. Tất cả bắt đầu bằng `requireAdmin()`, vì mọi export trong file có
`"use server"` đều là một endpoint POST công khai.

### 8.1. `readChoices` — dịch "ô thứ mấy" sang "chỉ số trong mảng đã nén"

Biểu mẫu luôn hiện đúng bốn ô (`MAX_CHOICES = 4`, khớp trần trong
`book_questions_choices_ck`), mỗi ô có một radio `name="correct"` mang `value` là **số thứ
tự của ô**. Ô để trống bị bỏ qua khi lưu, nên một câu hai lựa chọn chỉ cần điền hai ô đầu.

Chỗ dễ sai nằm ở đó: radio trỏ tới **ô thứ mấy trên biểu mẫu**, còn `correct_index` lưu
**chỉ số trong mảng đã nén**. Admin bỏ trống ô 2 rồi điền ô 3 là hai con số lệch nhau.

`readChoices()` nén mảng và dịch chỉ số trong **cùng một vòng lặp**, nên chúng không thể
lệch:

```ts
for (let slot = 0; slot < MAX_CHOICES; slot++) {
  const text = field(fd, `choice${slot}`);
  if (!text) continue;
  if (slot === chosenSlot) correctIndex = choices.length;
  choices.push(text);
}
```

Hai phép kiểm mà database **không** làm được, nên phải nằm ở đây:

- `correctIndex < 0` — admin đánh dấu vào một ô **để trống**. `book_questions_correct_range_ck`
  chỉ bắt được chỉ số ngoài mảng, nó không biết gì về chuyện này.
- Hai lựa chọn trùng nhau. Database không cấm (một CHECK cho việc đó cần subquery), nhưng
  một câu có hai lựa chọn giống hệt mà chỉ một cái "đúng" thì học sinh không có cách nào
  trả lời đúng bằng lý lẽ.

`updateQuestion` mang theo `AND book_slug = $5` trong mệnh đề WHERE — cùng lý do như
`updatePage`: một uuid hợp lệ bất kỳ không được phép sửa câu hỏi của quyển khác. Cả
`updateQuestion` lẫn `deleteQuestion` đọc số dòng bằng `rowsAffected()`
(`lib/db/rows-affected.ts`) chứ không ép kiểu tay — bẫy "RLS chặn UPDATE nhưng giao diện
vẫn báo *Đã lưu*" đã ghi ở `CLAUDE.md`.

`deleteQuestion` **không** có hàng rào "không xóa được câu cuối cùng" như `deletePage`: xóa
hết câu hỏi đưa quyển về đúng trạng thái mặc định (đọc hết trang là nhận vật phẩm), không
tạo ra ngõ cụt nào.

### 8.2. Đọc câu hỏi cho trình đọc: một truy vấn RIÊNG

`readShelf()` đọc `book_questions` bằng một `BookQuestion.findAll()` riêng, **không**
`include` vào truy vấn kệ. Hai `hasMany` trên cùng một truy vấn (`pages` + câu hỏi) cho ra
tích Descartes: thân mỗi trang sách — vài nghìn chữ — bị nhân lên theo số câu hỏi của quyển
đó. Vì vậy `lib/db/models.ts` chỉ khai chiều `BookQuestion.belongsTo(Book)`, không khai
`Book.hasMany(BookQuestion)`. Truy vấn này vẫn tuần tự trong cùng transaction.

## 9. Cổng nào canh rủi ro nào

| Rủi ro | Ai canh |
|---|---|
| Đáp án lọt vào HTML qua một `SELECT *` vô ý | GRANT theo cột (`05-content-rls.sql`) → `permission denied`; `90-verify.sql` §B2 (`has_column_privilege`); `db:check` mục "Bài trắc nghiệm cuối sách" |
| `REVOKE` quá tay làm mất luôn câu hỏi | Đối chứng trong `90-verify.sql` §B2 và trong `db:check` (đọc `prompt`/`choices` phải THÀNH CÔNG) |
| Người thường đọc đáp án qua `admin_book_questions` | Dòng `is_admin()` trong hàm; `90-verify.sql` soi `pg_get_functiondef`; `db:check` gọi bằng tài khoản thường |
| Chữ ký một-tham-số sống lại → trao vật phẩm mà không chấm bài | `DROP FUNCTION` ở đầu `07-complete-book.sql`; khẳng định `pronargs` trong `90-verify.sql` §C |
| Ba khẳng định trên "biết kêu" hay chỉ nằm đó | `db:mutation` — ba đột biến mới của mục B2 |
| Trả lời sai vẫn được vật phẩm | `db:check`: dựng bài hai câu trên một quyển thật rồi đo `user_items` qua bốn lần gọi (sai cả hai, đúng một nửa, bỏ trống, đúng hết) |
| Quyển không có câu hỏi bị hỏng theo | `db:check`: phép cuối của mục, xóa hết câu hỏi rồi gọi lại |
| Đáp án trỏ ra ngoài mảng, lựa chọn rỗng, quá 4 lựa chọn | `book_questions_choices_ck` + `book_questions_correct_range_ck` |
| Đánh dấu đáp án vào ô trống, hai lựa chọn trùng nhau | `readChoices()` — database không kiểm được hai chuyện này |
| Sai kiểu, `ContentQuestion` lỡ mọc thêm trường đáp án | `npm run check` (typegen + tsc) |
| Tương phản màu của `QuizPanel` | `design:lint` (đi qua `scripts/design-lint-gate.mjs`) |

Toàn bộ khối `db:check` mới nằm trong **một transaction rồi ROLLBACK**, nên câu hỏi thử và
vật phẩm vừa trao đều biến mất. `complete_book` là `SECURITY DEFINER` nhưng vẫn chạy trong
transaction của người gọi, nên ROLLBACK dọn được cả phần nó ghi.

## 10. Cố ý KHÔNG dựng

| Không có | Vì sao |
|---|---|
| **RPC đổi thứ tự câu hỏi** (kiểu `08-reorder.sql`) | Một bài chỉ 2–3 câu và thứ tự giữa chúng không mang nghĩa gì. Ràng buộc UNIQUE vẫn để DEFERRABLE và `90-verify.sql` giữ nó ở nguyên dạng đó, nên đường nâng cấp còn mở |
| **Giới hạn số lần thử / rate limit** | Xem §6. Nó không biến hàng rào sư phạm thành hàng rào bảo mật, chỉ trừng phạt người đang thật lòng làm bài |
| **Chấm điểm một phần** | `content.md` §4.3 viết "trả lời đúng mới nhận được vật phẩm". Đúng một nửa vẫn là chưa nắm bài — và `db:check` có hẳn một phép đo cho trường hợp đó |
| **Cột cờ `has_quiz`** | Số câu hỏi bằng 0 đã nói đúng chuyện đó. Một cột cờ chỉ đẻ ra trạng thái "bật nhưng rỗng" |
| **Câu nhiều đáp án đúng / câu tự luận** | `correct_index` là một `smallint`. Đổi sang `smallint[]` là một task riêng, và `content.md` chỉ đòi trắc nghiệm ngắn |
| **Lưu lại lịch sử làm bài** | Không có yêu cầu nào cần nó, và nó là bảng đầu tiên phải nghĩ tới nếu ngày nào thêm bộ đếm số lần thử — lúc đó nhớ đọc lại §4 về `RETURN` vs `RAISE EXCEPTION` |
| **Ràng buộc "quyển đã xuất bản phải có câu hỏi"** | 13 quyển đang chạy được xuất bản trước khi bảng này tồn tại. Bắt buộc có câu hỏi là chặn admin xuất bản một quyển mới cho tới khi soạn xong bài |

## 11. Nội dung mồi

`db/seed/*.json` nhận thêm mảng `questions` trên mỗi quyển, mỗi phần tử là
`{ prompt, choices, correct }` với `correct` là chỉ số 0-based. `scripts/seed-content.mjs`
giữ idempotent theo đúng cách đã dùng cho `pages`: `DELETE` sạch câu hỏi của quyển rồi chèn
lại, vì `(book_slug, position)` là khóa tự nhiên duy nhất.

Đếm trực tiếp từ ba file seed: 38 câu hỏi trên 13 quyển (`lich-su-viet-nam` 15 câu / 5
quyển, `lich-su-the-gioi` 11 câu / 4 quyển, `lich-su-quanh-cuoc-song` 12 câu / 4 quyển).

Nhắc lại `CLAUDE.md`: `db/seed/*.json` là **bootstrap một chiều**. Sửa file đó không làm đổi
nội dung đang chạy — sửa câu hỏi đang chạy bằng màn `/quan-tri/[shelf]/[book]`.
