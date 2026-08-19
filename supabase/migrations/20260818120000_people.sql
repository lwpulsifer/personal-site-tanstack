-- ── people / people_connections ─────────────────────────────────────────────
-- Private social graph, admin-only end to end (no public read, unlike books).
create table public.people (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now()
);

create table public.people_connections (
  id           uuid        primary key default gen_random_uuid(),
  person_a_id  uuid        not null references public.people(id) on delete cascade,
  person_b_id  uuid        not null references public.people(id) on delete cascade,
  label        text,
  created_at   timestamptz not null default now(),
  constraint people_connections_no_self_loop check (person_a_id <> person_b_id)
);

create index people_connections_person_a_id_idx on public.people_connections(person_a_id);
create index people_connections_person_b_id_idx on public.people_connections(person_b_id);

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.people enable row level security;
alter table public.people_connections enable row level security;

create policy "admin full access"
  on public.people for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "admin full access"
  on public.people_connections for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

grant all on public.people to authenticated;
grant all on public.people to service_role;
grant all on public.people_connections to authenticated;
grant all on public.people_connections to service_role;
