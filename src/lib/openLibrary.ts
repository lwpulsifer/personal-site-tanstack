// Strips whitespace/dashes so both "978-0-593-13520-4" and "9780593135204"
// resolve to the same lookup key.
export function normalizeIsbn(raw: string) {
  return raw.replace(/[-\s]/g, '').toUpperCase()
}

// ISBN-10 (last check digit may be "X") or ISBN-13 — anything else isn't
// worth pulling a cover for.
export function isLookupableIsbn(isbn: string) {
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn)
}

// `default=false` makes Open Library 404 instead of returning its generic
// "no cover" placeholder image, so callers can fall back on their own icon.
export function getOpenLibraryCoverUrl(isbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(normalizeIsbn(isbn))}-L.jpg?default=false`
}

// For results (e.g. from the title search API) that carry a cover id but no
// ISBN to derive a cover URL from.
export function getOpenLibraryCoverUrlById(coverId: number) {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
}
