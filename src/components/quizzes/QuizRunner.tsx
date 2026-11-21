import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useState } from 'react'
import { QuizItemCard } from '#/components/quizzes/QuizItemCard'
import {
  inputClass,
  primaryButton,
  secondaryButton,
  secondaryButtonSmall,
} from '#/components/quizzes/styles'
import {
  answer,
  initRanking,
  isDone,
  maxComparisons,
  nextPair,
  type RankingState,
  shuffle,
} from '#/lib/quizRanking'
import { type PublicQuiz, submitQuizResponse } from '#/server/quizzes'

type Saved = { history: RankingState[]; name: string; itemsKey: string }

const storageKey = (quizId: string) => `quiz-progress:${quizId}`

// Progress is saved per-browser so a refresh mid-quiz doesn't lose answers.
// Keyed by the item set too, so edits to the quiz invalidate stale progress.
function loadSaved(quizId: string, itemsKey: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(quizId))
    if (!raw) return null
    const saved = JSON.parse(raw) as Saved
    return saved.itemsKey === itemsKey && saved.history.length > 0
      ? saved
      : null
  } catch {
    return null
  }
}

function persist(quizId: string, saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(storageKey(quizId), JSON.stringify(saved))
    else localStorage.removeItem(storageKey(quizId))
  } catch {
    // Storage unavailable (private mode etc.) — progress just isn't saved.
  }
}

function sideHash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

type Phase = 'intro' | 'comparing' | 'submitting' | 'thanks'

export function QuizRunner({
  quiz,
  keyword,
}: {
  quiz: PublicQuiz
  keyword: string
}) {
  const nameId = useId()
  const itemsById = useMemo(
    () => new Map(quiz.items.map((i) => [i.id, i])),
    [quiz.items],
  )
  const itemsKey = useMemo(
    () =>
      quiz.items
        .map((i) => i.id)
        .sort()
        .join(','),
    [quiz.items],
  )

  const [phase, setPhase] = useState<Phase>('intro')
  const [name, setName] = useState('')
  // Stack of states; the last is current. Undo pops.
  const [history, setHistory] = useState<RankingState[]>([])
  const [hasSaved, setHasSaved] = useState(false)

  useEffect(() => {
    const saved = loadSaved(quiz.id, itemsKey)
    if (saved) {
      setHasSaved(true)
      setName(saved.name)
    }
  }, [quiz.id, itemsKey])

  const state = history.at(-1)
  const pair = state ? nextPair(state) : null

  const submit = useMutation({
    mutationFn: (final: RankingState) =>
      submitQuizResponse({
        data: {
          keyword,
          respondentName: name.trim() || undefined,
          ordering: final.sorted,
          comparisons: final.comparisons,
        },
      }),
    onSuccess: () => {
      persist(quiz.id, null)
      setPhase('thanks')
    },
  })

  function start(resume: boolean) {
    const saved = resume ? loadSaved(quiz.id, itemsKey) : null
    const initial = saved?.history ?? [
      initRanking(shuffle(quiz.items.map((i) => i.id))),
    ]
    setHistory(initial)
    const first = initial.at(-1) as RankingState
    if (isDone(first)) {
      setPhase('submitting')
      submit.mutate(first)
    } else {
      setPhase('comparing')
    }
  }

  function pick(winnerId: string) {
    if (!state) return
    const next = answer(state, winnerId)
    const nextHistory = [...history, next]
    setHistory(nextHistory)
    if (isDone(next)) {
      persist(quiz.id, null)
      setPhase('submitting')
      submit.mutate(next)
    } else {
      persist(quiz.id, { history: nextHistory, name, itemsKey })
    }
  }

  function undo() {
    if (history.length <= 1) return
    const nextHistory = history.slice(0, -1)
    setHistory(nextHistory)
    persist(quiz.id, { history: nextHistory, name, itemsKey })
  }

  if (phase === 'thanks') {
    return (
      <section
        data-testid="quiz-thanks"
        className="island-shell rise-in mx-auto max-w-xl rounded-2xl p-8 text-center"
      >
        <p className="island-kicker mb-2">All done</p>
        <h1 className="display-title m-0 text-4xl font-bold text-[var(--text)]">
          Thanks!
        </h1>
        <p className="mt-3 text-[var(--text-muted)]">
          Your answers have been saved. You can close this page.
        </p>
      </section>
    )
  }

  if (phase === 'intro') {
    const total = maxComparisons(quiz.items.length)
    return (
      <section className="island-shell rise-in mx-auto max-w-xl rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Quiz</p>
        <h1 className="display-title m-0 text-3xl font-bold text-[var(--text)] sm:text-4xl">
          {quiz.title}
        </h1>
        {quiz.description && (
          <p className="mt-3 whitespace-pre-wrap text-[var(--text-muted)]">
            {quiz.description}
          </p>
        )}
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          You'll be shown two options at a time — just pick the one you'd
          prefer. {quiz.items.length} items, at most {total} choices.
        </p>
        <label
          htmlFor={nameId}
          className="mb-1 mt-5 block text-xs font-semibold text-[var(--text-muted)]"
        >
          Your name (optional)
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          data-testid="quiz-name-input"
          className={inputClass}
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {hasSaved && (
            <button
              type="button"
              onClick={() => start(true)}
              className={primaryButton}
            >
              Resume where you left off
            </button>
          )}
          <button
            type="button"
            data-testid="quiz-start"
            onClick={() => start(false)}
            className={hasSaved ? secondaryButton : primaryButton}
          >
            {hasSaved ? 'Start over' : 'Start'}
          </button>
        </div>
      </section>
    )
  }

  if (phase === 'submitting' || !state || !pair) {
    if (submit.isError && state) {
      return (
        <section className="mx-auto max-w-xl text-center">
          <p className="text-red-600 dark:text-red-400">
            Couldn't save your answers: {submit.error.message}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => submit.mutate(state)}
              className={primaryButton}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={secondaryButton}
            >
              Start over
            </button>
          </div>
        </section>
      )
    }
    return (
      <p className="text-center text-[var(--text-muted)]">
        Saving your answers…
      </p>
    )
  }

  // The item being inserted is always pair[0]; flip sides pseudo-randomly
  // (stable across re-renders) so position doesn't bias the picks.
  const [a, b] = sideHash(pair[0] + pair[1]) % 2 ? [pair[1], pair[0]] : pair
  const done = state.comparisons.length
  const max = maxComparisons(quiz.items.length)
  // Fraction of items placed — comparisons/max would overestimate the total.
  const progress = Math.min(
    1,
    state.sorted.length / Math.max(1, quiz.items.length),
  )

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
        <span>
          Choice {done + 1} <span className="opacity-70">(at most {max})</span>
        </span>
        <button
          type="button"
          onClick={undo}
          disabled={history.length <= 1}
          className={secondaryButtonSmall}
        >
          Undo
        </button>
      </div>
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--blue-deep)] transition-[width]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <h2 className="mb-4 text-center text-lg font-semibold text-[var(--text)]">
        Which would you prefer?
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[a, b].map((id) => {
          const item = itemsById.get(id)
          if (!item) return null
          return (
            <button
              key={`${done}-${id}`}
              type="button"
              data-testid="quiz-option"
              onClick={() => pick(id)}
              className="feature-card rise-in rounded-2xl border border-[var(--chip-border)] bg-[var(--surface-strong)] p-5 text-left text-[var(--text)] outline-none transition hover:-translate-y-0.5 hover:border-[var(--blue)] focus-visible:border-[var(--blue)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40"
            >
              <QuizItemCard item={item} />
            </button>
          )
        })}
      </div>
    </section>
  )
}
