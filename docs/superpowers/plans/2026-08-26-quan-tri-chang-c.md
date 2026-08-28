# Giao diện quản trị `/quan-tri` — Chặng C

> **Trạng thái:** bản chi tiết từng bước đã bị **rút gọn ngày 2026-08-28**. Bản gốc viết cho một
> BaaS ngoài đã bị gỡ bỏ; mọi đoạn mã mẫu trong đó gọi SDK, MCP và role không còn tồn tại, nên
> để nguyên là mời một agent làm theo hướng dẫn sai. File này giữ lại **những gì đã quyết** —
> phần đắt nhất — và bỏ phần từng-bước sẽ viết lại khi bắt đầu chặng.
>
> Bản đầy đủ vẫn còn trong git:
> `git show 3646431:docs/superpowers/plans/2026-08-26-quan-tri-chang-c.md`

**Goal:** Admin đăng nhập vào `/quan-tri` tạo được một kệ mới, một quyển sách mới, soạn các
trang của nó, xuất bản — rồi học sinh đọc được quyển đó, tất cả mà không chạm vào SQL và không
build lại.

**Spec:** `docs/superpowers/specs/2026-08-24-noi-dung-dong-va-quan-tri-design.md` §5 (phạm vi
chính), §6 (ảnh), §3.3 (hàng rào ghi). Đọc banner ở đầu spec đó — phần sản phẩm còn đúng, phần
hạ tầng thì không.

**Hạ tầng:** `CLAUDE.md` mục "Backend — PostgreSQL cục bộ" và `db/schema/README.md`.

---

## Đã xong

| | |
|---|---|
| **Task 1** — RPC đổi thứ tự | Xong, ở `db/schema/08-reorder.sql`. `reorder_books(text, text[])` và `reorder_pages(text, uuid[])`, cố ý **SECURITY INVOKER** để policy "admin write" vẫn áp lên UPDATE bên trong. Khẳng định cấu trúc nằm ở `90-verify.sql`; phần kiểm **hành vi** (đổi chỗ thật rồi trả lại) cần seed nên chưa viết. |
| **Task 2** — `slugify` + `uniqueSlug` | Xong, `lib/admin/slug.ts` + 8 test. Thuần, không dính backend nên không bị ảnh hưởng gì. |
| **Task 4** — hằng class form | Xong, `components/ui/controls.ts` (`FOCUS_RING`, `LABEL`, `FIELD`, `PRIMARY_BUTTON`, `QUIET_BUTTON`, `DANGER_BUTTON`). |
| **Task 3** — cổng admin | Xong. `lib/admin/gate.ts`, `AdminGate`, `AdminShell`. Kiến trúc đã chốt: **server component đọc + Server Action ghi**, không có tầng API admin. |
| **Task 6** — quản lý kệ | Xong. `lib/admin/shelves.ts` (đọc) + `lib/admin/actions.ts` (ghi) + `ShelfAdmin`. Thêm `reorder_shelves` vào `08-reorder.sql`. |

## Còn lại

| Task | Việc |
|---|---|
| 5 | Upload ảnh + bắt buộc nhập `source`/`credit` |
| 7 | Quản lý vật phẩm — `/quan-tri/vat-pham` |
| 8 | Quản lý sách trong kệ — `/quan-tri/[shelf]` |
| 9 | Soạn trang — `/quan-tri/[shelf]/[book]` |
| 10 | Nghiệm thu đầu-cuối + cập nhật `CLAUDE.md` |

---

## Ba quyết định đi lệch khỏi spec §5 — vẫn còn hiệu lực

1. **Đổi thứ tự bằng nút ▲/▼, không phải kéo-thả.** Spec viết "kéo đổi thứ tự". Kéo-thả cần thêm
   thư viện hoặc một mớ HTML5 DnD viết tay, và nó hỏng trên bàn phím lẫn màn hình cảm ứng. Hai
   cái nút làm đúng việc đó với 0 dependency. `ponytail:` trần của lựa chọn này là danh sách rất
   dài; đường nâng cấp là gắn `@dnd-kit/sortable` vào đúng chỗ đang gọi `reorder*`.
2. **Không có ô upload ảnh bìa kệ và ảnh bìa sách trong chặng này.** Đã kiểm bằng grep:
   `ContentBook.cover` được đọc lên nhưng **không component nào render nó** — bìa sách vẽ hoàn
   toàn bằng CSS trong `BookCover.module.scss`. Còn bảng `shelves` **không có** cột
   `cover_source`/`cover_credit`, nên upload vào `shelves.cover_url` sẽ tạo ra một tấm ảnh không
   có chỗ ghi giấy phép — vi phạm §6.
3. **Chọn quốc gia bằng ô nhập mã ISO-3166-1 numeric, không phải bấm trên bản đồ.** Bản đồ là
   chặng D; ô nhập dùng được ngay và chặng D thay nó bằng cách gắn thêm chỗ chọn, không phải
   viết lại.

## Ràng buộc bắt buộc

- **Không hardcode mã hex.** Chỉ dùng class Tailwind sinh từ `DESIGN.md`. Cần token mới thì sửa
  `DESIGN.md` rồi `npm run design:build`; **đừng sửa `tailwind.theme.json` bằng tay**.
- **Không dùng emoji làm icon.** Dùng `lucide-react`.
- **Không có ô nhập "vật phẩm cần để mở."** Nó suy ra từ vị trí (quyển `i` mở bằng vật phẩm
  thưởng của quyển `i-1`), hiện ra dạng **đọc-thôi**. Spec §2.2.
- **Ảnh bắt buộc có `*_source` + `*_credit`.** Điều kiện của giấy phép CC BY-SA, không phải thủ
  tục thừa. Spec §6.
- **Không thêm INSERT/UPDATE trực tiếp lên `user_items` hay cột `user_book_progress.completed`.**
- **Cổng duy nhất là `npm run check`**, cộng `npm run db:check` sau mỗi lần đổi `db/schema/`.

## Kiến trúc đã chốt (Task 3)

**Server Component đọc + Server Action ghi.** Không có tầng API admin nào. Bản gốc bắt toàn bộ
giao diện chạy phía client vì phiên của BaaS cũ nằm trong `localStorage`; ràng buộc đó đã hết.

**Ba lớp, và `AdminGate` là lớp yếu nhất trong ba:**

1. `AdminGate` chỉ quyết định hiện màn nào. **Không phải hàng rào.**
2. `requireAdmin()` ở dòng đầu **mọi** Server Action. Tài liệu Next nói thẳng: action là một
   endpoint POST công khai, *"reachable to anyone who can send the same POST. Treat every action
   as an untrusted entry point."*
3. Policy `admin write` ở tầng database — lớp duy nhất không thể quên gọi.

**Tách đọc khỏi ghi thành hai file là quyết định bảo mật, không phải sắp xếp:** trong file có
`"use server"`, MỌI export đều thành endpoint POST công khai, kể cả hàm chỉ đọc.

**Không truyền được function làm `children`** từ Server Component xuống Client Component. Trạng
thái `pending` lấy bằng `useFormStatus` trong một nút con (`SubmitButton`), không phải render prop.

## Xong chặng C khi

- [ ] `npm run check` xanh.
- [ ] `npm run db:check` mọi phép đạt, và phép ghi-khi-đã-đăng-nhập đạt vì **message** báo RLS chặn chứ không phải thiếu GRANT.
- [ ] Admin tạo được một kệ + một quyển + các trang của nó từ số không, xuất bản, và một người **chưa đăng nhập** đọc được quyển đó — không viết một dòng SQL nào.
- [ ] Người đăng nhập nhưng **không** phải admin mở `/quan-tri` thấy màn từ chối, và (đã kiểm ở tầng DB) không ghi được gì kể cả khi lách qua giao diện.
- [ ] Ảnh nào có mặt trên giao diện học sinh thì đều kèm nguồn + tác giả; form không cho lưu ảnh thiếu hai thứ đó.
- [ ] Không có ô nhập "vật phẩm cần để mở" ở bất kỳ đâu; chuỗi mở khóa chỉ hiện dạng chữ đọc-thôi.
- [ ] Xuất bản một quyển 0 trang bị chặn ở giao diện, khớp với `RAISE EXCEPTION 'Book has no pages'`.
- [ ] `grep -rn "required_item_slug" --include="*.ts" --include="*.tsx" .` không ra kết quả nào.
- [ ] Phần kiểm **hành vi** của `reorder_books`/`reorder_pages` đã được viết (đổi chỗ thật rồi trả lại), vì Task 8 và 9 là nơi đầu tiên gọi chúng.

## Chưa làm, để chặng D

| Việc | Vì sao hoãn |
|---|---|
| Kéo-thả đổi thứ tự | ▲/▼ làm đúng việc đó với 0 dependency và dùng được bằng bàn phím. Nâng cấp bằng `@dnd-kit/sortable` vào chỗ đang gọi `reorder*`. |
| Upload ảnh bìa kệ / bìa sách | `shelves` thiếu cột `cover_source`/`cover_credit`, và `books.cover_url` chưa component nào render — upload bây giờ là tạo ảnh không có chỗ ghi giấy phép. |
| Chọn quốc gia trên bản đồ | Bản đồ thế giới là chặng D. Ô nhập mã ISO numeric dùng được ngay. |
| Focus trap cho modal quản trị | Chặng C không có modal — tất cả là form trên trang. |
| Gửi email thật cho mã đăng nhập | `lib/auth/otp.ts` in mã ra console ở dev và **nổ** ở production. Gắn nhà cung cấp mail khi deploy. |
