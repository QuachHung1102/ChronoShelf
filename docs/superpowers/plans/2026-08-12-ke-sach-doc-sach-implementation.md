# Kệ sách & Đọc sách — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Lịch sử Việt Nam" bookshelf + book reader flow end-to-end (real InsForge backend + Next.js UI) matching the approved design in `docs/superpowers/specs/2026-08-12-ke-sach-doc-sach-design.md` and the Pencil mockup in `pen.dev/design.pen`.

**Architecture:** Next.js App Router pages read/write InsForge Postgres directly through the `@insforge/sdk` client (RLS-scoped to the signed-in user). The one piece of privileged server-side logic — granting an item and marking a book complete — is a Postgres `SECURITY DEFINER` RPC function (`complete_book`), not a Deno edge function, so it runs inside the same request/transaction as the DB and needs no extra secret management.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS **3.4** (pinned, see constraint below), `@insforge/sdk`, InsForge Postgres/PostgREST.

## Global Constraints

- Tailwind CSS must stay on **3.4.x** — do not use v4. (`AGENTS.md`)
- InsForge SDK is for application logic (auth, CRUD, RPC); MCP tools (`run-raw-sql`, `create-bucket`, `bulk-upsert`) are for infrastructure/schema/seed only — never call those from app code. (`AGENTS.md`)
- Database inserts through the SDK require array format: `.insert([{...}])`. (`AGENTS.md`)
- `auth.uid()` is available in Postgres (confirmed via `run-raw-sql`) and resolves the JWT of the calling request — RLS policies and the `complete_book` RPC both rely on it.
- Scope is exactly the "Kệ sách + Đọc sách" subsystem for the "Lịch sử Việt Nam" shelf, desktop only, no quiz — per the approved spec. Other subsystems (trang chủ, túi hành trang, streak, learning hub) are out of scope.

---

### Task 1: Pin Tailwind 3.4, install InsForge SDK, create the client

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.ts`
- Modify: `postcss.config.mjs`
- Modify: `app/globals.css`
- Create: `lib/insforge/client.ts`
- Create: `.env.local` (not committed — see `.gitignore`)

**Interfaces:**
- Produces: `insforge` (default export of `lib/insforge/client.ts`), an `@insforge/sdk` client instance every later task imports.

- [ ] **Step 1: Replace Tailwind v4 with 3.4 in `package.json`**

Remove `"@tailwindcss/postcss": "^4"` and `"tailwindcss": "^4"` from `devDependencies`, add:

```json
"tailwindcss": "3.4.17",
"postcss": "^8.4.49",
"autoprefixer": "^10.4.20"
```

Install:

```bash
npm install @insforge/sdk@latest
npm install -D tailwindcss@3.4.17 postcss@^8.4.49 autoprefixer@^10.4.20
npm uninstall @tailwindcss/postcss
```

- [ ] **Step 2: Create classic Tailwind config**

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "primary": "#6E4A2E",
        "primary-dark": "#3B2415",
        "accent": "#E8622C",
        "bg": "#EFE3CB",
        "parchment": "#FBF4E4",
        "cream": "#F6ECDA",
        "text-primary": "#3B2415",
        "text-muted": "#8A7259",
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Colors/fonts mirror the variables set in `pen.dev/design.pen` (`color-primary`, `color-accent`, etc. from the spec's section 2 / Pencil `SetVariables` call) so the built UI matches the mockup.

- [ ] **Step 3: Swap PostCSS config to the classic plugin pair**

```js
// postcss.config.mjs
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Replace the v4 `@import "tailwindcss"` with classic directives**

Open `app/globals.css`, replace its Tailwind import line(s) with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Keep any existing custom CSS below those three lines.

- [ ] **Step 5: Verify Tailwind still builds**

Run: `npm run build`
Expected: build succeeds with no "Unknown at rule" / Tailwind v4 errors.

- [ ] **Step 6: Create the InsForge client**

```ts
// lib/insforge/client.ts
import { createClient } from "@insforge/sdk";

export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});
```

```bash
# .env.local
NEXT_PUBLIC_INSFORGE_BASE_URL=https://pk3kdyx2.ap-southeast.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=anon_608dd0a6f9973e4233e253436802be82af681f9411e51ef620a5da11c95e5337
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tailwind.config.ts postcss.config.mjs app/globals.css lib/insforge/client.ts
git commit -m "chore: pin Tailwind 3.4 and add InsForge SDK client"
```

(`.env.local` stays untracked — confirm it's covered by `.gitignore` before committing.)

---

### Task 2: Database schema, RLS, and the `complete_book` RPC

**Files:**
- Create: `db/schema/2026-08-12-ke-sach-doc-sach.sql` (source of truth, run via `run-raw-sql`)

**Interfaces:**
- Produces tables: `public.shelves`, `public.items`, `public.books`, `public.pages`, `public.user_book_progress`, `public.user_items`.
- Produces RPC: `complete_book(p_book_id uuid) returns jsonb` — `{ alreadyCompleted: boolean, grantedItem: {id,name,image_url,description}|null, nextBook: {id,title,unlocked}|null }`.

- [ ] **Step 1: Write the schema + RLS + RPC SQL**

```sql
-- db/schema/2026-08-12-ke-sach-doc-sach.sql

CREATE TABLE public.shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0
);

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  description text
);

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id uuid NOT NULL REFERENCES public.shelves(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_image_url text,
  position integer NOT NULL DEFAULT 0,
  required_item_id uuid REFERENCES public.items(id),
  reward_item_id uuid REFERENCES public.items(id)
);

CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  content text,
  image_url text,
  UNIQUE(book_id, page_number)
);

CREATE TABLE public.user_book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  current_page integer NOT NULL DEFAULT 1,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE(user_id, book_id)
);

CREATE TABLE public.user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_book_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read shelves" ON public.shelves FOR SELECT USING (true);
CREATE POLICY "public read items" ON public.items FOR SELECT USING (true);
CREATE POLICY "public read books" ON public.books FOR SELECT USING (true);
CREATE POLICY "public read pages" ON public.pages FOR SELECT USING (true);

CREATE POLICY "own progress select" ON public.user_book_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own progress insert" ON public.user_book_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.user_book_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own items select" ON public.user_items FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON public.shelves, public.items, public.books, public.pages FROM anon, authenticated;
GRANT SELECT ON public.shelves, public.items, public.books, public.pages TO anon, authenticated;

REVOKE ALL ON public.user_book_progress FROM anon, authenticated;
GRANT SELECT, INSERT ON public.user_book_progress TO authenticated;
GRANT UPDATE (current_page) ON public.user_book_progress TO authenticated;

REVOKE ALL ON public.user_items FROM anon, authenticated;
GRANT SELECT ON public.user_items TO authenticated;
-- No INSERT/UPDATE grant on user_items or on user_book_progress.completed for authenticated:
-- only complete_book() (SECURITY DEFINER, owned by postgres) can write them.

CREATE OR REPLACE FUNCTION public.complete_book(p_book_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_book RECORD;
  v_progress RECORD;
  v_total_pages integer;
  v_already_completed boolean := false;
  v_granted_item jsonb := null;
  v_next_book RECORD;
  v_has_next boolean := false;
  v_next_unlocked boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_book FROM public.books WHERE id = p_book_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  SELECT count(*) INTO v_total_pages FROM public.pages WHERE book_id = p_book_id;

  SELECT * INTO v_progress FROM public.user_book_progress WHERE user_id = v_user_id AND book_id = p_book_id;
  IF NOT FOUND THEN
    INSERT INTO public.user_book_progress (user_id, book_id, current_page)
      VALUES (v_user_id, p_book_id, v_total_pages)
      RETURNING * INTO v_progress;
  END IF;

  IF v_progress.completed THEN
    v_already_completed := true;
  ELSE
    IF v_progress.current_page < v_total_pages THEN
      RAISE EXCEPTION 'Book not finished yet (page % of %)', v_progress.current_page, v_total_pages;
    END IF;

    UPDATE public.user_book_progress
      SET completed = true, completed_at = now()
      WHERE user_id = v_user_id AND book_id = p_book_id;

    IF v_book.reward_item_id IS NOT NULL THEN
      INSERT INTO public.user_items (user_id, item_id)
        VALUES (v_user_id, v_book.reward_item_id)
        ON CONFLICT (user_id, item_id) DO NOTHING;
    END IF;
  END IF;

  IF v_book.reward_item_id IS NOT NULL THEN
    SELECT jsonb_build_object('id', i.id, 'name', i.name, 'image_url', i.image_url, 'description', i.description)
      INTO v_granted_item
      FROM public.items i WHERE i.id = v_book.reward_item_id;
  END IF;

  SELECT * INTO v_next_book FROM public.books
    WHERE shelf_id = v_book.shelf_id AND position > v_book.position
    ORDER BY position ASC LIMIT 1;
  v_has_next := FOUND;

  IF v_has_next THEN
    v_next_unlocked := v_next_book.required_item_id IS NULL
      OR EXISTS (SELECT 1 FROM public.user_items WHERE user_id = v_user_id AND item_id = v_next_book.required_item_id);
  END IF;

  RETURN jsonb_build_object(
    'alreadyCompleted', v_already_completed,
    'grantedItem', v_granted_item,
    'nextBook', CASE WHEN v_has_next THEN jsonb_build_object('id', v_next_book.id, 'title', v_next_book.title, 'unlocked', v_next_unlocked) ELSE null END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_book(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_book(uuid) TO authenticated;
```

- [ ] **Step 2: Run it against the backend**

Use the `run-raw-sql` MCP tool with the file's contents as the query.

- [ ] **Step 3: Runnable check — simulate a full unlock cycle**

Because this is the one piece of privileged logic in the subsystem, verify it directly with SQL before writing any UI against it (ponytail-style: one assert-based check, not a full test framework). Run via `run-raw-sql`, wrapped so `auth.uid()` resolves to a fake test user for the session:

```sql
DO $$
DECLARE
  v_test_user uuid := gen_random_uuid();
  v_shelf uuid;
  v_item uuid;
  v_book1 uuid;
  v_book2 uuid;
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_test_user)::text, true);

  INSERT INTO public.shelves (slug, name, "order") VALUES ('test-shelf', 'Test Shelf', 0) RETURNING id INTO v_shelf;
  INSERT INTO public.items (name) VALUES ('Test Item') RETURNING id INTO v_item;
  INSERT INTO public.books (shelf_id, title, position, reward_item_id) VALUES (v_shelf, 'Book 1', 0, v_item) RETURNING id INTO v_book1;
  INSERT INTO public.books (shelf_id, title, position, required_item_id) VALUES (v_shelf, 'Book 2', 1, v_item) RETURNING id INTO v_book2;
  INSERT INTO public.pages (book_id, page_number) VALUES (v_book1, 1), (v_book1, 2);

  -- Not finished yet: current_page defaults to 1, total pages is 2 -> must raise
  BEGIN
    PERFORM public.complete_book(v_book1);
    RAISE EXCEPTION 'expected complete_book to fail before last page';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Book not finished yet%' THEN RAISE; END IF;
  END;

  UPDATE public.user_book_progress SET current_page = 2 WHERE user_id = v_test_user AND book_id = v_book1;

  v_result := public.complete_book(v_book1);
  IF (v_result->>'alreadyCompleted')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'expected alreadyCompleted=false on first completion'; END IF;
  IF (v_result->'grantedItem'->>'id') IS DISTINCT FROM v_item::text THEN RAISE EXCEPTION 'expected granted item to be Test Item'; END IF;
  IF (v_result->'nextBook'->>'unlocked')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'expected next book to be unlocked after reward granted'; END IF;

  -- Idempotency: calling again must not grant a duplicate item or error
  v_result := public.complete_book(v_book1);
  IF (v_result->>'alreadyCompleted')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'expected alreadyCompleted=true on replay'; END IF;
  IF (SELECT count(*) FROM public.user_items WHERE user_id = v_test_user AND item_id = v_item) != 1 THEN
    RAISE EXCEPTION 'expected exactly one user_items row, replay must not duplicate';
  END IF;

  RAISE NOTICE 'complete_book: all checks passed';

  -- Clean up test fixtures
  DELETE FROM public.user_items WHERE user_id = v_test_user;
  DELETE FROM public.user_book_progress WHERE user_id = v_test_user;
  DELETE FROM public.books WHERE shelf_id = v_shelf;
  DELETE FROM public.items WHERE id = v_item;
  DELETE FROM public.shelves WHERE id = v_shelf;
END $$;
```

Expected: `NOTICE: complete_book: all checks passed`, no exceptions. If it fails, fix `complete_book` and re-run this whole block (it cleans up after itself either way isn't guaranteed on failure — re-run the cleanup DELETEs manually by `v_test_user`/`test-shelf` if it aborts midway).

- [ ] **Step 4: Commit the schema file**

```bash
git add db/schema/2026-08-12-ke-sach-doc-sach.sql
git commit -m "feat: add bookshelf schema, RLS, and complete_book RPC"
```

---

### Task 3: Seed "Lịch sử Việt Nam" content and storage buckets

**Files:**
- Create: `db/seed/shelves.json`, `db/seed/items.json`, `db/seed/books.json`, `db/seed/pages.json`

**Interfaces:**
- Consumes: tables from Task 2.
- Produces: 1 shelf (`lich-su-viet-nam`), 5 items, 5 books (matching content.md §4.4/§5.2 titles and unlock chain), 2 lorem pages per book (enough to exercise pagination + `complete_book`).

- [ ] **Step 1: Write seed JSON files**

```json
// db/seed/shelves.json
[{ "slug": "lich-su-viet-nam", "name": "Lịch sử Việt Nam", "order": 1 }]
```

```json
// db/seed/items.json
[
  { "name": "Trống đồng", "description": "Biểu tượng thời kỳ Hùng Vương." },
  { "name": "Cọc gỗ Bạch Đằng", "description": "Vũ khí thủy chiến của Ngô Quyền năm 938." },
  { "name": "Ấn tín Đông A", "description": "Ấn tín tượng trưng cho hào khí nhà Trần." },
  { "name": "Áo bào Quang Trung", "description": "Gắn với chiến thắng Ngọc Hồi - Đống Đa." },
  { "name": "Lá cờ Quyết Chiến Quyết Thắng", "description": "Biểu tượng chiến thắng Điện Biên Phủ 1954." }
]
```

Note: `books.json`/`pages.json` need the generated `shelves`/`items` ids first — run Step 2 for shelves/items, read back their ids with the `select()`-equivalent (`run-raw-sql`: `SELECT id, slug FROM shelves; SELECT id, name FROM items;`), then fill the id references below before writing those two files.

```json
// db/seed/books.json (fill <shelf_id>, <item:*> from the query above)
[
  { "shelf_id": "<shelf_id>", "title": "Khởi nguồn bờ cõi", "position": 0, "required_item_id": null, "reward_item_id": "<item:Trống đồng>" },
  { "shelf_id": "<shelf_id>", "title": "Trận chiến Bạch Đằng 938", "position": 1, "required_item_id": "<item:Trống đồng>", "reward_item_id": "<item:Cọc gỗ Bạch Đằng>" },
  { "shelf_id": "<shelf_id>", "title": "Hào khí Đông A", "position": 2, "required_item_id": "<item:Cọc gỗ Bạch Đằng>", "reward_item_id": "<item:Ấn tín Đông A>" },
  { "shelf_id": "<shelf_id>", "title": "Đại phá quân Thanh", "position": 3, "required_item_id": "<item:Ấn tín Đông A>", "reward_item_id": "<item:Áo bào Quang Trung>" },
  { "shelf_id": "<shelf_id>", "title": "Sử thi Điện Biên Phủ", "position": 4, "required_item_id": "<item:Áo bào Quang Trung>", "reward_item_id": "<item:Lá cờ Quyết Chiến Quyết Thắng>" }
]
```

```json
// db/seed/pages.json (fill <book:*> ids after books.json is loaded)
[
  { "book_id": "<book:Khởi nguồn bờ cõi>", "page_number": 1, "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit." },
  { "book_id": "<book:Khởi nguồn bờ cõi>", "page_number": 2, "content": "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." }
]
```

Repeat the 2-page pattern for the remaining 4 books (10 more rows) — same lorem text is fine, this is layout content only.

- [ ] **Step 2: Load shelves and items first**

Use `bulk-upsert` (table `shelves`, file `db/seed/shelves.json`, `upsertKey: slug`) then (table `items`, file `db/seed/items.json`, no upsert key needed for a first load).

- [ ] **Step 3: Read back generated ids, finish and load books.json / pages.json**

`run-raw-sql`: `SELECT id, slug FROM shelves; SELECT id, name FROM items;` — patch the placeholder ids into `books.json`, then `bulk-upsert` it (table `books`). Re-query `SELECT id, title FROM books;` to patch `pages.json`, then `bulk-upsert` it (table `pages`).

- [ ] **Step 4: Create storage buckets**

`create-bucket` with `bucketName: "book-covers"`, `isPublic: true`.
`create-bucket` with `bucketName: "page-images"`, `isPublic: true`.
`create-bucket` with `bucketName: "item-images"`, `isPublic: true`.
(No files uploaded yet in this pass — UI falls back to plain styled placeholders where `cover_image_url`/`image_url` is null, matching the Pencil mockup which used flat-color covers.)

- [ ] **Step 5: Verify with a read query**

`run-raw-sql`: `SELECT b.title, b.position, req.name AS requires, rew.name AS rewards, count(p.id) AS pages FROM books b LEFT JOIN items req ON req.id=b.required_item_id LEFT JOIN items rew ON rew.id=b.reward_item_id LEFT JOIN pages p ON p.book_id=b.id GROUP BY b.id, b.title, b.position, req.name, rew.name ORDER BY b.position;`
Expected: 5 rows, in the order from content.md §5.2, each with `pages = 2`.

- [ ] **Step 6: Commit seed files**

```bash
git add db/seed/
git commit -m "feat: seed Lịch sử Việt Nam shelf content"
```

---

### Task 4: Data-access layer

**Files:**
- Create: `lib/insforge/types.ts`
- Create: `lib/insforge/shelf.ts`

**Interfaces:**
- Consumes: `insforge` from Task 1, schema from Task 2.
- Produces: `getShelfWithBooks(slug: string): Promise<ShelfView>`, `getBookWithPages(bookId: string): Promise<BookDetail>`, `getOwnedItemIds(): Promise<Set<string>>`, `setCurrentPage(bookId: string, page: number): Promise<void>`, `completeBook(bookId: string): Promise<CompleteBookResult>` — every later UI task imports these instead of calling `insforge.database` directly.

- [ ] **Step 1: Define shared types**

```ts
// lib/insforge/types.ts
export interface Item {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
}

export interface Page {
  id: string;
  page_number: number;
  content: string | null;
  image_url: string | null;
}

export type BookState = "locked" | "unlocked" | "completed";

export interface BookSummary {
  id: string;
  title: string;
  cover_image_url: string | null;
  position: number;
  required_item_id: string | null;
  reward_item_id: string | null;
  state: BookState;
  currentPage: number;
}

export interface ShelfView {
  id: string;
  slug: string;
  name: string;
  books: BookSummary[];
}

export interface BookDetail {
  id: string;
  title: string;
  pages: Page[];
  currentPage: number;
}

export interface CompleteBookResult {
  alreadyCompleted: boolean;
  grantedItem: Item | null;
  nextBook: { id: string; title: string; unlocked: boolean } | null;
}
```

- [ ] **Step 2: Implement the data-access functions**

```ts
// lib/insforge/shelf.ts
import { insforge } from "./client";
import type { BookState, BookSummary, ShelfView, BookDetail, CompleteBookResult } from "./types";

export async function getOwnedItemIds(): Promise<Set<string>> {
  const { data: userData } = await insforge.auth.getCurrentUser();
  if (!userData.user) return new Set();

  const { data, error } = await insforge.database.from("user_items").select("item_id");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.item_id as string));
}

function resolveState(
  requiredItemId: string | null,
  isFirstBook: boolean,
  completed: boolean,
  ownedItemIds: Set<string>
): BookState {
  if (completed) return "completed";
  if (isFirstBook || (requiredItemId && ownedItemIds.has(requiredItemId))) return "unlocked";
  return "locked";
}

export async function getShelfWithBooks(slug: string): Promise<ShelfView> {
  const { data: shelf, error: shelfError } = await insforge.database
    .from("shelves")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();
  if (shelfError || !shelf) throw shelfError ?? new Error("Shelf not found");

  const { data: books, error: booksError } = await insforge.database
    .from("books")
    .select("id, title, cover_image_url, position, required_item_id, reward_item_id")
    .eq("shelf_id", shelf.id)
    .order("position", { ascending: true });
  if (booksError) throw booksError;

  const { data: userData } = await insforge.auth.getCurrentUser();
  const ownedItemIds = await getOwnedItemIds();

  let progressByBook = new Map<string, { current_page: number; completed: boolean }>();
  if (userData.user) {
    const { data: progress, error: progressError } = await insforge.database
      .from("user_book_progress")
      .select("book_id, current_page, completed")
      .in("book_id", (books ?? []).map((b) => b.id));
    if (progressError) throw progressError;
    progressByBook = new Map((progress ?? []).map((p) => [p.book_id as string, p]));
  }

  const summaries: BookSummary[] = (books ?? []).map((b, index) => {
    const progress = progressByBook.get(b.id);
    return {
      ...b,
      state: resolveState(b.required_item_id, index === 0, progress?.completed ?? false, ownedItemIds),
      currentPage: progress?.current_page ?? 1,
    };
  });

  return { id: shelf.id, slug: shelf.slug, name: shelf.name, books: summaries };
}

export async function getBookWithPages(bookId: string): Promise<BookDetail> {
  const { data: book, error: bookError } = await insforge.database
    .from("books")
    .select("id, title")
    .eq("id", bookId)
    .single();
  if (bookError || !book) throw bookError ?? new Error("Book not found");

  const { data: pages, error: pagesError } = await insforge.database
    .from("pages")
    .select("id, page_number, content, image_url")
    .eq("book_id", bookId)
    .order("page_number", { ascending: true });
  if (pagesError) throw pagesError;

  const { data: progress } = await insforge.database
    .from("user_book_progress")
    .select("current_page")
    .eq("book_id", bookId)
    .maybeSingle();

  return { id: book.id, title: book.title, pages: pages ?? [], currentPage: progress?.current_page ?? 1 };
}

export async function setCurrentPage(bookId: string, page: number): Promise<void> {
  const { data: userData } = await insforge.auth.getCurrentUser();
  if (!userData.user) return;

  const { data: existing } = await insforge.database
    .from("user_book_progress")
    .select("id")
    .eq("book_id", bookId)
    .maybeSingle();

  if (existing) {
    const { error } = await insforge.database
      .from("user_book_progress")
      .update({ current_page: page })
      .eq("book_id", bookId);
    if (error) throw error;
  } else {
    const { error } = await insforge.database
      .from("user_book_progress")
      .insert([{ user_id: userData.user.id, book_id: bookId, current_page: page }]);
    if (error) throw error;
  }
}

export async function completeBook(bookId: string): Promise<CompleteBookResult> {
  const { data, error } = await insforge.database.rpc("complete_book", { p_book_id: bookId });
  if (error) throw error;
  return data as CompleteBookResult;
}
```

- [ ] **Step 3: Runnable check**

Add a temporary `console.log` call site or use the Next.js dev server + browser devtools console once Task 5's page exists to call `getShelfWithBooks("lich-su-viet-nam")` and confirm it returns 5 books with book 1 `"unlocked"` and books 2-5 `"locked"`. (Formal automated tests are out of scope for this pass — this is presentation-layer plumbing over already-verified RPC/RLS from Task 2.)

- [ ] **Step 4: Commit**

```bash
git add lib/insforge/types.ts lib/insforge/shelf.ts
git commit -m "feat: add InsForge data-access layer for the bookshelf"
```

---

### Task 5: Kệ sách page (Header, BookShelf, BookCover)

**Files:**
- Create: `components/Header.tsx`
- Create: `components/shelf/BookCover.tsx`
- Create: `components/shelf/BookShelf.tsx`
- Create: `app/lich-su-viet-nam/page.tsx`

**Interfaces:**
- Consumes: `getShelfWithBooks` from Task 4, `BookSummary`/`ShelfView` types.
- Produces: `<BookCover book={BookSummary} onOpen={(id: string) => void} />`, `<BookShelf shelf={ShelfView} onOpenBook={(id: string) => void} />` — Task 6 reuses `BookCover`'s visual states and `BookShelf`'s layout is the mount point for the reader modal.

- [ ] **Step 1: Build the Header component**

```tsx
// components/Header.tsx
const NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/lich-su-viet-nam", label: "Lịch sử Việt Nam" },
  { href: "/lich-su-the-gioi", label: "Lịch sử Thế giới" },
  { href: "/lich-su-quanh-cuoc-song", label: "Lịch sử quanh cuộc sống" },
  { href: "/bai-giang-slide", label: "Bài giảng & Slide" },
];

export function Header({ activeHref }: { activeHref: string }) {
  return (
    <header className="flex h-[72px] items-center justify-between bg-primary px-8">
      <span className="font-heading text-xl font-bold text-cream">CỬA SỔ LỊCH SỬ</span>
      <nav className="flex items-center gap-6">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={
              item.href === activeHref
                ? "font-body text-sm font-bold text-accent"
                : "font-body text-sm text-cream"
            }
          >
            {item.label}
          </a>
        ))}
        <span className="font-body text-sm font-semibold text-cream">🔥 12</span>
        <span className="font-body text-sm font-semibold text-cream">🎒 7</span>
      </nav>
    </header>
  );
}
```

Streak/inventory counts are hardcoded placeholders — those subsystems aren't built yet (matches the approved spec's explicit scope note).

- [ ] **Step 2: Build BookCover with its 3 visual states**

```tsx
// components/shelf/BookCover.tsx
import type { BookSummary, Item } from "@/lib/insforge/types";

export function BookCover({
  book,
  requiredItemName,
  onOpen,
}: {
  book: BookSummary;
  requiredItemName: string | null;
  onOpen: (bookId: string) => void;
}) {
  const base = "flex w-[168px] h-[240px] flex-col rounded-md p-3.5";

  if (book.state === "locked") {
    return (
      <div className="flex w-[168px] flex-col items-center gap-2">
        <div className={`${base} items-center justify-center gap-2 bg-[#5A3B22] border border-primary-dark`}>
          <span className="text-3xl opacity-85">🔒</span>
          <p className="text-center font-heading text-sm font-bold text-cream/60">{book.title}</p>
        </div>
        <p className="w-[168px] text-center font-body text-xs italic text-text-muted">
          {requiredItemName ? `Cần ${requiredItemName} để mở` : ""}
        </p>
      </div>
    );
  }

  const isCompleted = book.state === "completed";
  return (
    <button
      type="button"
      onClick={() => onOpen(book.id)}
      className={`${base} justify-between bg-primary text-left ${
        isCompleted ? "" : "border-2 border-accent shadow-[0_0_24px_1px_rgba(232,98,45,0.6)]"
      }`}
    >
      {isCompleted && (
        <div className="flex justify-end">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent text-xs text-cream">
            ✓
          </span>
        </div>
      )}
      <p className="text-center font-heading text-sm font-bold text-cream">{book.title}</p>
    </button>
  );
}
```

- [ ] **Step 3: Build BookShelf**

```tsx
// components/shelf/BookShelf.tsx
import type { ShelfView } from "@/lib/insforge/types";
import { BookCover } from "./BookCover";

export function BookShelf({
  shelf,
  itemNamesById,
  onOpenBook,
}: {
  shelf: ShelfView;
  itemNamesById: Map<string, string>;
  onOpenBook: (bookId: string) => void;
}) {
  const openedCount = shelf.books.filter((b) => b.state !== "locked").length;

  return (
    <div className="px-12 pb-4">
      <div className="flex flex-col gap-2">
        <p className="font-body text-xs font-bold uppercase tracking-wide text-accent">KỆ SÁCH</p>
        <h1 className="font-heading text-4xl font-bold text-text-primary">{shelf.name}</h1>
        <p className="font-body text-sm text-text-muted">
          Bạn đã mở {openedCount}/{shelf.books.length} quyển
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-primary-dark px-8 pt-8">
        <div className="flex items-end justify-center gap-7">
          {shelf.books.map((book) => (
            <BookCover
              key={book.id}
              book={book}
              requiredItemName={book.required_item_id ? itemNamesById.get(book.required_item_id) ?? null : null}
              onOpen={onOpenBook}
            />
          ))}
        </div>
        <div className="h-4 w-full rounded-b-lg bg-[#2A160C]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire up the page route**

```tsx
// app/lich-su-viet-nam/page.tsx
import { Header } from "@/components/Header";
import { BookShelf } from "@/components/shelf/BookShelf";
import { getShelfWithBooks } from "@/lib/insforge/shelf";
import { insforge } from "@/lib/insforge/client";

export default async function LichSuVietNamPage() {
  const shelf = await getShelfWithBooks("lich-su-viet-nam");

  const requiredIds = shelf.books.map((b) => b.required_item_id).filter((id): id is string => !!id);
  const itemNamesById = new Map<string, string>();
  if (requiredIds.length > 0) {
    const { data: items } = await insforge.database.from("items").select("id, name").in("id", requiredIds);
    for (const item of items ?? []) itemNamesById.set(item.id, item.name);
  }

  return (
    <main className="min-h-screen bg-bg">
      <Header activeHref="/lich-su-viet-nam" />
      <BookShelf shelf={shelf} itemNamesById={itemNamesById} onOpenBook={() => {}} />
    </main>
  );
}
```

`onOpenBook` is wired to a no-op here because opening the reader is client-side state — Task 6 replaces this server component's static render with a thin client wrapper that owns `openBookId` and renders `<BookReaderModal>` on top.

- [ ] **Step 5: Run it**

```bash
npm run dev
```

Visit `http://localhost:3000/lich-su-viet-nam` — expect: header, title "Lịch sử Việt Nam", progress "Bạn đã mở 1/5 quyển" (book 1 auto-unlocked, no user signed in yet so no owned items), 5 covers with book 1 in the unlocked/glow state and books 2-5 locked with tooltip captions. Compare visually against the Pencil "Màn hình A" screenshot.

- [ ] **Step 6: Commit**

```bash
git add components/Header.tsx components/shelf/ app/lich-su-viet-nam/
git commit -m "feat: render Lịch sử Việt Nam bookshelf page"
```

---

### Task 6: Book reader (page flip, progress, completion)

**Files:**
- Create: `components/reader/BookReaderModal.tsx`
- Create: `components/reader/PageSpread.tsx`
- Create: `components/reader/ItemDropOverlay.tsx`
- Modify: `app/lich-su-viet-nam/page.tsx` → split into `app/lich-su-viet-nam/page.tsx` (server) + `components/shelf/ShelfPageClient.tsx` (client)

**Interfaces:**
- Consumes: `getBookWithPages`, `setCurrentPage`, `completeBook` from Task 4; `BookCover`/`BookShelf` from Task 5.
- Produces: `<BookReaderModal bookId={string} onClose={() => void} onCompleted={(result: CompleteBookResult) => void} />`.

- [ ] **Step 1: Split the shelf page into server + client parts**

```tsx
// components/shelf/ShelfPageClient.tsx
"use client";
import { useState } from "react";
import type { ShelfView } from "@/lib/insforge/types";
import { BookShelf } from "./BookShelf";
import { BookReaderModal } from "@/components/reader/BookReaderModal";

export function ShelfPageClient({
  shelf,
  itemNamesById,
}: {
  shelf: ShelfView;
  itemNamesById: Map<string, string>;
}) {
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  return (
    <>
      <BookShelf shelf={shelf} itemNamesById={itemNamesById} onOpenBook={setOpenBookId} />
      {openBookId && (
        <BookReaderModal bookId={openBookId} onClose={() => setOpenBookId(null)} />
      )}
    </>
  );
}
```

Update `app/lich-su-viet-nam/page.tsx`'s return to `<ShelfPageClient shelf={shelf} itemNamesById={itemNamesById} />` instead of rendering `<BookShelf>` directly (keep the rest of that file, including the `getShelfWithBooks`/`items` fetch, as a server component).

- [ ] **Step 2: Build PageSpread**

```tsx
// components/reader/PageSpread.tsx
import type { Page } from "@/lib/insforge/types";

export function PageSpread({ page, totalPages }: { page: Page; totalPages: number }) {
  return (
    <div className="flex h-[560px] w-[920px] rounded-lg bg-parchment shadow-2xl">
      <div className="flex w-1/2 flex-col gap-4 border-r border-text-primary/10 p-10">
        <div className="h-[220px] w-full rounded bg-[#E4D5B8]" />
        <p className="font-body text-xs italic text-text-muted">Ảnh minh họa</p>
      </div>
      <div className="flex w-1/2 flex-col gap-3.5 p-10">
        <h2 className="font-heading text-2xl font-bold text-text-primary">Trang {page.page_number} / {totalPages}</h2>
        <p className="font-body text-sm leading-relaxed text-text-primary">{page.content}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build ItemDropOverlay**

```tsx
// components/reader/ItemDropOverlay.tsx
import type { CompleteBookResult } from "@/lib/insforge/types";

export function ItemDropOverlay({ result, onClose }: { result: CompleteBookResult; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 p-10 text-cream">
      {result.grantedItem && !result.alreadyCompleted && (
        <>
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-full bg-[radial-gradient(circle,#E8622C_0%,rgba(232,98,45,0)_70%)] text-5xl">
            🏺
          </div>
          <p className="font-body text-lg font-semibold">Bạn nhận được: {result.grantedItem.name}</p>
        </>
      )}
      {result.nextBook?.unlocked && (
        <p className="font-body text-sm italic text-cream/70">
          {result.nextBook.title} đã sẵn sàng — ổ khóa vừa mở, dây xích rơi xuống
        </p>
      )}
      <button type="button" onClick={onClose} className="rounded-full bg-black/40 px-4 py-2 font-body text-sm">
        Quay lại kệ sách
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Build BookReaderModal — the orchestrator**

```tsx
// components/reader/BookReaderModal.tsx
"use client";
import { useEffect, useState } from "react";
import type { BookDetail, CompleteBookResult } from "@/lib/insforge/types";
import { getBookWithPages, setCurrentPage, completeBook } from "@/lib/insforge/shelf";
import { PageSpread } from "./PageSpread";
import { ItemDropOverlay } from "./ItemDropOverlay";

export function BookReaderModal({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [completion, setCompletion] = useState<CompleteBookResult | null>(null);

  useEffect(() => {
    getBookWithPages(bookId).then((detail) => {
      setBook(detail);
      const startIndex = Math.max(0, Math.min(detail.currentPage - 1, detail.pages.length - 1));
      setPageIndex(startIndex);
    });
  }, [bookId]);

  if (!book) return null;

  const isLastPage = pageIndex === book.pages.length - 1;

  async function goNext() {
    if (!book) return;
    if (isLastPage) {
      const result = await completeBook(bookId);
      setCompletion(result);
      return;
    }
    const next = pageIndex + 1;
    setPageIndex(next);
    await setCurrentPage(bookId, next + 1);
  }

  function goPrev() {
    setPageIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#241209]">
      <div className="flex w-full items-center justify-between px-8 py-5">
        <span className="font-body text-sm text-cream/80">{book.title}</span>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-cream">
          ✕
        </button>
      </div>

      {completion ? (
        <ItemDropOverlay result={completion} onClose={onClose} />
      ) : (
        <>
          <div className="flex flex-1 items-center gap-6">
            <button type="button" onClick={goPrev} disabled={pageIndex === 0} className="h-11 w-11 rounded-full bg-black/20 text-cream disabled:opacity-30">
              ‹
            </button>
            <PageSpread page={book.pages[pageIndex]} totalPages={book.pages.length} />
            <button type="button" onClick={goNext} className="h-11 w-11 rounded-full bg-black/20 text-cream">
              ›
            </button>
          </div>
          <div className="flex h-20 items-center justify-center">
            <div className="rounded-full bg-accent px-5 py-2 font-body text-sm font-semibold text-cream">
              Trang {pageIndex + 1} / {book.pages.length}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Manual run-through (this subsystem's end-to-end check)**

```bash
npm run dev
```

At `http://localhost:3000/lich-su-viet-nam`:
1. Click the unlocked book 1 cover → reader opens on its saved/first page.
2. Click `›` through both pages → on the 2nd click, `completeBook` fires and `ItemDropOverlay` renders with the granted item name and a "next book unlocked" message.
3. Click "Quay lại kệ sách" → modal closes, re-fetch the page (reload) → book 1 now shows the completed stamp and book 2 shows unlocked (needs sign-in for progress to persist — if testing signed-out, `setCurrentPage`/`completeBook` will no-op/error since RLS requires `auth.uid()`; sign in via `insforge.auth.signUp`/`signInWithPassword` in the browser console first, or note this as a follow-up once the Auth subsystem is built).

- [ ] **Step 6: Commit**

```bash
git add components/reader/ components/shelf/ShelfPageClient.tsx app/lich-su-viet-nam/page.tsx
git commit -m "feat: implement book reader with page flip and completion flow"
```
