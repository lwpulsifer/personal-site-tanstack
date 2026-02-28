/**
 * Migrates existing markdown posts from content/blog/ into the Supabase
 * `posts` table.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_KEY=... bun scripts/migrate-posts.ts
 *
 * SUPABASE_KEY should be the service-role key (bypasses RLS).
 * The script upserts on slug, so it is safe to re-run.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Env ───────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
// Must be the service-role key (not the anon key) to access auth.admin API.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY (service-role key) before running.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Frontmatter parser ────────────────────────────────────────────────────────
interface Frontmatter {
  title: string
  description?: string
  pubDate?: string
  author?: string
  tags?: string
  display?: string | boolean
  heroImage?: string
}

function parseFrontmatter(src: string): { data: Frontmatter; content: string } {
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m)
  if (!match) return { data: {} as Frontmatter, content: src }

  const [, yaml, body] = match
  const data: Record<string, string> = {}
  for (const line of yaml.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const val = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '')
    data[key] = val
  }
  return { data: data as unknown as Frontmatter, content: body.trim() }
}

// ── Slug from filename ────────────────────────────────────────────────────────
function slugFromFilename(filename: string) {
  return filename.replace(/\.(md|mdx)$/, '')
}

// ── Get admin user ────────────────────────────────────────────────────────────
async function getAdminUserId(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(`Failed to list users: ${error.message}`)
  if (!data.users.length) throw new Error('No users found in auth.users')
  if (data.users.length > 1) {
    console.warn(`Found ${data.users.length} users — using the first one (${data.users[0].email})`)
  }
  return data.users[0].id
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const authorId = await getAdminUserId()
  console.log(`Using author_id: ${authorId}`)

  const blogDir = join(import.meta.dirname ?? process.cwd(), '../content/blog')
  const files = readdirSync(blogDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'))

  const posts = files.map(filename => {
    const src = readFileSync(join(blogDir, filename), 'utf-8')
    const { data, content } = parseFrontmatter(src)
    const slug = slugFromFilename(filename)

    const tags = data.tags
      ? data.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    const display = data.display === 'false' || data.display === false ? false : true

    const published_at = data.pubDate ? new Date(data.pubDate).toISOString() : null

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? null,
      content,
      tags,
      hero_image: data.heroImage ?? null,
      display,
      published_at,
      author_id: authorId,
    }
  })

  console.log(`Upserting ${posts.length} posts…`)

  const { data, error } = await supabase
    .from('posts')
    .upsert(posts, { onConflict: 'slug' })
    .select('slug, title')

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log('Done! Posts inserted/updated:')
  for (const p of data ?? []) {
    console.log(`  ✓ ${p.slug} — ${p.title}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
