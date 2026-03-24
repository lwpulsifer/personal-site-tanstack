/** Convert a string to a kebab-case test ID segment. */
export function toTestIdPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const BAD_WORDS = [
  'ass', 'asshole', 'bastard', 'bitch', 'bollocks', 'cock', 'crap', 'cunt',
  'damn', 'dick', 'douche', 'fag', 'fuck', 'goddamn', 'hell', 'jerk',
  'nigger', 'piss', 'prick', 'pussy', 'shit', 'slut', 'twat', 'whore',
]

const badWordPattern = new RegExp(
  `\\b(${BAD_WORDS.join('|')})\\b`,
  'gi',
)

/** Replace bad words in a name with asterisks. Returns null unchanged. */
export function censorName(name: string | null): string | null {
  if (!name) return null
  return name.replace(badWordPattern, (match) => '*'.repeat(match.length))
}
