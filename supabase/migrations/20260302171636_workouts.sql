-- ── workout_templates — recurrence rules ────────────────────────────────────
create table public.workout_templates (
  id                       uuid        primary key default gen_random_uuid(),
  user_id                  uuid        references auth.users not null,
  title                    text        not null,
  type                     text        not null,
  custom_type              text,
  recurrence               text        not null default 'none',
  recurrence_days          int[],
  recurrence_interval_days int,
  duration_minutes         int,
  notes                    text,
  start_date               date        not null,
  end_date                 date,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.workout_templates enable row level security;

create policy "owner only" on public.workout_templates
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── workout_instances — concrete scheduled events ────────────────────────────
create table public.workout_instances (
  id                 uuid        primary key default gen_random_uuid(),
  template_id        uuid        references public.workout_templates(id) on delete set null,
  user_id            uuid        references auth.users not null,
  title              text        not null,
  type               text        not null,
  custom_type        text,
  scheduled_date     date        not null,
  duration_minutes   int,
  notes              text,
  completed          boolean     not null default false,
  completed_at       timestamptz,
  strava_activity_id bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.workout_instances enable row level security;

create policy "owner only" on public.workout_instances
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Keep updated_at current on every write (reuses set_updated_at() from posts migration)
create trigger set_workout_templates_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();

create trigger set_workout_instances_updated_at
  before update on public.workout_instances
  for each row execute function public.set_updated_at();
