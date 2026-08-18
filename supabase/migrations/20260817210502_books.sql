create type public.book_status as enum ('WANT_TO_READ', 'READING', 'READ');

-- ── books ────────────────────────────────────────────────────────────────────
-- Single-owner reading log. No moderation workflow (unlike posts) — status is
-- a plain column, always public once entered.
create table public.books (
  id           uuid          primary key default gen_random_uuid(),
  title        text          not null,
  author       text          not null,
  isbn         text,
  cover_url    text,
  status       public.book_status not null default 'WANT_TO_READ',
  rating       smallint      check (rating between 1 and 5),
  review       text,
  started_at   date,
  finished_at  date,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.books enable row level security;

create policy "public read books"
  on public.books for select
  using (true);

create policy "admin full access"
  on public.books for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.books to anon;
grant all    on public.books to authenticated;
grant all    on public.books to service_role;
