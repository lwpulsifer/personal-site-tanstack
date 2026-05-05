import { createServerFn } from '@tanstack/react-start'
import Parser from 'rss-parser'
import { z } from 'zod'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import type { Tables } from '#/lib/database.types'

const FETCH_TIMEOUT_MS = 10_000
const MAX_ITEMS_PER_FEED = 100
const MAX_DESCRIPTION_LEN = 500
const ITEMS_PAGE_SIZE = 200

export type DbFeed = Tables<'feeds'>
export type DbFeedItem = Tables<'feed_items'>

export type FeedItemWithFeed = DbFeedItem & {
  feed_title: string | null
  feed_url: string
  feed_site_url: string | null
}

const parser = new Parser({ timeout: FETCH_TIMEOUT_MS })

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}

function toIsoDate(s: string | undefined): string | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.valueOf()) ? null : d.toISOString()
}

async function refreshFeed(feedId: string, url: string) {
  const supabase = getSupabaseServiceClient()
  try {
    const parsed = await parser.parseURL(url)
    const rows = (parsed.items ?? [])
      .slice(0, MAX_ITEMS_PER_FEED)
      .map((item) => {
        const description =
          item.contentSnippet ?? item.summary ?? item.content ?? null
        return {
          feed_id: feedId,
          guid: item.guid ?? item.link ?? item.title ?? crypto.randomUUID(),
          title: item.title ?? '(untitled)',
          link: item.link ?? null,
          description: description
            ? truncate(stripHtml(description), MAX_DESCRIPTION_LEN)
            : null,
          author: item.creator ?? null,
          published_at: toIsoDate(item.isoDate ?? item.pubDate),
        }
      })

    if (rows.length > 0) {
      const { error } = await supabase
        .from('feed_items')
        .upsert(rows, { onConflict: 'feed_id,guid' })
      if (error) throw new Error(error.message)
    }

    await supabase
      .from('feeds')
      .update({
        title: parsed.title ?? null,
        site_url: parsed.link ?? null,
        description: parsed.description ?? null,
        last_fetched_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', feedId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    await supabase
      .from('feeds')
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error: message,
      })
      .eq('id', feedId)
    throw err
  }
}

// ── Public ────────────────────────────────────────────────────────────────────

export const getFeeds = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as DbFeed[]
})

export const getFeedItems = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('feed_items')
      .select('*, feed:feeds(title, url, site_url)')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(ITEMS_PAGE_SIZE)
    if (error) throw new Error(error.message)
    type Joined = DbFeedItem & {
      feed: { title: string | null; url: string; site_url: string | null } | null
    }
    return (data as Joined[] | null ?? []).map((row) => ({
      ...row,
      feed_title: row.feed?.title ?? null,
      feed_url: row.feed?.url ?? '',
      feed_site_url: row.feed?.site_url ?? null,
    })) as FeedItemWithFeed[]
  },
)

// ── Admin ─────────────────────────────────────────────────────────────────────

export const addFeed = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()

    const { data: existing } = await supabase
      .from('feeds')
      .select('id')
      .eq('url', data.url)
      .maybeSingle()

    let feedId: string
    if (existing) {
      feedId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from('feeds')
        .insert({ url: data.url })
        .select('id')
        .single()
      if (error || !created) {
        throw new Error(error?.message ?? 'Failed to create feed')
      }
      feedId = created.id
    }

    await refreshFeed(feedId, data.url)
    return { ok: true, feedId }
  })

export const deleteFeed = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase.from('feeds').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const refreshAllFeeds = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase.from('feeds').select('id, url')
    if (error) throw new Error(error.message)
    const results = await Promise.allSettled(
      (data ?? []).map((f) => refreshFeed(f.id, f.url)),
    )
    return {
      ok: true,
      refreshed: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    }
  },
)
