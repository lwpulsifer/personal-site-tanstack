import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { marked } from 'marked'
import type { DbPost, PostStatus } from '#/server/posts'
import { upsertPost, setPostStatus } from '#/server/posts'

marked.setOptions({ async: false })

export type PostEditorInitial = {
  id?: string
  slug?: string
  title?: string
  description?: string
  content?: string
  tags?: string[]
  hero_image?: string
  status?: PostStatus
}

type Props = {
  initial: PostEditorInitial
  onClose: () => void
  onSaved: (post: DbPost) => void
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

// Status badge shown in the editor toolbar.
// 'draft' is a UI-only state — it is never written to the DB.
type EditorStatus = PostStatus | 'draft'

const STATUS_LABEL: Record<EditorStatus, string> = {
  draft: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

const STATUS_CLASS: Record<EditorStatus, string> = {
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  ARCHIVED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

type PostFields = {
  title: string
  slug: string
  description: string
  tagsRaw: string
  content: string
  heroImage: string
}

export function PostEditor({ initial, onClose, onSaved }: Props) {
  const [fields, setFields] = useState<PostFields>({
    title: initial.title ?? '',
    slug: initial.slug ?? '',
    description: initial.description ?? '',
    tagsRaw: initial.tags?.join(', ') ?? '',
    content: initial.content ?? '',
    heroImage: initial.hero_image ?? '',
  })

  const [savedPostId, setSavedPostId] = useState<string | null>(initial.id ?? null)
  const [status, setStatus] = useState<EditorStatus>(initial.status ?? 'draft')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const slugManuallyEdited = useRef(!!initial.slug)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function setField<K extends keyof PostFields>(key: K, value: PostFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPost({
        data: {
          ...(savedPostId ? { id: savedPostId } : {}),
          slug: fields.slug,
          title: fields.title,
          description: fields.description || undefined,
          content: fields.content,
          tags: fields.tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
          hero_image: fields.heroImage || undefined,
        },
      }),
    onSuccess: (post) => {
      setSavedPostId(post.id)
      onSaved(post as DbPost)
    },
  })

  const statusMutation = useMutation({
    mutationFn: (next: PostStatus) =>
      setPostStatus({ data: { postId: savedPostId!, status: next } }),
    onSuccess: (_data, next) => setStatus(next),
  })

  const error = saveMutation.error ?? statusMutation.error

  // Auto-generate slug from title for new posts
  useEffect(() => {
    if (!slugManuallyEdited.current && !initial.slug) {
      setField('slug', slugify(fields.title))
    }
  }, [fields.title, initial.slug])

  // Focus textarea on mount
  useEffect(() => {
    if (tab === 'write') textareaRef.current?.focus()
  }, [tab])

  // Intercept Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const renderedHtml = useMemo(
    () => marked.parse(fields.content) as string,
    [fields.content],
  )

  const hasSavedId = !!savedPostId
  const isSaving = saveMutation.isPending
  const isActing = statusMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)] transition"
            aria-label="Close editor"
          >
            ✕
          </button>
          <span className="text-sm font-semibold text-[var(--text)]">
            {initial.id ? 'Edit post' : 'New post'}
          </span>

          {/* Status badge — always visible, UI-only for 'draft' */}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Write / Preview tabs */}
          <div className="flex rounded-full border border-[var(--border)] bg-[var(--chip-bg)] p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setTab('write')}
              className={`rounded-full px-3 py-1 transition ${tab === 'write' ? 'bg-[var(--blue-deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`rounded-full px-3 py-1 transition ${tab === 'preview' ? 'bg-[var(--blue-deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Preview
            </button>
          </div>

          {/* Status actions — only enabled once the post is saved to DB */}
          {hasSavedId && status !== 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('PUBLISHED')}
              disabled={isActing}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          {hasSavedId && status === 'PUBLISHED' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('ARCHIVED')}
              disabled={isActing}
              className="rounded-full bg-gray-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-600 disabled:opacity-50"
            >
              Archive
            </button>
          )}
          {hasSavedId && status === 'ARCHIVED' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('PENDING')}
              disabled={isActing}
              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              Restore
            </button>
          )}

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={isSaving || !fields.title || !fields.slug || !fields.content}
            className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* ── Meta fields ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Title
            </label>
            <input
              type="text"
              value={fields.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Post title"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Slug
            </label>
            <input
              type="text"
              value={fields.slug}
              onChange={(e) => {
                slugManuallyEdited.current = true
                setField('slug', e.target.value)
              }}
              placeholder="post-slug"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={fields.tagsRaw}
              onChange={(e) => setField('tagsRaw', e.target.value)}
              placeholder="tag1, tag2"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Description
            </label>
            <input
              type="text"
              value={fields.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Short description"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Hero image URL (optional)
            </label>
            <input
              type="text"
              value={fields.heroImage}
              onChange={(e) => setField('heroImage', e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]"
            />
          </div>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="shrink-0 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error instanceof Error ? error.message : 'Something went wrong'}
        </div>
      )}

      {/* ── Editor / Preview ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={fields.content}
            onChange={(e) => setField('content', e.target.value)}
            placeholder="Write your post in Markdown…"
            spellCheck
            className="h-full w-full resize-none bg-[var(--bg)] p-6 font-mono text-sm leading-relaxed text-[var(--text)] outline-none"
          />
        ) : (
          <div className="h-full w-full overflow-y-auto p-6">
            <article
              // biome-ignore lint/security/noDangerouslySetInnerHtml: admin-only preview
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              className="prose prose-slate prose-headings:text-[var(--text)] prose-p:text-[var(--text-muted)] prose-li:text-[var(--text-muted)] prose-strong:text-[var(--text)] prose-a:text-[var(--blue-deep)] mx-auto max-w-3xl"
            />
          </div>
        )}
      </div>
    </div>
  )
}
