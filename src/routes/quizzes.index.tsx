import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import {
  inputClass,
  primaryButton,
  primaryButtonSmall,
} from '#/components/quizzes/styles'
import { useAuth } from '#/lib/auth'
import { adminQuizzesQueryOptions } from '#/lib/queries'
import { SITE_TITLE } from '#/lib/site'

const pageTitle = `Quizzes | ${SITE_TITLE}`

export const Route = createFileRoute('/quizzes/')({
  validateSearch: (search: Record<string, unknown>): { notFound?: boolean } =>
    // Set when /quizzes/$keyword didn't match, so we can say so here.
    search.notFound === true || search.notFound === 'true'
      ? { notFound: true }
      : {},
  head: () => ({
    meta: [{ title: pageTitle }, { name: 'robots', content: 'noindex' }],
  }),
  component: QuizzesIndex,
})

function QuizzesIndex() {
  const { isAuthenticated } = useAuth()
  const { notFound } = Route.useSearch()
  const navigate = useNavigate()
  const inputId = useId()
  const [keyword, setKeyword] = useState('')

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in mx-auto max-w-md rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Quizzes</p>
        <h1 className="display-title m-0 text-3xl font-bold text-[var(--text)] sm:text-4xl">
          Got a keyword?
        </h1>
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault()
            const k = keyword.trim()
            if (k) navigate({ to: '/quizzes/$keyword', params: { keyword: k } })
          }}
        >
          <label
            htmlFor={inputId}
            className="mb-1 block text-xs font-semibold text-[var(--text-muted)]"
          >
            Keyword
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              data-testid="quiz-keyword-entry"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <button
              type="submit"
              disabled={!keyword.trim()}
              className={primaryButton}
            >
              Go
            </button>
          </div>
          {notFound && (
            <p
              data-testid="quiz-not-found"
              className="mt-2 text-sm text-red-600 dark:text-red-400"
            >
              No quiz found for that keyword.
            </p>
          )}
        </form>
      </section>

      {isAuthenticated && <AdminQuizList />}
    </main>
  )
}

function AdminQuizList() {
  const { data: quizzes, isLoading, error } = useQuery(adminQuizzesQueryOptions)

  return (
    <section className="mx-auto mt-10 max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-lg font-semibold text-[var(--text)]">
          Your quizzes
        </h2>
        <Link
          to="/quizzes/admin/new"
          data-testid="quiz-new"
          className={primaryButtonSmall}
        >
          New quiz
        </Link>
      </div>
      {isLoading && (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}
      {quizzes && quizzes.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">No quizzes yet.</p>
      )}
      <ul className="m-0 list-none space-y-2 p-0">
        {quizzes?.map((q) => (
          <li key={q.id}>
            <Link
              to="/quizzes/admin/$quizId"
              params={{ quizId: q.id }}
              className="feature-card flex items-center justify-between gap-3 rounded-xl border border-[var(--chip-border)] bg-[var(--surface-strong)] px-4 py-3 no-underline"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[var(--text)]">
                  {q.title}
                </span>
                <span className="block text-xs text-[var(--text-muted)]">
                  keyword <code>{q.keyword}</code> · {q.item_count} items
                  {!q.is_open && ' · closed'}
                </span>
              </span>
              <span className="flex-shrink-0 text-sm text-[var(--text-muted)]">
                {q.response_count} response{q.response_count === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
