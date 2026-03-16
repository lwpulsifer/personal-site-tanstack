-- ── map_locations ──────────────────────────────────────────────────────────
create table public.map_locations (
  id          uuid             primary key default gen_random_uuid(),
  map_slug    text             not null,
  name        text             not null,
  description text,
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz      not null default now(),
  updated_at  timestamptz      not null default now(),
  created_by  uuid             references auth.users(id) on delete set null
);

create index map_locations_map_slug on public.map_locations (map_slug);

create trigger map_locations_set_updated_at
  before update on public.map_locations
  for each row execute function public.set_updated_at();

alter table public.map_locations enable row level security;

create policy "public read map_locations"
  on public.map_locations for select using (true);

create policy "authenticated full access map_locations"
  on public.map_locations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.map_locations to anon;
grant all    on public.map_locations to authenticated;
grant all    on public.map_locations to service_role;

-- ── map_submission_status enum ────────────────────────────────────────────
create type public.map_submission_status as enum ('pending', 'approved', 'rejected');

-- ── map_submissions ───────────────────────────────────────────────────────
create table public.map_submissions (
  id               uuid                        primary key default gen_random_uuid(),
  map_slug         text                        not null,
  location_id      uuid                        references public.map_locations(id) on delete set null,
  proposed_name    text,
  proposed_lat     double precision,
  proposed_lng     double precision,
  proposed_address text,
  notes            text,
  submitter_name   text,
  submitter_email  text,
  status           public.map_submission_status not null default 'pending',
  reviewed_at      timestamptz,
  reviewed_by      uuid                        references auth.users(id) on delete set null,
  created_at       timestamptz                 not null default now()
);

create index map_submissions_map_slug on public.map_submissions (map_slug);

alter table public.map_submissions enable row level security;

create policy "anon insert map_submissions"
  on public.map_submissions for insert
  with check (true);

create policy "anon read approved map_submissions"
  on public.map_submissions for select
  using (status = 'approved');

create policy "authenticated full access map_submissions"
  on public.map_submissions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select, insert on public.map_submissions to anon;
grant all            on public.map_submissions to authenticated;
grant all            on public.map_submissions to service_role;

-- ── map_photos ────────────────────────────────────────────────────────────
create table public.map_photos (
  id            uuid             primary key default gen_random_uuid(),
  location_id   uuid             not null references public.map_locations(id) on delete cascade,
  submission_id uuid             references public.map_submissions(id) on delete set null,
  storage_path  text             not null,
  caption       text,
  exif_lat      double precision,
  exif_lng      double precision,
  created_at    timestamptz      not null default now()
);

alter table public.map_photos enable row level security;

create policy "public read map_photos"
  on public.map_photos for select using (true);

create policy "authenticated full access map_photos"
  on public.map_photos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "anon insert map_photos"
  on public.map_photos for insert
  with check (true);

grant select, insert on public.map_photos to anon;
grant all            on public.map_photos to authenticated;
grant all            on public.map_photos to service_role;

-- ── Storage bucket ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'map-photos',
  'map-photos',
  true,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "public read map-photos"
  on storage.objects for select
  using (bucket_id = 'map-photos');

create policy "anon upload map-photos"
  on storage.objects for insert
  with check (bucket_id = 'map-photos');

create policy "authenticated delete map-photos"
  on storage.objects for delete
  using (bucket_id = 'map-photos' and auth.role() = 'authenticated');
