-- ── friends ──────────────────────────────────────────────────────────────────
create table public.friends (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  name              text        not null,
  tag               text        not null default 'friend',
  frequency_days    integer     not null default 7,
  last_contacted_at timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index friends_user_id on public.friends(user_id);

create trigger friends_set_updated_at
  before update on public.friends
  for each row execute function public.set_updated_at();

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.friends enable row level security;

create policy "users manage own friends"
  on public.friends for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on public.friends to authenticated;
grant all on public.friends to service_role;
