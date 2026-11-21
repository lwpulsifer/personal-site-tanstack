import { createServerFn } from '@tanstack/react-start'
import { getRequestIP } from '@tanstack/react-start/server'
import { z } from 'zod'
import type { Tables } from '#/lib/database.types'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { checkRateLimit } from '#/server/rate-limit'

export type DbQuiz = Tables<'quizzes'>
export type DbQuizItem = Tables<'quiz_items'>
export type DbQuizResponse = Tables<'quiz_responses'>

/** What a visitor sees for an item — never includes `secret_label`. */
export type PublicQuizItem = Pick<
  DbQuizItem,
  'id' | 'description' | 'image_url'
>

export type PublicQuiz = Pick<DbQuiz, 'id' | 'title' | 'description'> & {
  items: PublicQuizItem[]
}

export type AdminQuizSummary = DbQuiz & {
  item_count: number
  response_count: number
}

export type AdminQuizDetail = DbQuiz & {
  items: DbQuizItem[]
  responses: DbQuizResponse[]
}

/** Keywords are matched case- and whitespace-insensitively. */
export function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase()
}

// Path segments under /quizzes that would shadow (or be shadowed by) a quiz
// keyword route.
const RESERVED_KEYWORDS = new Set(['admin'])

// Generous enough for a visitor fumbling the keyword, low enough that
// guessing keywords by brute force is impractical.
const LOOKUP_LIMIT_PER_MINUTE = 20
const SUBMIT_LIMIT_PER_MINUTE = 5

function clientIp() {
  return getRequestIP({ xForwardedFor: true }) ?? 'unknown'
}

// ── Public ───────────────────────────────────────────────────────────────────

export const getQuizByKeyword = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ keyword: z.string().max(200) }))
  .handler(async ({ data }): Promise<PublicQuiz | null> => {
    const { allowed } = checkRateLimit(
      `quiz-lookup:${clientIp()}`,
      LOOKUP_LIMIT_PER_MINUTE,
    )
    if (!allowed) throw new Error('Too many attempts — try again in a minute.')

    const keyword = normalizeKeyword(data.keyword)
    if (!keyword) return null

    const supabase = getSupabaseServiceClient()
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('id, title, description, is_open')
      .eq('keyword', keyword)
      .maybeSingle()
    if (error) throw new Error(error.message)
    // A closed quiz is indistinguishable from a missing one to visitors.
    if (!quiz || !quiz.is_open) return null

    const { data: items, error: itemsError } = await supabase
      .from('quiz_items')
      .select('id, description, image_url')
      .eq('quiz_id', quiz.id)
      .order('position', { ascending: true })
    if (itemsError) throw new Error(itemsError.message)

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      items: (items ?? []) as PublicQuizItem[],
    }
  })

const ComparisonSchema = z.object({ winner: z.string(), loser: z.string() })

export const submitQuizResponse = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      keyword: z.string().max(200),
      respondentName: z.string().max(100).optional(),
      ordering: z.array(z.string()).max(500),
      comparisons: z.array(ComparisonSchema).max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const { allowed } = checkRateLimit(
      `quiz-submit:${clientIp()}`,
      SUBMIT_LIMIT_PER_MINUTE,
    )
    if (!allowed) throw new Error('Too many submissions — try again shortly.')

    const supabase = getSupabaseServiceClient()
    // Re-resolve by keyword (rather than trusting a quiz id from the client)
    // so the keyword remains the only way to write to a quiz.
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('id, is_open')
      .eq('keyword', normalizeKeyword(data.keyword))
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!quiz || !quiz.is_open) throw new Error('Quiz not found')

    const { data: items, error: itemsError } = await supabase
      .from('quiz_items')
      .select('id')
      .eq('quiz_id', quiz.id)
    if (itemsError) throw new Error(itemsError.message)

    // The ordering must be a permutation of the quiz's current items. If the
    // admin edited items mid-quiz this fails, which is the right outcome —
    // the visitor's ranking would be of a different set.
    const itemIds = new Set((items ?? []).map((i) => i.id))
    const orderingIds = new Set(data.ordering)
    if (
      orderingIds.size !== data.ordering.length ||
      orderingIds.size !== itemIds.size ||
      data.ordering.some((id) => !itemIds.has(id))
    ) {
      throw new Error(
        'This quiz changed while you were taking it — please start again.',
      )
    }
    const comparisons = data.comparisons.filter(
      (c) => itemIds.has(c.winner) && itemIds.has(c.loser),
    )

    const name = data.respondentName?.trim()
    const { error: insertError } = await supabase
      .from('quiz_responses')
      .insert({
        quiz_id: quiz.id,
        respondent_name: name ? name : null,
        ordering: data.ordering,
        comparisons,
      })
    if (insertError) throw new Error(insertError.message)
    return { ok: true }
  })

// ── Admin ────────────────────────────────────────────────────────────────────

export const getAdminQuizzes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminQuizSummary[]> => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const [quizzes, items, responses] = await Promise.all([
      supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('quiz_items').select('quiz_id'),
      supabase.from('quiz_responses').select('quiz_id'),
    ])
    for (const r of [quizzes, items, responses]) {
      if (r.error) throw new Error(r.error.message)
    }
    const count = (rows: { quiz_id: string }[] | null) => {
      const m = new Map<string, number>()
      for (const r of rows ?? []) m.set(r.quiz_id, (m.get(r.quiz_id) ?? 0) + 1)
      return m
    }
    const itemCounts = count(items.data)
    const responseCounts = count(responses.data)
    return ((quizzes.data ?? []) as DbQuiz[]).map((q) => ({
      ...q,
      item_count: itemCounts.get(q.id) ?? 0,
      response_count: responseCounts.get(q.id) ?? 0,
    }))
  },
)

export const getAdminQuiz = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ quizId: z.string() }))
  .handler(async ({ data }): Promise<AdminQuizDetail | null> => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', data.quizId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!quiz) return null

    const [items, responses] = await Promise.all([
      supabase
        .from('quiz_items')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('position', { ascending: true }),
      supabase
        .from('quiz_responses')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('completed_at', { ascending: false }),
    ])
    if (items.error) throw new Error(items.error.message)
    if (responses.error) throw new Error(responses.error.message)

    return {
      ...(quiz as DbQuiz),
      items: (items.data ?? []) as DbQuizItem[],
      responses: (responses.data ?? []) as DbQuizResponse[],
    }
  })

const UpsertQuizSchema = z.object({
  id: z.string().optional(),
  keyword: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  is_open: z.boolean(),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        secret_label: z.string().max(500).optional(),
        description: z.string().max(2000).optional(),
        image_url: z.string().max(2000).optional(),
      }),
    )
    .max(200),
})

export type UpsertQuizInput = z.infer<typeof UpsertQuizSchema>

const orNull = (s: string | undefined) => (s?.trim() ? s.trim() : null)

export const upsertQuiz = createServerFn({ method: 'POST' })
  .inputValidator(UpsertQuizSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const keyword = normalizeKeyword(data.keyword)
    if (RESERVED_KEYWORDS.has(keyword)) {
      throw new Error(`"${keyword}" is reserved — pick another keyword.`)
    }

    const supabase = getSupabaseServiceClient()
    const { data: quiz, error } = await supabase
      .from('quizzes')
      .upsert({
        ...(data.id ? { id: data.id } : {}),
        keyword,
        title: data.title.trim(),
        description: orNull(data.description),
        is_open: data.is_open,
      })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') {
        throw new Error('Another quiz already uses that keyword.')
      }
      throw new Error(error.message)
    }

    // Sync items: delete the ones that were removed, then upsert the rest
    // with positions matching the submitted order.
    const { data: existing, error: existingError } = await supabase
      .from('quiz_items')
      .select('id')
      .eq('quiz_id', quiz.id)
    if (existingError) throw new Error(existingError.message)

    const keepIds = new Set(data.items.flatMap((i) => (i.id ? [i.id] : [])))
    const toDelete = (existing ?? [])
      .map((i) => i.id)
      .filter((id) => !keepIds.has(id))
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('quiz_items')
        .delete()
        .in('id', toDelete)
      if (deleteError) throw new Error(deleteError.message)
    }

    const rows = data.items.map((item, position) => ({
      ...(item.id ? { id: item.id } : {}),
      quiz_id: quiz.id,
      secret_label: orNull(item.secret_label),
      description: orNull(item.description),
      image_url: orNull(item.image_url),
      position,
    }))
    // Split so new rows get DB-generated ids (upsert with a mix of rows
    // with/without `id` would send null ids for the new ones).
    const updates = rows.filter((r) => 'id' in r)
    const inserts = rows.filter((r) => !('id' in r))
    if (updates.length > 0) {
      const { error: e } = await supabase.from('quiz_items').upsert(updates)
      if (e) throw new Error(e.message)
    }
    if (inserts.length > 0) {
      const { error: e } = await supabase.from('quiz_items').insert(inserts)
      if (e) throw new Error(e.message)
    }

    return quiz as DbQuiz
  })

export const deleteQuiz = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ quizId: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('quizzes')
      .delete()
      .eq('id', data.quizId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteQuizResponse = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ responseId: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('quiz_responses')
      .delete()
      .eq('id', data.responseId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
