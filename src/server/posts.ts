import { createServerFn } from '@tanstack/react-start'
import { getSupabaseClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { z } from 'zod'

export type PostStatus = 'PENDING' | 'PUBLISHED' | 'ARCHIVED'

export type DbPost = {
  id: string
  slug: string
  title: string
  description: string | null
  content: string
  tags: string[]
  hero_image: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  author_id: string | null
  status: PostStatus
}

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
    const supabase = getSupabaseClient()
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
    const publishedIds = new Set((statuses ?? []).map((s) => s.post_id))
    return (posts ?? [])
      .filter((p) => publishedIds.has(p.id))
      .map((p) => ({ ...p, status: 'PUBLISHED' as PostStatus })) as DbPost[]
  },
)

export const getPublishedPost = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseClient()
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', data.slug)
      .single()
    if (error || !post) return null

    const { data: statusRow } = await supabase
      .from('post_current_status')
      .select('status')
      .eq('post_id', post.id)
      .single()
    if (statusRow?.status !== 'PUBLISHED') return null

    return { ...post, status: 'PUBLISHED' as PostStatus } as DbPost
  })

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAdminPosts = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    const supabase = getSupabaseClient()
    const [{ data: posts, error }, { data: statuses }] = await Promise.all([
      supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('post_current_status').select('*'),
    ])
    if (error) throw new Error(error.message)
    return (posts ?? []).map((post) => ({
      ...post,
      status: ((statuses ?? []).find((s) => s.post_id === post.id)?.status ??
        'PENDING') as PostStatus,
    })) as DbPost[]
  },
)

export const getPostBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseClient()
    const [{ data: post, error }, { data: statuses }] = await Promise.all([
      supabase.from('posts').select('*').eq('slug', data.slug).single(),
      supabase.from('post_current_status').select('*').eq('post_id', data.slug),
    ])
    if (error || !post) return null
    const status =
      (statuses ?? []).find((s) => s.post_id === post.id)?.status ?? 'PENDING'
    return { ...post, status } as DbPost
  })

export const upsertPost = createServerFn({ method: 'POST' })
  .inputValidator(UpsertPostSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseClient()
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
    const supabase = getSupabaseClient()

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
