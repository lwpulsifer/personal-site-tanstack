import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServiceClient } from '#/lib/supabase'
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
    const supabase = getSupabaseServiceClient()
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (posts ?? []) as DbPost[]
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
      .eq('status', 'PUBLISHED')
      .single()
    if (error || !post) return null
    return post as DbPost
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
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (posts ?? []) as DbPost[]
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
    return post as DbPost
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

    const updates: Record<string, unknown> = { status: data.status }

    // Set published_at the first time a post is published
    if (data.status === 'PUBLISHED') {
      const { data: existing } = await supabase
        .from('posts')
        .select('published_at')
        .eq('id', data.postId)
        .single()
      if (!existing?.published_at) {
        updates.published_at = new Date().toISOString()
      }
    }

    const { error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', data.postId)
    if (error) throw new Error(error.message)

    return { ok: true }
  })
