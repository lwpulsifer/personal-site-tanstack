import { query } from '@solidjs/router'
import { respond } from '@solidjs/web'
import { z } from 'zod'
import type { Enums, Tables } from '../lib/database.types'
import { parse } from './validate'

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
export type UpsertPostInput = z.infer<typeof UpsertPostSchema>

// ── Public ───────────────────────────────────────────────────────────────────

export const getPublishedPosts = query(async () => {
  'use server'
  const { getSupabaseServiceClient } = await import('./supabase')
  const supabase = getSupabaseServiceClient()
  const [{ data: posts, error }, { data: statuses }] = await Promise.all([
    supabase.from('posts').select('*').order('published_at', { ascending: false }),
    supabase.from('post_current_status').select('post_id').eq('status', 'PUBLISHED'),
  ])
  if (error) throw new Error(error.message)
  const publishedIds = new Set(
    (statuses ?? []).map((s) => (s as Tables<'post_current_status'>).post_id),
  )
  return ((posts ?? []) as Tables<'posts'>[])
    .filter((p) => publishedIds.has(p.id))
    .map((p) => ({ ...p, status: 'PUBLISHED' as PostStatus })) as DbPost[]
}, 'published-posts')

export const getPublishedPost = query(async (slug: string) => {
  'use server'
  slug = parse(z.string(), slug)
  const { getSupabaseServiceClient } = await import('./supabase')
  const supabase = getSupabaseServiceClient()
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
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
}, 'published-post')

export const getAllTags = query(async () => {
  'use server'
  const { getSupabaseServiceClient } = await import('./supabase')
  const { data, error } = await getSupabaseServiceClient().from('posts').select('tags')
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).flatMap((p) => p.tags as string[]))].sort()
}, 'all-tags')

// ── Admin ────────────────────────────────────────────────────────────────────

export const getAdminPosts = query(async () => {
  'use server'
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const supabase = getSupabaseServiceClient()
  const [{ data: posts, error }, { data: statuses }] = await Promise.all([
    supabase.from('posts').select('*').order('created_at', { ascending: false }),
    supabase.from('post_current_status').select('*'),
  ])
  if (error) throw new Error(error.message)
  const statusById = new Map(
    ((statuses ?? []) as Tables<'post_current_status'>[]).map((s) => [s.post_id, s.status]),
  )
  return ((posts ?? []) as Tables<'posts'>[]).map((post) => ({
    ...post,
    status: (statusById.get(post.id) ?? 'PENDING') as PostStatus,
  })) as DbPost[]
}, 'admin-posts')

// Mutations name the query keys they touched (prefix-matched) via respond();
// this replaces the React app's manual invalidateQueries calls.
const POST_KEYS = ['admin-posts', 'published-posts', 'published-post', 'all-tags']
export async function upsertPost(input: UpsertPostInput) {
  'use server'
  const data = parse(UpsertPostSchema, input)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { data: post, error } = await getSupabaseServiceClient()
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
  return respond(post, { revalidate: POST_KEYS })
}

export async function setPostStatus(postId: string, status: PostStatus) {
  'use server'
  postId = parse(z.string(), postId)
  parse(z.enum(['PENDING', 'PUBLISHED', 'ARCHIVED']), status)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('post_status_update')
    .insert({ post_id: postId, status })
  if (error) throw new Error(error.message)
  // Set published_at the first time a post is published
  if (status === 'PUBLISHED') {
    await supabase
      .from('posts')
      .update({ published_at: new Date().toISOString() })
      .eq('id', postId)
      .is('published_at', null)
  }
  return respond({ ok: true }, { revalidate: POST_KEYS })
}
