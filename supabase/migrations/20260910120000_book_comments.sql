-- ── book_comments ────────────────────────────────────────────────────────────
-- Moderated, account-free comments on book pages. New comments start pending
-- and are hidden from everyone except the author (via commenter_token, a
-- random id stashed in a cookie) and the admin, until approved.
create type public.comment_status as enum ('pending', 'approved');

create table public.book_comments (
  id              uuid          primary key default gen_random_uuid(),
  book_id         uuid          not null references public.books(id) on delete cascade,
  author_name     text          not null,
  body            text          not null,
  status          public.comment_status not null default 'pending',
  commenter_token uuid          not null,
  created_at      timestamptz   not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid          references auth.users(id) on delete set null
);

create index book_comments_book_id_created_at
  on public.book_comments (book_id, created_at);

-- Speeds up the admin "pending comments" query/badge.
create index book_comments_pending
  on public.book_comments (created_at)
  where status = 'pending';

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.book_comments enable row level security;

create policy "anon insert book_comments"
  on public.book_comments for insert
  with check (true);

create policy "anon read approved book_comments"
  on public.book_comments for select
  using (status = 'approved');

create policy "admin full access"
  on public.book_comments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select, insert on public.book_comments to anon;
grant all             on public.book_comments to authenticated;
grant all             on public.book_comments to service_role;
