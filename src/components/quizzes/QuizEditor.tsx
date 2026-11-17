import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { getSupabaseBrowserClient } from '#/lib/supabase'
import {
  type AdminQuizDetail,
  type DbQuiz,
  deleteQuiz,
  upsertQuiz,
} from '#/server/quizzes'

type EditorItem = {
  /** Stable React key; also the DB id for existing items. */
  key: string
  id?: string
  secret_label: string
  description: string
  image_url: string
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]'
const labelClass = 'mb-1 block text-xs font-semibold text-[var(--text-muted)]'

function newItem(): EditorItem {
  return {
    key: crypto.randomUUID(),
    secret_label: '',
    description: '',
    image_url: '',
  }
}

/** First image file in a paste/drop, if any (ignores plain text pastes). */
function imageFrom(data: DataTransfer | null): File | undefined {
  return Array.from(data?.files ?? []).find((f) => f.type.startsWith('image/'))
}

async function uploadImage(file: File): Promise<string> {
  const supabase = getSupabaseBrowserClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('quiz-images')
    .upload(path, file, { contentType: file.type })
  if (error) throw new Error(error.message)
  return supabase.storage.from('quiz-images').getPublicUrl(path).data.publicUrl
}

export function QuizEditor({
  initial,
  onSaved,
  onDeleted,
}: {
  initial?: AdminQuizDetail
  onSaved: (quiz: DbQuiz) => void
  onDeleted?: () => void
}) {
  const id = useId()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [keyword, setKeyword] = useState(initial?.keyword ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isOpen, setIsOpen] = useState(initial?.is_open ?? true)
  const [items, setItems] = useState<EditorItem[]>(
    initial?.items.map((i) => ({
      key: i.id,
      id: i.id,
      secret_label: i.secret_label ?? '',
      description: i.description ?? '',
      image_url: i.image_url ?? '',
    })) ?? [newItem(), newItem()],
  )
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useMutation({
    mutationFn: () =>
      upsertQuiz({
        data: {
          id: initial?.id,
          title,
          keyword,
          description,
          is_open: isOpen,
          items: items.map(({ id, secret_label, description, image_url }) => ({
            id,
            secret_label,
            description,
            image_url,
          })),
        },
      }),
    onSuccess: onSaved,
  })

  const remove = useMutation({
    mutationFn: () => deleteQuiz({ data: { quizId: initial?.id as string } }),
    onSuccess: () => onDeleted?.(),
  })

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    )
  }

  function moveItem(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function handleFile(key: string, file: File | undefined) {
    if (!file) return
    setUploading(key)
    setUploadError(null)
    try {
      updateItem(key, { image_url: await uploadImage(file) })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const blankCount = items.filter(
    (i) => !i.description.trim() && !i.image_url.trim(),
  ).length
  const hasResponses = (initial?.responses.length ?? 0) > 0
  const canSave =
    title.trim() && keyword.trim() && items.length >= 2 && !uploading

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave) save.mutate()
      }}
      className="island-shell rounded-2xl p-5 sm:p-6"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-title`} className={labelClass}>
            Title (shown to visitors)
          </label>
          <input
            id={`${id}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="quiz-title-input"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor={`${id}-keyword`} className={labelClass}>
            Keyword (case-insensitive)
          </label>
          <input
            id={`${id}-keyword`}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            autoComplete="off"
            data-testid="quiz-keyword-input"
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-3">
        <label htmlFor={`${id}-description`} className={labelClass}>
          Intro (optional, shown to visitors)
        </label>
        <textarea
          id={`${id}-description`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(e) => setIsOpen(e.target.checked)}
        />
        Open — visitors can take this quiz
      </label>

      <h2 className="mb-2 mt-6 text-base font-semibold text-[var(--text)]">
        Items ({items.length})
      </h2>
      {hasResponses && (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
          This quiz already has responses. Removed items will show as "(deleted
          item)" in old results, and anyone mid-quiz will be asked to start
          over.
        </p>
      )}
      <ol className="m-0 list-none space-y-3 p-0">
        {items.map((item, index) => (
          <li
            key={item.key}
            data-testid="quiz-item-row"
            // Pasting an image anywhere in the row (e.g. while typing its
            // description) uploads it as this item's picture. Text pastes
            // fall through untouched.
            onPaste={(e) => {
              const file = imageFrom(e.clipboardData)
              if (!file) return
              e.preventDefault()
              handleFile(item.key, file)
            }}
            className="rounded-xl border border-[var(--border)] p-3"
          >
            <div className="flex gap-3">
              <div className="flex w-24 flex-shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  aria-label={`Item ${index + 1} picture — click to choose, or paste/drop an image`}
                  title="Click to choose a file, or paste/drop an image"
                  onClick={() =>
                    document.getElementById(`${id}-file-${item.key}`)?.click()
                  }
                  data-testid="quiz-item-picture"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(item.key)
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(null)
                    handleFile(item.key, imageFrom(e.dataTransfer))
                  }}
                  className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-[var(--chip-bg)] outline-none ring-[var(--blue)] focus:ring-2 ${
                    dragOver === item.key ? 'ring-2' : ''
                  }`}
                >
                  {uploading === item.key ? (
                    <span className="text-xs text-[var(--text-muted)]">
                      Uploading…
                    </span>
                  ) : item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="px-1 text-center text-[11px] leading-tight text-[var(--text-muted)]">
                      Click, paste or drop a picture
                    </span>
                  )}
                </button>
                <input
                  id={`${id}-file-${item.key}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(item.key, e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                {item.image_url && (
                  <button
                    type="button"
                    onClick={() => updateItem(item.key, { image_url: '' })}
                    className="text-xs text-[var(--text-muted)]"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  aria-label={`Item ${index + 1} secret label`}
                  placeholder="Secret label — only you see this (e.g. “Kindle Paperwhite”)"
                  value={item.secret_label}
                  onChange={(e) =>
                    updateItem(item.key, { secret_label: e.target.value })
                  }
                  className={inputClass}
                />
                <textarea
                  aria-label={`Item ${index + 1} description`}
                  placeholder="Description visitors see (e.g. “Something to read with”)"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(item.key, { description: e.target.value })
                  }
                  rows={2}
                  className={inputClass}
                />
                <input
                  aria-label={`Item ${index + 1} image URL`}
                  placeholder="…or paste an image URL"
                  value={item.image_url}
                  onChange={(e) =>
                    updateItem(item.key, { image_url: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className="rounded border border-[var(--border)] px-2 py-0.5 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded border border-[var(--border)] px-2 py-0.5 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() =>
                    setItems((prev) => prev.filter((i) => i.key !== item.key))
                  }
                  className="rounded border border-[var(--border)] px-2 py-0.5 text-red-600"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        data-testid="quiz-add-item"
        onClick={() => setItems((prev) => [...prev, newItem()])}
        className="mt-3 rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-semibold text-[var(--text)]"
      >
        + Add item
      </button>

      {uploadError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          Image upload failed: {uploadError}
        </p>
      )}
      {blankCount > 0 && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          {blankCount} item{blankCount === 1 ? ' has' : 's have'} no picture or
          description — visitors will see a blank card.
        </p>
      )}
      {items.length < 2 && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          A quiz needs at least two items.
        </p>
      )}
      {save.isError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {save.error.message}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!canSave || save.isPending}
          data-testid="quiz-save"
          className="rounded-full bg-[var(--blue-deep)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save quiz'}
        </button>
        {initial && onDeleted && (
          <div className="ml-auto flex items-center gap-2">
            {confirmDelete ? (
              <>
                <span className="text-sm text-[var(--text-muted)]">
                  Delete quiz and all responses?
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-full border border-red-500/40 px-4 py-1.5 text-sm font-semibold text-red-600"
              >
                Delete quiz
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
