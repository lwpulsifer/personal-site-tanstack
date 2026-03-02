import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { marked } from 'marked'
import { sanitize } from '#/lib/sanitize'
import type { DbPost, PostStatus } from '#/server/posts'
import { upsertPost, setPostStatus } from '#/server/posts'
import { STATUS_STYLES } from '#/components/blog/StatusBadge'

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
  knownTags?: string[]
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

type EditorStatus = PostStatus | 'draft'

const STATUS_LABEL: Record<EditorStatus, string> = {
  draft: 'Draft',
  PENDING: 'Pending',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

const STATUS_CLASS: Record<EditorStatus, string> = {
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  ...STATUS_STYLES,
}

type PostFields = {
  title: string
  slug: string
  description: string
  tags: string[]
  content: string
  heroImage: string
}

// ── TagsInput ──────────────────────────────────────────────────────────────────

function TagsInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = suggestions.filter(
    (s) =>
      s.toLowerCase().startsWith(input.toLowerCase()) && !value.includes(s),
  )

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  return (
    <div className="relative">
      <div className="flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 transition focus-within:border-[var(--blue)] focus-within:ring-2 focus-within:ring-[rgba(59,130,246,0.2)]">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--text)]"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="leading-none text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag(input)
            } else if (e.key === 'Backspace' && !input && value.length > 0) {
              onChange(value.slice(0, -1))
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length === 0 ? 'Add tags…' : ''}
          className="min-w-20 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder-[var(--text-muted)]"
        />
      </div>

      {open && input && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-lg">
          {filtered.slice(0, 8).map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  addTag(tag)
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)]"
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

const DIVIDER = <span className="w-px self-stretch bg-[var(--border)]" />

function ToolbarButton({
  label,
  title,
  labelClass,
  onAction,
}: {
  label: string
  title: string
  labelClass?: string
  onAction: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      // mousedown keeps focus in the textarea; click fires after blur
      onMouseDown={(e) => {
        e.preventDefault()
        onAction()
      }}
      className="rounded px-2 py-1 text-xs text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
    >
      <span className={labelClass}>{label}</span>
    </button>
  )
}

// ── PostEditor ─────────────────────────────────────────────────────────────────

export function PostEditor({ initial, knownTags = [], onClose, onSaved }: Props) {
  const [fields, setFields] = useState<PostFields>({
    title: initial.title ?? '',
    slug: initial.slug ?? '',
    description: initial.description ?? '',
    tags: initial.tags ?? [],
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

  // ── Formatting helpers ─────────────────────────────────────────────────────

  // Wraps the selected text (or a placeholder) in prefix/suffix.
  // After update, the inserted word is selected so the user can keep typing.
  function applyWrap(prefix: string, suffix: string, placeholder: string) {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const word = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + prefix + word + suffix + value.slice(e)
    setField('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + prefix.length, s + prefix.length + word.length)
    })
  }

  // Prepends prefix to the current line.
  function applyPrefix(prefix: string) {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    setField('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(s + prefix.length, e + prefix.length)
    })
  }

  // Inserts a link, pre-selecting the url placeholder so the user can type it.
  function applyLink() {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const text = value.slice(s, e) || 'link text'
    const insertion = `[${text}](url)`
    const next = value.slice(0, s) + insertion + value.slice(e)
    setField('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      // select the "url" placeholder: after `[text](`
      const urlStart = s + 1 + text.length + 2
      ta.setSelectionRange(urlStart, urlStart + 3)
    })
  }

  // Inserts an image tag, pre-selecting the url placeholder.
  function applyImage() {
    const ta = textareaRef.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const alt = value.slice(s, e) || 'alt text'
    const insertion = `![${alt}](url)`
    const next = value.slice(0, s) + insertion + value.slice(e)
    setField('content', next)
    requestAnimationFrame(() => {
      ta.focus()
      // select the "url" placeholder: after `![alt](`
      const urlStart = s + 2 + alt.length + 2
      ta.setSelectionRange(urlStart, urlStart + 3)
    })
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertPost({
        data: {
          ...(savedPostId ? { id: savedPostId } : {}),
          slug: fields.slug,
          title: fields.title,
          description: fields.description || undefined,
          content: fields.content,
          tags: fields.tags,
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

  // Focus textarea on tab switch to Write
  useEffect(() => {
    if (tab === 'write') textareaRef.current?.focus()
  }, [tab])

  // Escape closes the editor
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const renderedHtml = useMemo(
    () => sanitize(marked.parse(fields.content) as string),
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
            className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
            aria-label="Close editor"
          >
            ✕
          </button>
          <span className="text-sm font-semibold text-[var(--text)]">
            {initial.id ? 'Edit post' : 'New post'}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="flex items-center gap-2">
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
              Tags
            </label>
            <TagsInput
              value={fields.tags}
              onChange={(tags) => setField('tags', tags)}
              suggestions={knownTags}
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

      {/* ── Formatting toolbar (Write mode only) ─────────────────────────── */}
      {tab === 'write' && (
        <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
          <ToolbarButton
            label="B"
            title="Bold (wrap with **)"
            labelClass="font-bold"
            onAction={() => applyWrap('**', '**', 'bold')}
          />
          <ToolbarButton
            label="I"
            title="Italic (wrap with *)"
            labelClass="italic"
            onAction={() => applyWrap('*', '*', 'italic')}
          />
          <ToolbarButton
            label="S"
            title="Strikethrough (wrap with ~~)"
            labelClass="line-through"
            onAction={() => applyWrap('~~', '~~', 'text')}
          />

          {DIVIDER}

          <ToolbarButton
            label="H2"
            title="Heading 2 (prefix ##)"
            labelClass="font-bold font-mono"
            onAction={() => applyPrefix('## ')}
          />
          <ToolbarButton
            label="H3"
            title="Heading 3 (prefix ###)"
            labelClass="font-mono"
            onAction={() => applyPrefix('### ')}
          />
          <ToolbarButton
            label="❝"
            title="Blockquote (prefix >)"
            onAction={() => applyPrefix('> ')}
          />

          {DIVIDER}

          <ToolbarButton
            label="`code`"
            title="Inline code"
            labelClass="font-mono"
            onAction={() => applyWrap('`', '`', 'code')}
          />
          <ToolbarButton
            label="```block"
            title="Code block"
            labelClass="font-mono"
            onAction={() => applyWrap('```\n', '\n```', 'code')}
          />

          {DIVIDER}

          <ToolbarButton
            label="• list"
            title="Unordered list item"
            onAction={() => applyPrefix('- ')}
          />
          <ToolbarButton
            label="1. list"
            title="Ordered list item"
            onAction={() => applyPrefix('1. ')}
          />

          {DIVIDER}

          <ToolbarButton
            label="Link"
            title="Insert link"
            onAction={applyLink}
          />
          <ToolbarButton
            label="Image"
            title="Insert image"
            onAction={applyImage}
          />
        </div>
      )}

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
