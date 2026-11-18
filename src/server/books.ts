import { query } from '@solidjs/router'
import { respond } from '@solidjs/web'
import { z } from 'zod'
import type { Enums, Tables, TablesUpdate } from '../lib/database.types'
import { parse } from './validate'

export type BookStatus = Enums<'book_status'>
export type DbBook = Tables<'books'>

const BookStatusSchema = z.enum(['WANT_TO_READ', 'READING', 'READ'])

const UpsertBookSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  author: z.string(),
  isbn: z.string().optional(),
  cover_url: z.string().optional(),
  status: BookStatusSchema,
  // Half-star increments only, to match the `books_rating_check` DB constraint.
  rating: z
    .number()
    .min(1)
    .max(5)
    .refine((n) => n * 2 === Math.round(n * 2), 'Rating must be in half-star increments')
    .optional(),
  review: z.string().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
})
export type UpsertBookInput = z.infer<typeof UpsertBookSchema>

const sortKey = (b: Pick<DbBook, 'finished_at' | 'started_at' | 'created_at'>) =>
  b.finished_at ?? b.started_at ?? b.created_at

// Mutations name the query keys they touched (prefix-matched).
const BOOK_KEYS = ['books', 'book']

// ── Public ───────────────────────────────────────────────────────────────────
// No draft/pending state — every row is public as soon as it's saved, so this
// same query also backs the admin view.

export const getBooks = query(async () => {
  'use server'
  const { getSupabaseServiceClient } = await import('./supabase')
  const { data, error } = await getSupabaseServiceClient().from('books').select('*')
  if (error) throw new Error(error.message)
  return ((data ?? []) as DbBook[]).sort(
    (a, b) => new Date(sortKey(b)).valueOf() - new Date(sortKey(a)).valueOf(),
  )
}, 'books')

export const getBook = query(async (bookId: string) => {
  'use server'
  bookId = parse(z.string(), bookId)
  const { getSupabaseServiceClient } = await import('./supabase')
  const { data: book, error } = await getSupabaseServiceClient()
    .from('books')
    .select('*')
    .eq('id', bookId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return book as DbBook | null
}, 'book')

// ── Admin ────────────────────────────────────────────────────────────────────

export async function upsertBook(input: UpsertBookInput) {
  'use server'
  const data = parse(UpsertBookSchema, input)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { data: book, error } = await getSupabaseServiceClient()
    .from('books')
    .upsert({
      ...(data.id ? { id: data.id } : {}),
      title: data.title,
      author: data.author,
      isbn: data.isbn ?? null,
      cover_url: data.cover_url ?? null,
      status: data.status,
      rating: data.rating ?? null,
      review: data.review ?? null,
      started_at: data.started_at ?? null,
      finished_at: data.finished_at ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return respond(book as DbBook, { revalidate: BOOK_KEYS })
}

export async function setBookStatus(bookId: string, status: BookStatus) {
  'use server'
  bookId = parse(z.string(), bookId)
  parse(BookStatusSchema, status)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const supabase = getSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const update: TablesUpdate<'books'> = { status }
  if (status === 'READING') {
    const { data: existing } = await supabase
      .from('books')
      .select('started_at')
      .eq('id', bookId)
      .single()
    if (!existing?.started_at) update.started_at = today
  }
  if (status === 'READ') {
    const { data: existing } = await supabase
      .from('books')
      .select('finished_at')
      .eq('id', bookId)
      .single()
    if (!existing?.finished_at) update.finished_at = today
  }

  const { data: book, error } = await supabase
    .from('books')
    .update(update)
    .eq('id', bookId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return respond(book as DbBook, { revalidate: BOOK_KEYS })
}

export async function deleteBook(bookId: string) {
  'use server'
  bookId = parse(z.string(), bookId)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { error } = await getSupabaseServiceClient().from('books').delete().eq('id', bookId)
  if (error) throw new Error(error.message)
  return respond({ ok: true }, { revalidate: BOOK_KEYS })
}
