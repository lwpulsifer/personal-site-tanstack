-- ── feeds ──────────────────────────────────────────────────────────────────
-- Admin-managed list of RSS/Atom feed subscriptions.
create table public.feeds (
  id              uuid        primary key default gen_random_uuid(),
  url             text        not null unique,
  title           text,
  site_url        text,
  description     text,
  last_fetched_at timestamptz,
  last_error      text,
  created_at      timestamptz not null default now()
);

alter table public.feeds enable row level security;

create policy "public read feeds"
  on public.feeds for select using (true);

create policy "authenticated full access feeds"
  on public.feeds for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.feeds to anon;
grant all    on public.feeds to authenticated;
grant all    on public.feeds to service_role;

-- ── feed_items ─────────────────────────────────────────────────────────────
-- Cached items pulled from each feed. Uniqueness is (feed_id, guid) so
-- repeat fetches upsert without duplicating.
create table public.feed_items (
  id           uuid        primary key default gen_random_uuid(),
  feed_id      uuid        not null references public.feeds(id) on delete cascade,
  guid         text        not null,
  title        text        not null,
  link         text,
  description  text,
  author       text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (feed_id, guid)
);

create index feed_items_published_at
  on public.feed_items (published_at desc nulls last);

alter table public.feed_items enable row level security;

create policy "public read feed_items"
  on public.feed_items for select using (true);

create policy "authenticated full access feed_items"
  on public.feed_items for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.feed_items to anon;
grant all    on public.feed_items to authenticated;
grant all    on public.feed_items to service_role;
