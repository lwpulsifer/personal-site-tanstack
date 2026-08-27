-- people_connections had no uniqueness constraint, so the same
-- (person_a_id, person_b_id, kind) triple could be inserted more than once —
-- e.g. the same parent/child pair entered twice, which could make tools
-- like the sibling-suggestions panel pair a person against themselves.
--
-- Remove any exact-duplicate rows first (keeping the earliest one per
-- group), so the constraint below can be added even if duplicates already
-- slipped in before this fix existed.
delete from public.people_connections
where id in (
  select id from (
    select
      id,
      row_number() over (
        partition by person_a_id, person_b_id, kind
        order by created_at, id
      ) as rn
    from public.people_connections
  ) ranked
  where rn > 1
);

-- Scoped to the stored column order + kind only — it deliberately doesn't
-- canonicalize (person_a_id, person_b_id) order, since reversing them is a
-- meaningful semantic difference for 'parent_child' (parent vs child), not
-- just a duplicate. Symmetric kinds (partner, family, sibling, friend,
-- coworker, other) could in principle still be duplicated in reversed
-- order; that's a separate concern from the exact-duplicate-row bug this
-- fixes.
alter table public.people_connections
  add constraint people_connections_unique_pair_kind
  unique (person_a_id, person_b_id, kind);
