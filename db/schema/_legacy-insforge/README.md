# Schema thời InsForge — không chạy nữa

Hai file ở đây là schema chạy trên backend InsForge cho tới 2026-08-28. Giữ lại vì
phần lớn lý do trong comment vẫn đúng và đã được port sang `db/schema/*.sql` mới.

**Đừng chạy chúng.** Chúng tham chiếu `auth.users`, `auth.uid()` và hai role
`anon`/`authenticated` do InsForge tạo — không thứ nào tồn tại trên PostgreSQL cục bộ.

Bản đồ port:

| Thời InsForge | Bây giờ |
|---|---|
| `auth.users` | `public.users` (`02-users.sql`) |
| `auth.uid()` | `app.current_user_id()` (`01-app-context.sql`) |
| role `anon` | role `chronoshelf_anon` (`00-roles.sql`) |
| role `authenticated` | role `chronoshelf_auth` (`00-roles.sql`) |
| PostgREST đổi role theo JWT | `SET LOCAL ROLE` trong middleware mỗi request |
