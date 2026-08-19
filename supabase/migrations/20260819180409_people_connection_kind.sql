-- Lets the graph UI bond partners more tightly than parent/sibling/etc
-- connections without string-matching the free-text `label`.
create type public.connection_kind as enum ('partner', 'family', 'other');

alter table public.people_connections
  add column kind public.connection_kind not null default 'other';
