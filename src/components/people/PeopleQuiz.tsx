import { useCallback, useMemo, useState } from 'react'
import { CONNECTION_KIND_OPTIONS } from '#/lib/connectionKind'
import type { ConnectionKind, DbConnection, DbPerson } from '#/server/people'

function pickRandomConnection(
  connections: DbConnection[],
  excludeId: string | null,
) {
  if (connections.length === 0) return null
  if (connections.length === 1) return connections[0]
  let candidate = connections[Math.floor(Math.random() * connections.length)]
  // A handful of retries is enough to avoid immediate repeats without risking
  // an infinite loop on a small connection list.
  for (let attempt = 0; candidate.id === excludeId && attempt < 10; attempt++) {
    candidate = connections[Math.floor(Math.random() * connections.length)]
  }
  return candidate
}

const answerButtonBaseClassName =
  'rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-default'

export function PeopleQuiz({
  people,
  connections,
}: {
  people: DbPerson[]
  connections: DbConnection[]
}) {
  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const [current, setCurrent] = useState<DbConnection | null>(() =>
    pickRandomConnection(connections, null),
  )
  const [answer, setAnswer] = useState<ConnectionKind | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const nextQuestion = useCallback(() => {
    setCurrent((prev) => pickRandomConnection(connections, prev?.id ?? null))
    setAnswer(null)
  }, [connections])

  const handleAnswer = useCallback(
    (kind: ConnectionKind) => {
      if (!current || answer) return
      setAnswer(kind)
      setScore((prev) => ({
        correct: prev.correct + (kind === current.kind ? 1 : 0),
        total: prev.total + 1,
      }))
    },
    [current, answer],
  )

  if (connections.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">
          No connections yet — add some on the Graph tab first, then come back
          to quiz yourself.
        </p>
      </div>
    )
  }

  if (!current) return null

  const nameA = peopleById.get(current.person_a_id)?.name ?? 'Unknown'
  const nameB = peopleById.get(current.person_b_id)?.name ?? 'Unknown'
  const isAnswered = answer != null
  const isCorrect = answer === current.kind

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <p
        data-testid="quiz-score"
        className="mb-4 text-center text-xs font-semibold text-[var(--text-muted)]"
      >
        Score: {score.correct} / {score.total}
      </p>

      <p
        data-testid="quiz-question"
        className="mb-4 text-center text-lg font-semibold text-[var(--text)]"
      >
        How are <span className="text-[var(--blue-deep)]">{nameA}</span> and{' '}
        <span className="text-[var(--blue-deep)]">{nameB}</span> related?
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {CONNECTION_KIND_OPTIONS.map((opt) => {
          const isThisCorrect = opt.value === current.kind
          const isThisPicked = opt.value === answer
          const stateClassName = !isAnswered
            ? 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--hover-bg)]'
            : isThisCorrect
              ? 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400'
              : isThisPicked
                ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                : 'border-[var(--border)] text-[var(--text-muted)] opacity-60'
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleAnswer(opt.value)}
              disabled={isAnswered}
              data-testid="quiz-answer-btn"
              className={`${answerButtonBaseClassName} ${stateClassName}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {isAnswered && (
        <div className="mb-4 text-center">
          <p
            data-testid="quiz-feedback"
            className={`text-sm font-semibold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {isCorrect
              ? 'Correct!'
              : `Not quite — they're ${CONNECTION_KIND_OPTIONS.find((o) => o.value === current.kind)?.label}.`}
          </p>
          {current.label && (
            <p className="mt-1 text-xs italic text-[var(--text-muted)]">
              "{current.label}"
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={nextQuestion}
        disabled={!isAnswered}
        data-testid="quiz-next-btn"
        className="w-full rounded-full bg-[var(--blue-deep)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
      >
        Next question
      </button>
    </div>
  )
}
