import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { z } from 'zod'
import type { Enums, Tables, TablesUpdate } from '#/lib/database.types'

export type BookStatus = Enums<'book_status'>

export type DbBook = Tables<'books'>

const UpsertBookSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  author: z.string(),
  isbn: z.string().optional(),
  cover_url: z.string().optional(),
  status: z.enum(['WANT_TO_READ', 'READING', 'READ']),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
})

function sortKey(book: Pick<DbBook, 'finished_at' | 'started_at' | 'created_at'>) {
  return book.finished_at ?? book.started_at ?? book.created_at
}

// ── Public ───────────────────────────────────────────────────────────────────
// No draft/pending state — every row is public as soon as it's saved, so this
// same query also backs the admin view.

export const getBooks = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.from('books').select('*')
  if (error) throw new Error(error.message)
  const books = (data ?? []) as DbBook[]
  return books.sort(
    (a, b) => new Date(sortKey(b)).valueOf() - new Date(sortKey(a)).valueOf(),
  )
})

// ── Admin ────────────────────────────────────────────────────────────────────

export const upsertBook = createServerFn({ method: 'POST' })
  .inputValidator(UpsertBookSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: book, error } = await supabase
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
    return book as DbBook
  })

export const setBookStatus = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ bookId: z.string(), status: z.enum(['WANT_TO_READ', 'READING', 'READ']) }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const today = new Date().toISOString().slice(0, 10)

    const update: TablesUpdate<'books'> = { status: data.status }
    if (data.status === 'READING') {
      const { data: existing } = await supabase
        .from('books')
        .select('started_at')
        .eq('id', data.bookId)
        .single()
      if (!existing?.started_at) update.started_at = today
    }
    if (data.status === 'READ') {
      const { data: existing } = await supabase
        .from('books')
        .select('finished_at')
        .eq('id', data.bookId)
        .single()
      if (!existing?.finished_at) update.finished_at = today
    }

    const { data: book, error } = await supabase
      .from('books')
      .update(update)
      .eq('id', data.bookId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return book as DbBook
  })

export const deleteBook = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ bookId: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase.from('books').delete().eq('id', data.bookId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
