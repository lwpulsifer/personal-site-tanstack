-- ── quizzes ──────────────────────────────────────────────────────────────────
-- Keyword-gated "rank these things" quizzes. A visitor enters a keyword, then
-- answers head-to-head comparisons until the items are totally ordered. The
-- main use case is ranking gift ideas without revealing what they are, so
-- each item has a `secret_label` that is admin-only and never sent to
-- visitors — they only see `description` and `image_url`.
--
-- All public access goes through server functions using the service-role
-- client, so there are deliberately NO anon policies on these tables: the
-- keyword is the only way in, and it's checked server-side.
create table public.quizzes (
  id           uuid         primary key default gen_random_uuid(),
  keyword      text         not null unique
                            check (keyword = lower(btrim(keyword)) and length(keyword) > 0),
  title        text         not null,
  description  text,
  is_open      boolean      not null default true,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

create table public.quiz_items (
  id            uuid         primary key default gen_random_uuid(),
  quiz_id       uuid         not null references public.quizzes (id) on delete cascade,
  secret_label  text,
  description   text,
  image_url     text,
  position      integer      not null default 0,
  created_at    timestamptz  not null default now()
);

create index quiz_items_quiz_id_idx on public.quiz_items (quiz_id, position);

-- One row per completed run-through. `ordering` is item ids, most preferred
-- first. It's a plain uuid[] (no FK) so responses survive later item edits;
-- the UI shows ids that no longer resolve as "(deleted item)".
create table public.quiz_responses (
  id               uuid         primary key default gen_random_uuid(),
  quiz_id          uuid         not null references public.quizzes (id) on delete cascade,
  respondent_name  text,
  ordering         uuid[]       not null,
  comparisons      jsonb        not null default '[]'::jsonb,
  completed_at     timestamptz  not null default now()
);

create index quiz_responses_quiz_id_idx on public.quiz_responses (quiz_id, completed_at desc);

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.quizzes        enable row level security;
alter table public.quiz_items     enable row level security;
alter table public.quiz_responses enable row level security;

create policy "admin full access" on public.quizzes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.quiz_items for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin full access" on public.quiz_responses for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

grant all on public.quizzes        to authenticated, service_role;
grant all on public.quiz_items     to authenticated, service_role;
grant all on public.quiz_responses to authenticated, service_role;

-- ── Storage bucket for item pictures ───────────────────────────────────────
-- Public read (object paths are random uuids, so unguessable), admin-only
-- upload/delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-images',
  'quiz-images',
  true,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "public read quiz-images"
  on storage.objects for select
  using (bucket_id = 'quiz-images');

create policy "authenticated upload quiz-images"
  on storage.objects for insert
  with check (bucket_id = 'quiz-images' and auth.role() = 'authenticated');

create policy "authenticated delete quiz-images"
  on storage.objects for delete
  using (bucket_id = 'quiz-images' and auth.role() = 'authenticated');
