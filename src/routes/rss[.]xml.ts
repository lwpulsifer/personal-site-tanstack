import { createFileRoute } from '@tanstack/react-router'
import { getSupabaseClient } from '#/lib/supabase'
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '#/lib/site'

export const Route = createFileRoute('/rss.xml')({
  server: {
    handlers: {
      GET: async () => {
        const supabase = getSupabaseClient()
        const [{ data: posts }, { data: statuses }] = await Promise.all([
          supabase
            .from('posts')
            .select('id, slug, title, description, published_at')
            .order('published_at', { ascending: false }),
          supabase
            .from('post_current_status')
            .select('post_id')
            .eq('status', 'PUBLISHED'),
        ])

        const publishedIds = new Set((statuses ?? []).map((s) => s.post_id))
        const published = (posts ?? []).filter((p) => publishedIds.has(p.id))

        const items = published
          .map((post) => {
            const url = `${SITE_URL}/blog/${post.slug}`
            return `<item><title><![CDATA[${post.title}]]></title><description><![CDATA[${post.description ?? ''}]]></description><link>${url}</link><guid>${url}</guid><pubDate>${new Date(post.published_at ?? '').toUTCString()}</pubDate></item>`
          })
          .join('')

        const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title><![CDATA[${SITE_TITLE}]]></title><description><![CDATA[${SITE_DESCRIPTION}]]></description><link>${SITE_URL}</link>${items}</channel></rss>`

        return new Response(xml, {
          headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
        })
      },
    },
  },
})
