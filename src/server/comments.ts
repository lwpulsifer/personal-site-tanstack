import { createServerFn } from '@tanstack/react-start'
import {
  getCookie,
  getRequestIP,
  setCookie,
} from '@tanstack/react-start/server'
import { z } from 'zod'
import type { Tables } from '#/lib/database.types'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { getAuthUser, requireAuth } from '#/server/auth.server'
import { checkRateLimit } from '#/server/rate-limit'

export type DbComment = Tables<'book_comments'>

// Public shape — never leaks commenter_token, which is what lets a browser
// recognize its own pending comment.
export type BookComment = Omit<DbComment, 'commenter_token'> & {
  isOwn: boolean
}

const COMMENTER_COOKIE = 'book_commenter'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function getOrCreateCommenterToken(): string {
  const existing = getCookie(COMMENTER_COOKIE)
  if (existing) return existing
  const token = crypto.randomUUID()
  setCookie(COMMENTER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return token
}

// ── Public ───────────────────────────────────────────────────────────────────

export const getBookComments = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ bookId: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServiceClient()
    const commenterToken = getCookie(COMMENTER_COOKIE) ?? null
    const user = await getAuthUser()
    const isAdmin = !!user

    const { data: comments, error } = await supabase
      .from('book_comments')
      .select('*')
      .eq('book_id', data.bookId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)

    return ((comments ?? []) as DbComment[])
      .filter(
        (c) =>
          c.status === 'approved' ||
          isAdmin ||
          (commenterToken !== null && c.commenter_token === commenterToken),
      )
      .map(
        ({ commenter_token, ...rest }): BookComment => ({
          ...rest,
          isOwn: commenter_token === commenterToken,
        }),
      )
  })

const AddCommentSchema = z.object({
  bookId: z.string(),
  authorName: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(2000),
  // Honeypot — real visitors never see or fill this field.
  website: z.string().optional(),
})

export const addComment = createServerFn({ method: 'POST' })
  .inputValidator(AddCommentSchema)
  .handler(async ({ data }) => {
    // Bots that fill the honeypot get a fake success — nothing is stored, and
    // nothing tips them off that they were caught.
    if (data.website) {
      const fakeComment: BookComment = {
        id: crypto.randomUUID(),
        book_id: data.bookId,
        author_name: data.authorName,
        body: data.body,
        status: 'pending',
        created_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        isOwn: true,
      }
      return fakeComment
    }

    const ip = getRequestIP({ xForwardedFor: true }) ?? 'unknown'
    const { allowed } = checkRateLimit(`comment:${ip}`)
    if (!allowed) {
      throw new Error('You are commenting too quickly. Please wait a moment.')
    }

    const commenterToken = getOrCreateCommenterToken()
    const supabase = getSupabaseServiceClient()
    const { data: comment, error } = await supabase
      .from('book_comments')
      .insert({
        book_id: data.bookId,
        author_name: data.authorName,
        body: data.body,
        commenter_token: commenterToken,
        status: 'pending',
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    const { commenter_token, ...rest } = comment as DbComment
    const created: BookComment = { ...rest, isOwn: true }
    return created
  })

// ── Admin ────────────────────────────────────────────────────────────────────

export type PendingComment = BookComment & {
  book: { id: string; title: string }
}

export const getPendingComments = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: comments, error } = await supabase
      .from('book_comments')
      .select('*, books(id, title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)

    return (
      (comments ?? []) as (DbComment & {
        books: { id: string; title: string } | null
      })[]
    ).map(
      ({ commenter_token, books, ...rest }): PendingComment => ({
        ...rest,
        isOwn: false,
        book: books ?? { id: rest.book_id, title: 'Unknown book' },
      }),
    )
  },
)

export const approveComment = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ commentId: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('book_comments')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', data.commentId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const rejectComment = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ commentId: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('book_comments')
      .delete()
      .eq('id', data.commentId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
