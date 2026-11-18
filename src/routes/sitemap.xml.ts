import type { APIHandler } from 'filesystem-routing/api'
import { SITE_URL } from '../lib/site'
import { getSupabaseServiceClient } from '../server/supabase'

const STATIC_PATHS = ['/', '/blog', '/books', '/fun']

const day = (iso: string) => new Date(iso).toISOString().split('T')[0]

export const GET: APIHandler = async () => {
  const supabase = getSupabaseServiceClient()
  const [{ data: posts }, { data: statuses }, { data: books }] = await Promise.all([
    supabase.from('posts').select('id, slug, published_at').order('published_at', { ascending: false }),
    supabase.from('post_current_status').select('post_id').eq('status', 'PUBLISHED'),
    // No draft/pending state for books — every row is public as soon as it's saved.
    supabase.from('books').select('id, updated_at'),
  ])

  const publishedIds = new Set((statuses ?? []).map((s) => s.post_id))
  const published = (posts ?? []).filter((p) => publishedIds.has(p.id))

  const staticEntries = STATIC_PATHS.map((path) => `<url><loc>${SITE_URL}${path}</loc></url>`).join('')
  const postEntries = published
    .map((post) => {
      const lastmod = post.published_at ? `<lastmod>${day(post.published_at)}</lastmod>` : ''
      return `<url><loc>${SITE_URL}/blog/${post.slug}</loc>${lastmod}</url>`
    })
    .join('')
  const bookEntries = (books ?? [])
    .map((book) => {
      const lastmod = book.updated_at ? `<lastmod>${day(book.updated_at)}</lastmod>` : ''
      return `<url><loc>${SITE_URL}/books/${book.id}</loc>${lastmod}</url>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${postEntries}${bookEntries}</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
