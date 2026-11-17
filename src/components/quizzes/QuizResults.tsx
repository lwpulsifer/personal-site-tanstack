import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { aggregateOrderings } from '#/lib/quizRanking'
import {
  type AdminQuizDetail,
  type DbQuizItem,
  deleteQuizResponse,
} from '#/server/quizzes'

function ItemLabel({ item }: { item: DbQuizItem | undefined }) {
  if (!item) {
    return (
      <span className="italic text-[var(--text-muted)]">(deleted item)</span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-3">
      {item.image_url ? (
        <a
          href={item.image_url}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0"
          title="Open full-size picture"
        >
          <img
            src={item.image_url}
            alt={item.secret_label ?? item.description ?? ''}
            loading="lazy"
            className="h-16 w-16 rounded-lg bg-[var(--chip-bg)] object-contain"
          />
        </a>
      ) : (
        <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--chip-bg)] text-[10px] text-[var(--text-muted)]">
          No picture
        </span>
      )}
      <span className="min-w-0">
        <span
          data-testid="quiz-result-label"
          className="block truncate font-medium text-[var(--text)]"
        >
          {item.secret_label || item.description || '(untitled)'}
        </span>
        {item.secret_label && item.description && (
          <span className="block truncate text-xs text-[var(--text-muted)]">
            {item.description}
          </span>
        )}
      </span>
    </span>
  )
}

function RankNumber({ n }: { n: number }) {
  return (
    <span className="w-6 flex-shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--text-muted)]">
      {n}.
    </span>
  )
}

export function QuizResults({
  quiz,
  onChanged,
}: {
  quiz: AdminQuizDetail
  onChanged: () => void
}) {
  const itemsById = useMemo(
    () => new Map(quiz.items.map((i) => [i.id, i])),
    [quiz.items],
  )
  const aggregate = useMemo(
    () => aggregateOrderings(quiz.responses.map((r) => r.ordering)),
    [quiz.responses],
  )
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: (responseId: string) =>
      deleteQuizResponse({ data: { responseId } }),
    onSuccess: () => {
      setConfirmingId(null)
      onChanged()
    },
  })

  if (quiz.responses.length === 0) {
    return (
      <p
        className="text-sm text-[var(--text-muted)]"
        data-testid="quiz-no-responses"
      >
        No responses yet. Share <strong>/quizzes</strong> and the keyword{' '}
        <code>{quiz.keyword}</code>.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {quiz.responses.length > 1 && (
        <section className="island-shell rounded-2xl p-5">
          <h3 className="m-0 mb-3 text-base font-semibold text-[var(--text)]">
            Combined ({quiz.responses.length} responses, by average rank)
          </h3>
          <ol className="m-0 list-none space-y-2 p-0">
            {aggregate.map((row, index) => (
              <li key={row.id} className="text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <RankNumber n={index + 1} />
                    <ItemLabel item={itemsById.get(row.id)} />
                  </span>
                  <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                    avg #{row.averageRank.toFixed(1)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {quiz.responses.map((response) => (
        <section
          key={response.id}
          data-testid="quiz-response"
          className="island-shell rounded-2xl p-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-base font-semibold text-[var(--text)]">
              {response.respondent_name || 'Anonymous'}
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(response.completed_at).toLocaleString()} ·{' '}
              {Array.isArray(response.comparisons)
                ? response.comparisons.length
                : 0}{' '}
              choices
            </span>
          </div>
          <ol className="m-0 list-none space-y-2 p-0">
            {response.ordering.map((itemId, index) => (
              <li key={itemId} className="flex items-center gap-3 text-sm">
                <RankNumber n={index + 1} />
                <ItemLabel item={itemsById.get(itemId)} />
              </li>
            ))}
          </ol>
          <div className="mt-3 text-right">
            {confirmingId === response.id ? (
              <span className="inline-flex items-center gap-2 text-xs">
                Delete this response?
                <button
                  type="button"
                  onClick={() => remove.mutate(response.id)}
                  disabled={remove.isPending}
                  className="font-semibold text-red-600"
                >
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmingId(null)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingId(response.id)}
                className="text-xs text-[var(--text-muted)] hover:text-red-600"
              >
                Delete response
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
