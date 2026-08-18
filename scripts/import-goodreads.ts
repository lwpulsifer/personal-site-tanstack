/**
 * Imports a Goodreads library export CSV into the Supabase `books` table.
 *
 * Get the CSV from: goodreads.com/review/import -> "Export Library"
 * (Goodreads emails a download link once it's ready.)
 *
 * Usage:
 *   npm run script scripts/import-goodreads.ts -- path/to/goodreads_library_export.csv [--dry-run]
 *
 * Requires SUPABASE_URL and SUPABASE_KEY (service-role key, bypasses RLS) in
 * .env.local. Safe to re-run: matches existing rows by ISBN, falling back to
 * title+author, and updates them instead of creating duplicates.
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_KEY (service-role key) in .env.local before running.')
  process.exit(1)
}

const [csvPath, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')

if (!csvPath) {
  console.error('Usage: npm run script scripts/import-goodreads.ts -- path/to/export.csv [--dry-run]')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

type BookStatus = 'WANT_TO_READ' | 'READING' | 'READ'

type GoodreadsRow = Record<string, string>

type ImportedBook = {
  title: string
  author: string
  isbn: string | null
  status: BookStatus
  rating: number | null
  review: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
  cover_url: string | null
}

const SHELF_TO_STATUS: Record<string, BookStatus> = {
  read: 'READ',
  'currently-reading': 'READING',
  'to-read': 'WANT_TO_READ',
}

// Goodreads wraps ISBNs as ="1234567890" (an Excel formula, to preserve
// leading zeros) — strip that and keep only digits/X.
function cleanIsbn(raw: string | undefined): string | null {
  if (!raw) return null
  const stripped = raw.replace(/^="?/, '').replace(/"$/, '').trim()
  const digits = stripped.replace(/[^0-9X]/gi, '')
  return digits.length >= 10 ? digits : null
}

// Goodreads dates are "YYYY/MM/DD" — normalize to "YYYY-MM-DD".
function cleanDate(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.replace(/\//g, '-')
}

function cleanReview(raw: string | undefined): string | null {
  if (!raw) return null
  const text = raw.replace(/<br\s*\/?>/gi, '\n').trim()
  return text || null
}

function parseRow(row: GoodreadsRow): ImportedBook | null {
  const title = row.Title?.trim()
  const author = row.Author?.trim()
  if (!title || !author) return null

  const shelf = row['Exclusive Shelf']?.trim().toLowerCase()
  const status = SHELF_TO_STATUS[shelf ?? ''] ?? 'WANT_TO_READ'
  if (shelf && !SHELF_TO_STATUS[shelf]) {
    console.warn(`  ⚠ Unrecognized shelf "${shelf}" for "${title}" — defaulting to WANT_TO_READ.`)
  }

  const isbn = cleanIsbn(row.ISBN13) ?? cleanIsbn(row.ISBN)
  const ratingRaw = Number.parseInt(row['My Rating'] ?? '0', 10)
  const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null
  const dateAdded = cleanDate(row['Date Added'])
  const dateRead = cleanDate(row['Date Read'])

  return {
    title,
    author,
    isbn,
    status,
    rating,
    review: cleanReview(row['My Review']),
    // Goodreads doesn't track a "date started" — approximate it with when
    // the book was added, for books that have progressed past want-to-read.
    started_at: status !== 'WANT_TO_READ' ? dateAdded : null,
    finished_at: status === 'READ' ? dateRead : null,
    created_at: dateAdded ? new Date(dateAdded).toISOString() : null,
    cover_url: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : null,
  }
}

function matchKey(b: { isbn: string | null; title: string; author: string }) {
  return b.isbn ?? `${b.title.toLowerCase()}::${b.author.toLowerCase()}`
}

// created_at is NOT NULL with a default — send `undefined` (dropped by
// JSON.stringify) rather than `null` when we don't have a Date Added to
// preserve, so the column's own default (now()) applies instead of erroring.
function toRow(book: ImportedBook) {
  return { ...book, created_at: book.created_at ?? undefined }
}

async function main() {
  const csv = readFileSync(csvPath, 'utf-8')
  // relax_quotes: Goodreads wraps ISBNs as ="1234567890" — an unquoted field
  // containing a literal `"`, which a strict RFC4180 parser rejects.
  const rows: GoodreadsRow[] = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true })
  console.log(`Parsed ${rows.length} rows from ${csvPath}`)

  const books = rows.map(parseRow).filter((b): b is ImportedBook => b !== null)
  console.log(`${books.length} valid books to import (${rows.length - books.length} skipped — missing title/author)`)

  const { data: existing, error: fetchError } = await supabase
    .from('books')
    .select('id, isbn, title, author')
  if (fetchError) {
    console.error('Failed to fetch existing books:', fetchError.message)
    process.exit(1)
  }

  const existingByKey = new Map((existing ?? []).map((b) => [matchKey(b), b.id]))

  const toInsert: ImportedBook[] = []
  const toUpdate: { id: string; book: ImportedBook }[] = []
  for (const book of books) {
    const existingId = existingByKey.get(matchKey(book))
    if (existingId) {
      toUpdate.push({ id: existingId, book })
    } else {
      toInsert.push(book)
    }
  }

  console.log(`  → ${toInsert.length} new, ${toUpdate.length} matched to existing rows (will update)`)

  if (dryRun) {
    console.log('\n--dry-run set — no changes written. Sample of what would happen:')
    for (const b of toInsert.slice(0, 5)) {
      console.log(`  + INSERT "${b.title}" by ${b.author} [${b.status}]`)
    }
    for (const { book: b } of toUpdate.slice(0, 5)) {
      console.log(`  ~ UPDATE "${b.title}" by ${b.author} [${b.status}]`)
    }
    return
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from('books').insert(toInsert.map(toRow))
    if (error) {
      console.error('Insert failed:', error.message)
      process.exit(1)
    }
  }

  for (const { id, book } of toUpdate) {
    const { error } = await supabase.from('books').update(toRow(book)).eq('id', id)
    if (error) {
      console.error(`Update failed for "${book.title}":`, error.message)
    }
  }

  console.log(`\nDone. Inserted ${toInsert.length}, updated ${toUpdate.length}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
