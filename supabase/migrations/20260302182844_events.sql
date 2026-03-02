create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  date date not null,
  types text[] not null default '{}',
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table events enable row level security;
create policy "owner only" on events
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger set_events_updated_at
  before update on events
  for each row execute function public.set_updated_at();
