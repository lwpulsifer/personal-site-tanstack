-- `kind` is now the core relationship fact (see connection_kind migration);
-- `label` becomes an optional ancillary comment on top of it.
alter table public.people_connections
  alter column label drop not null;
