-- ── map_events (sightings) ──────────────────────────────────────────────────
-- Stores time-stamped events at a location. Used for "sightings" and any other
-- chronological activity tied to a map location.

create table public.map_events (
  id            uuid        primary key default gen_random_uuid(),
  map_slug      text        not null,
  location_id   uuid        not null references public.map_locations(id) on delete cascade,
  occurred_at   timestamptz not null,
  time_zone     text        not null default 'America/Los_Angeles',
  notes         text,
  submitter_name  text,
  submitter_email text,
  created_by    uuid        references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index map_events_map_slug on public.map_events (map_slug);
create index map_events_location_id on public.map_events (location_id);
create index map_events_occurred_at on public.map_events (occurred_at);

alter table public.map_events enable row level security;

create policy "public read map_events"
  on public.map_events for select using (true);

create policy "authenticated full access map_events"
  on public.map_events for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.map_events to anon;
grant all    on public.map_events to authenticated;
grant all    on public.map_events to service_role;

-- ── map_submissions: add occurred_at + time_zone ────────────────────────────
alter table public.map_submissions
  add column if not exists occurred_at timestamptz,
  add column if not exists time_zone text;

-- ── map_photos: link to event + store taken time ────────────────────────────
alter table public.map_photos
  add column if not exists event_id uuid references public.map_events(id) on delete set null,
  add column if not exists taken_at timestamptz,
  add column if not exists time_zone text;

create index if not exists map_photos_event_id on public.map_photos (event_id);

