import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { z } from 'zod'
import type { Enums, Tables } from '#/lib/database.types'

export type PostStatus = Enums<'post_status'>

export type DbPost = Tables<'posts'> & { status: PostStatus }

const UpsertPostSchema = z.object({
  id: z.string().optional(),
  slug: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()),
  hero_image: z.string().optional(),
  published_at: z.string().optional(),
})

// ── Public ────────────────────────────────────────────────────────────────────

export const getPublishedPosts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = getSupabaseServiceClient()
    const [{ data: posts, error }, { data: statuses }] = await Promise.all([
      supabase
        .from('posts')
        .select('*')
        .order('published_at', { ascending: false }),
      supabase
        .from('post_current_status')
        .select('post_id')
        .eq('status', 'PUBLISHED'),
    ])
    if (error) throw new Error(error.message)
    const publishedIds = new Set((statuses ?? []).map((s) => (s as Tables<'post_current_status'>).post_id))
    const rows = (posts ?? []) as Tables<'posts'>[]
    return rows
      .filter((p) => publishedIds.has(p.id))
      .map((p) => ({ ...p, status: 'PUBLISHED' as PostStatus })) as DbPost[]
  },
)

export const getPublishedPost = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServiceClient()
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', data.slug)
      .single()
    if (error || !post) return null
    const p = post as Tables<'posts'>

    const { data: statusRow } = await supabase
      .from('post_current_status')
      .select('status')
      .eq('post_id', p.id)
      .single()
    if (statusRow?.status !== 'PUBLISHED') return null

    return { ...p, status: 'PUBLISHED' as PostStatus } as DbPost
  })

export const getAllTags = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase.from('posts').select('tags')
  if (error) throw new Error(error.message)
  const tags = [...new Set((data ?? []).flatMap((p) => p.tags as string[]))]
  return tags.sort()
})

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAdminPosts = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const [{ data: posts, error }, { data: statuses }] = await Promise.all([
      supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('post_current_status').select('*'),
    ])
    if (error) throw new Error(error.message)
    const statusRows = (statuses ?? []) as Tables<'post_current_status'>[]
    const statusById = new Map(statusRows.map((s) => [s.post_id, s.status]))
    const rows = (posts ?? []) as Tables<'posts'>[]
    return rows.map((post) => ({
      ...post,
      status: (statusById.get(post.id) ?? 'PENDING') as PostStatus,
    })) as DbPost[]
  },
)

export const getPostBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', data.slug)
      .single()
    if (error || !post) return null
    const p = post as Tables<'posts'>
    const { data: statusRow } = await supabase
      .from('post_current_status')
      .select('status')
      .eq('post_id', p.id)
      .single()
    return { ...p, status: (statusRow?.status ?? 'PENDING') as PostStatus } as DbPost
  })

export const upsertPost = createServerFn({ method: 'POST' })
  .inputValidator(UpsertPostSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: post, error } = await supabase
      .from('posts')
      .upsert(
        {
          ...(data.id ? { id: data.id } : {}),
          slug: data.slug,
          title: data.title,
          description: data.description ?? null,
          content: data.content,
          tags: data.tags,
          hero_image: data.hero_image ?? null,
          published_at: data.published_at ?? null,
        },
        { onConflict: 'slug' },
      )
      .select()
      .single()
    if (error) throw new Error(error.message)
    return post
  })

export const setPostStatus = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      postId: z.string(),
      status: z.enum(['PENDING', 'PUBLISHED', 'ARCHIVED']),
    }),
  )
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('post_status_update')
      .insert({ post_id: data.postId, status: data.status })
    if (error) throw new Error(error.message)

    // Set published_at the first time a post is published
    if (data.status === 'PUBLISHED') {
      await supabase
        .from('posts')
        .update({ published_at: new Date().toISOString() })
        .eq('id', data.postId)
        .is('published_at', null)
    }

    return { ok: true }
  })
