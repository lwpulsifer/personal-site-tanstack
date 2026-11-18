import { marked } from 'marked'
import { createMemo, createSignal, createUniqueId, createStore, Show } from 'solid-js'
import { onEscapeKey } from '../lib/hooks/onEscapeKey'
import { sanitize } from '../lib/sanitize'
import { type DbPost, type PostStatus, setPostStatus, upsertPost } from '../server/posts'
import { createEditorFormatting, DIVIDER, ToolbarButton } from './blog/EditorToolbar'
import { STATUS_STYLES } from './blog/StatusBadge'
import { TagsInput } from './blog/TagsInput'

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

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-[rgba(59,130,246,0.2)]'
const labelClass = 'mb-1 block text-xs font-semibold text-[var(--text-muted)]'

export function PostEditor(props: Props) {
  // Plain read of props.initial: the editor seeds once, then owns its state.
  const initial = props.initial
  const [fields, setFields] = createStore<PostFields>({
    title: initial.title ?? '',
    slug: initial.slug ?? '',
    description: initial.description ?? '',
    tags: initial.tags ?? [],
    content: initial.content ?? '',
    heroImage: initial.hero_image ?? '',
  })
  const [savedPostId, setSavedPostId] = createSignal<string | null>(initial.id ?? null)
  const [status, setStatus] = createSignal<EditorStatus>(initial.status ?? 'draft')
  const [tab, setTab] = createSignal<'write' | 'preview'>('write')
  const [isSaving, setIsSaving] = createSignal(false)
  const [isActing, setIsActing] = createSignal(false)
  const [error, setError] = createSignal<unknown>(null)
  let slugManuallyEdited = !!initial.slug
  let textarea: HTMLTextAreaElement | undefined
  const id = createUniqueId()

  const setField = <K extends keyof PostFields>(key: K, value: PostFields[K]) =>
    setFields((f) => {
      f[key] = value
    })

  const { applyWrap, applyPrefix, applyLink, applyImage } = createEditorFormatting(
    () => textarea,
    (content) => setField('content', content),
  )

  async function save() {
    setIsSaving(true)
    setError(null)
    try {
      const post = await upsertPost({
        ...(savedPostId() ? { id: savedPostId()! } : {}),
        slug: fields.slug,
        title: fields.title,
        // Server-function args are JSON: omit empty keys rather than pass undefined.
        ...(fields.description ? { description: fields.description } : {}),
        content: fields.content,
        tags: [...fields.tags],
        ...(fields.heroImage ? { hero_image: fields.heroImage } : {}),
      })
      setSavedPostId(post.id)
      props.onSaved(post as DbPost)
    } catch (e) {
      setError(e)
    } finally {
      setIsSaving(false)
    }
  }

  async function changeStatus(next: PostStatus) {
    const postId = savedPostId()
    if (!postId) return
    setIsActing(true)
    setError(null)
    try {
      await setPostStatus(postId, next)
      setStatus(next)
    } catch (e) {
      setError(e)
    } finally {
      setIsActing(false)
    }
  }

  onEscapeKey(() => props.onClose())

  const renderedHtml = createMemo(() => sanitize(marked.parse(fields.content) as string))
  const hasSavedId = () => !!savedPostId()

  return (
    <div data-testid="post-editor" class="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
            aria-label="Close editor"
            data-testid="close-editor"
          >
            ✕
          </button>
          <span class="text-sm font-semibold text-[var(--text)]">
            {initial.id ? 'Edit post' : 'New post'}
          </span>
          <span class={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status()]}`}>
            {STATUS_LABEL[status()]}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex rounded-full border border-[var(--border)] bg-[var(--chip-bg)] p-0.5 text-sm">
            <button
              type="button"
              onClick={() => {
                setTab('write')
                requestAnimationFrame(() => textarea?.focus())
              }}
              class={`rounded-full px-3 py-1 transition ${tab() === 'write' ? 'bg-[var(--blue-deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setTab('preview')}
              class={`rounded-full px-3 py-1 transition ${tab() === 'preview' ? 'bg-[var(--blue-deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Preview
            </button>
          </div>

          <Show when={hasSavedId() && status() !== 'PUBLISHED'}>
            <button
              type="button"
              onClick={() => changeStatus('PUBLISHED')}
              disabled={isActing()}
              class="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Publish
            </button>
          </Show>
          <Show when={hasSavedId() && status() === 'PUBLISHED'}>
            <button
              type="button"
              onClick={() => changeStatus('ARCHIVED')}
              disabled={isActing()}
              class="rounded-full bg-gray-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-600 disabled:opacity-50"
            >
              Archive
            </button>
          </Show>
          <Show when={hasSavedId() && status() === 'ARCHIVED'}>
            <button
              type="button"
              onClick={() => changeStatus('PENDING')}
              disabled={isActing()}
              class="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              Restore
            </button>
          </Show>

          <button
            type="button"
            onClick={save}
            data-testid="post-save"
            disabled={isSaving() || !fields.title || !fields.slug || !fields.content}
            class="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isSaving() ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* ── Meta fields ─────────────────────────────────────────────────── */}
      <div class="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div class="mx-auto grid max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="lg:col-span-2">
            <label for={`${id}-title`} class={labelClass}>Title</label>
            <input
              id={`${id}-title`}
              type="text"
              value={fields.title}
              onInput={(e) => {
                setField('title', e.currentTarget.value)
                if (!slugManuallyEdited && !initial.slug) {
                  setField('slug', slugify(e.currentTarget.value))
                }
              }}
              data-testid="post-title"
              placeholder="Post title"
              class={inputClass}
            />
          </div>

          <div>
            <label for={`${id}-slug`} class={labelClass}>Slug</label>
            <input
              id={`${id}-slug`}
              type="text"
              value={fields.slug}
              onInput={(e) => {
                slugManuallyEdited = true
                setField('slug', e.currentTarget.value)
              }}
              data-testid="post-slug"
              placeholder="post-slug"
              class={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <span class={labelClass}>Tags</span>
            <TagsInput
              value={fields.tags}
              onChange={(tags) => setField('tags', tags)}
              suggestions={props.knownTags ?? []}
            />
          </div>

          <div class="sm:col-span-2">
            <label for={`${id}-description`} class={labelClass}>Description</label>
            <input
              id={`${id}-description`}
              type="text"
              value={fields.description}
              onInput={(e) => setField('description', e.currentTarget.value)}
              placeholder="Short description"
              class={inputClass}
            />
          </div>

          <div class="sm:col-span-2">
            <label for={`${id}-hero-image`} class={labelClass}>Hero image URL (optional)</label>
            <input
              id={`${id}-hero-image`}
              type="text"
              value={fields.heroImage}
              onInput={(e) => setField('heroImage', e.currentTarget.value)}
              placeholder="https://…"
              class={inputClass}
            />
          </div>
        </div>
      </div>

      {/* ── Formatting toolbar (Write mode only) ─────────────────────────── */}
      <Show when={tab() === 'write'}>
        <div class="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
          <ToolbarButton label="B" title="Bold (wrap with **)" labelClass="font-bold" onAction={() => applyWrap('**', '**', 'bold')} />
          <ToolbarButton label="I" title="Italic (wrap with *)" labelClass="italic" onAction={() => applyWrap('*', '*', 'italic')} />
          <ToolbarButton label="S" title="Strikethrough (wrap with ~~)" labelClass="line-through" onAction={() => applyWrap('~~', '~~', 'text')} />
          <DIVIDER />
          <ToolbarButton label="H2" title="Heading 2 (prefix ##)" labelClass="font-bold font-mono" onAction={() => applyPrefix('## ')} />
          <ToolbarButton label="H3" title="Heading 3 (prefix ###)" labelClass="font-mono" onAction={() => applyPrefix('### ')} />
          <ToolbarButton label="❝" title="Blockquote (prefix >)" onAction={() => applyPrefix('> ')} />
          <DIVIDER />
          <ToolbarButton label="`code`" title="Inline code" labelClass="font-mono" onAction={() => applyWrap('`', '`', 'code')} />
          <ToolbarButton label="```block" title="Code block" labelClass="font-mono" onAction={() => applyWrap('```\n', '\n```', 'code')} />
          <DIVIDER />
          <ToolbarButton label="• list" title="Unordered list item" onAction={() => applyPrefix('- ')} />
          <ToolbarButton label="1. list" title="Ordered list item" onAction={() => applyPrefix('1. ')} />
          <DIVIDER />
          <ToolbarButton label="Link" title="Insert link" onAction={applyLink} />
          <ToolbarButton label="Image" title="Insert image" onAction={applyImage} />
        </div>
      </Show>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      <Show when={error()}>
        <div class="shrink-0 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error() instanceof Error ? (error() as Error).message : 'Something went wrong'}
        </div>
      </Show>

      {/* ── Editor / Preview ─────────────────────────────────────────────── */}
      <div class="flex flex-1 overflow-hidden">
        <Show
          when={tab() === 'write'}
          fallback={
            <div class="h-full w-full overflow-y-auto p-6">
              <article
                innerHTML={renderedHtml()}
                class="prose prose-slate prose-headings:text-[var(--text)] prose-p:text-[var(--text-muted)] prose-li:text-[var(--text-muted)] prose-strong:text-[var(--text)] prose-a:text-[var(--blue-deep)] mx-auto max-w-3xl"
              />
            </div>
          }
        >
          <textarea
            ref={textarea}
            value={fields.content}
            onInput={(e) => setField('content', e.currentTarget.value)}
            data-testid="post-content"
            placeholder="Write your post in Markdown…"
            spellcheck
            class="h-full w-full resize-none bg-[var(--bg)] p-6 font-mono text-sm leading-relaxed text-[var(--text)] outline-none"
          />
        </Show>
      </div>
    </div>
  )
}
