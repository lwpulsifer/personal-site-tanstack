create type public.post_status as enum ('PENDING', 'PUBLISHED', 'ARCHIVED');

-- ── posts ────────────────────────────────────────────────────────────────────
create table public.posts (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null unique,
  title        text        not null,
  description  text,
  content      text        not null default '',
  tags         text[]      not null default '{}',
  hero_image   text,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  author_id    uuid        references auth.users(id) on delete set null
);

-- Keep updated_at current on every write.
create or replace function public.set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ── post_status_update ──────────────────────────────────────────────────────────
-- Append-only changelog. The latest row for a given post_id is its current
-- status. Never update or delete rows; insert a new one to change status.
create table public.post_status_update (
  id         uuid              primary key default gen_random_uuid(),
  post_id    uuid              not null references public.posts(id) on delete cascade,
  status     public.post_status not null,
  changed_at timestamptz       not null default now(),
  changed_by uuid              references auth.users(id) on delete set null
);

create index post_status_update_post_id_changed_at
  on public.post_status_update (post_id, changed_at desc);

-- ── Convenience view: current status per post ─────────────────────────────────
create view public.post_current_status as
  select distinct on (post_id)
    post_id,
    status,
    changed_at,
    changed_by
  from public.post_status_update
  order by post_id, changed_at desc;

-- ── Row-level security: posts ─────────────────────────────────────────────────
alter table public.posts enable row level security;

-- Public can read posts whose latest status is PUBLISHED.
create policy "public read published"
  on public.posts for select
  using (
    (
      select status from public.post_status_update
      where post_id = id
      order by changed_at desc
      limit 1
    ) = 'PUBLISHED'
  );

-- Admin can do everything.
create policy "admin full access"
  on public.posts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.posts to anon;
grant all    on public.posts to authenticated;
grant all    on public.posts to service_role;

-- ── Row-level security: post_status_update ──────────────────────────────────────
alter table public.post_status_update enable row level security;

-- Public can read status log (needed to evaluate the posts RLS policy above).
create policy "public read status log"
  on public.post_status_update for select
  using (true);

-- Admin can insert (append) new status entries. No update or delete allowed.
create policy "admin insert status"
  on public.post_status_update for insert
  with check (auth.role() = 'authenticated');

grant select on public.post_status_update to anon;
grant select, insert on public.post_status_update to authenticated;
grant all on public.post_status_update to service_role;

grant select on public.post_current_status to anon;
grant select on public.post_current_status to authenticated;
grant select on public.post_current_status to service_role;
