-- ── lion_locations ─────────────────────────────────────────────────────────
create table public.lion_locations (
  id          uuid             primary key default gen_random_uuid(),
  name        text             not null,
  description text,
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz      not null default now(),
  updated_at  timestamptz      not null default now(),
  created_by  uuid             references auth.users(id) on delete set null
);

create trigger lion_locations_set_updated_at
  before update on public.lion_locations
  for each row execute function public.set_updated_at();

alter table public.lion_locations enable row level security;

create policy "public read lion_locations"
  on public.lion_locations for select using (true);

create policy "authenticated full access lion_locations"
  on public.lion_locations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select on public.lion_locations to anon;
grant all    on public.lion_locations to authenticated;
grant all    on public.lion_locations to service_role;

-- ── lion_submission_status enum ───────────────────────────────────────────
create type public.lion_submission_status as enum ('pending', 'approved', 'rejected');

-- ── lion_submissions ──────────────────────────────────────────────────────
create table public.lion_submissions (
  id               uuid                        primary key default gen_random_uuid(),
  location_id      uuid                        references public.lion_locations(id) on delete set null,
  proposed_name    text,
  proposed_lat     double precision,
  proposed_lng     double precision,
  proposed_address text,
  notes            text,
  submitter_name   text,
  submitter_email  text,
  status           public.lion_submission_status not null default 'pending',
  reviewed_at      timestamptz,
  reviewed_by      uuid                        references auth.users(id) on delete set null,
  created_at       timestamptz                 not null default now()
);

alter table public.lion_submissions enable row level security;

-- Anyone can create a submission
create policy "anon insert lion_submissions"
  on public.lion_submissions for insert
  with check (true);

-- Anyone can see approved submissions
create policy "anon read approved lion_submissions"
  on public.lion_submissions for select
  using (status = 'approved');

-- Authenticated users can do everything
create policy "authenticated full access lion_submissions"
  on public.lion_submissions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant select, insert on public.lion_submissions to anon;
grant all            on public.lion_submissions to authenticated;
grant all            on public.lion_submissions to service_role;

-- ── lion_photos ───────────────────────────────────────────────────────────
create table public.lion_photos (
  id            uuid             primary key default gen_random_uuid(),
  location_id   uuid             not null references public.lion_locations(id) on delete cascade,
  submission_id uuid             references public.lion_submissions(id) on delete set null,
  storage_path  text             not null,
  caption       text,
  exif_lat      double precision,
  exif_lng      double precision,
  created_at    timestamptz      not null default now()
);

alter table public.lion_photos enable row level security;

create policy "public read lion_photos"
  on public.lion_photos for select using (true);

create policy "authenticated full access lion_photos"
  on public.lion_photos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Allow anon to insert photos (for submissions)
create policy "anon insert lion_photos"
  on public.lion_photos for insert
  with check (true);

grant select, insert on public.lion_photos to anon;
grant all            on public.lion_photos to authenticated;
grant all            on public.lion_photos to service_role;

-- ── Storage bucket ────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lion-photos',
  'lion-photos',
  true,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Public read access for lion-photos bucket
create policy "public read lion-photos"
  on storage.objects for select
  using (bucket_id = 'lion-photos');

-- Anyone can upload to lion-photos bucket
create policy "anon upload lion-photos"
  on storage.objects for insert
  with check (bucket_id = 'lion-photos');

-- Authenticated users can delete from lion-photos bucket
create policy "authenticated delete lion-photos"
  on storage.objects for delete
  using (bucket_id = 'lion-photos' and auth.role() = 'authenticated');
