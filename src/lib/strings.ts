/** Convert a string to a kebab-case test ID segment. */
export function toTestIdPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
