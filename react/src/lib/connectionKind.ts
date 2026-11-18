import type { ConnectionKind } from '#/server/people'

// people_connections has no direction column — connections are stored as an
// unordered (person_a_id, person_b_id) pair for every kind except
// 'parent_child', where person_a_id is the parent and person_b_id is the
// child by convention (enforced by the UI, not the database). Relation
// queries (see SearchPanel.tsx) rely on this to walk the family tree.

export const CONNECTION_KIND_OPTIONS: {
  value: ConnectionKind
  label: string
}[] = [
  { value: 'other', label: 'Other' },
  { value: 'family', label: 'Family' },
  { value: 'parent_child', label: 'Parent-Child' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'partner', label: 'Partner' },
]

export const CONNECTION_KIND_LABELS = Object.fromEntries(
  CONNECTION_KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ConnectionKind, string>

// The kind is the core relationship fact; the free-text label (if present)
// is an ancillary comment on top of it — e.g. "Partner" vs "Partner (eloped 2019)".
export function connectionDisplayText(
  kind: ConnectionKind,
  label: string | null,
) {
  const kindLabel = CONNECTION_KIND_LABELS[kind]
  return label?.trim() ? `${kindLabel} (${label.trim()})` : kindLabel
}
