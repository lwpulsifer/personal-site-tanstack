import type { ConnectionKind } from '#/server/people'

export const CONNECTION_KIND_OPTIONS: {
  value: ConnectionKind
  label: string
}[] = [
  { value: 'other', label: 'Other' },
  { value: 'family', label: 'Family' },
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
