/**
 * Migrates existing markdown posts from content/blog/ into the Supabase
 * `posts` and `post_status_update` tables.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_KEY=... bun scripts/migrate-posts.ts
 *
 * SUPABASE_KEY must be the service-role key (bypasses RLS).
 * The script upserts on slug, so it is safe to re-run.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Env ───────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_KEY (service-role key) before running.')
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

function slugFromFilename(filename: string) {
  return filename.replace(/\.(md|mdx)$/, '')
}

// ── Get admin user ────────────────────────────────────────────────────────────
async function getAdminUserId(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) throw new Error(`Failed to list users: ${error.message}`)
  if (!data.users.length) throw new Error('No users found in auth.users')
  if (data.users.length > 1) {
    throw new Error(`Found ${data.users.length} users`);
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

    // Map old boolean display field to the new status enum.
    // display: false → ARCHIVED, display: true (default) → PUBLISHED
    const status = data.display === 'false' || data.display === false
      ? 'ARCHIVED' as const
      : 'PUBLISHED' as const

    const published_at = data.pubDate ? new Date(data.pubDate).toISOString() : null

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? null,
      content,
      tags,
      hero_image: data.heroImage ?? null,
      published_at,
      author_id: authorId,
      // status is not a column on posts — tracked separately in post_status_update
      _status: status,
    }
  })

  console.log(`Upserting ${posts.length} posts…`)

  // Upsert posts (strip the internal _status field first).
  const postRows = posts.map(({ _status: _, ...rest }) => rest)
  const { data: upserted, error: postsError } = await supabase
    .from('posts')
    .upsert(postRows, { onConflict: 'slug' })
    .select('id, slug, title')

  if (postsError) {
    console.error('Posts upsert failed:', postsError.message)
    process.exit(1)
  }

  // Insert an initial status log entry for each post.
  // Skip posts that already have a status entry to stay idempotent.
  const statusRows = (upserted ?? []).map(row => {
    const post = posts.find(p => p.slug === row.slug)!
    return {
      post_id: row.id,
      status: post._status,
      changed_by: authorId,
    }
  })

  // Only insert where no status log entry exists yet.
  const { data: existingStatuses } = await supabase
    .from('post_status_update')
    .select('post_id')
    .in('post_id', statusRows.map(r => r.post_id))

  const existingPostIds = new Set((existingStatuses ?? []).map(r => r.post_id))
  const newStatusRows = statusRows.filter(r => !existingPostIds.has(r.post_id))

  if (newStatusRows.length > 0) {
    const { error: statusError } = await supabase
      .from('post_status_update')
      .insert(newStatusRows)

    if (statusError) {
      console.error('Status log insert failed:', statusError.message)
      process.exit(1)
    }
  }

  console.log('Done! Posts migrated:')
  for (const p of upserted ?? []) {
    const post = posts.find(pp => pp.slug === p.slug)!
    const statusNote = existingPostIds.has(p.id) ? '(status already exists)' : `→ ${post._status}`
    console.log(`  ✓ ${p.slug} — ${p.title} ${statusNote}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
