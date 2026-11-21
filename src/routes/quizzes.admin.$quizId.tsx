import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { useState } from 'react'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { QuizEditor } from '#/components/quizzes/QuizEditor'
import { QuizResults } from '#/components/quizzes/QuizResults'
import {
  primaryButtonSmall,
  secondaryButton,
} from '#/components/quizzes/styles'
import { adminQuizQueryOptions, adminQuizzesQueryOptions } from '#/lib/queries'
import { SITE_TITLE } from '#/lib/site'
import { getServerUser } from '#/server/auth'
import { getAdminQuiz } from '#/server/quizzes'

export const Route = createFileRoute('/quizzes/admin/$quizId')({
  // Admin-only; 404 for everyone else, like /people.
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw notFound()
  },
  loader: async ({ params }) => {
    const quiz = await getAdminQuiz({ data: { quizId: params.quizId } })
    if (!quiz) throw notFound()
    return quiz
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? 'Quiz'} (admin) | ${SITE_TITLE}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AdminQuizPage,
})

function AdminQuizPage() {
  const initial = Route.useLoaderData()
  const { data: quiz } = useQuery({
    ...adminQuizQueryOptions(initial.id),
    initialData: initial,
  })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  // Bumped after each save so the editor remounts with fresh item ids.
  const [editorVersion, setEditorVersion] = useState(0)

  if (!quiz) return null

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: adminQuizzesQueryOptions.queryKey,
    })

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <Link to="/quizzes" className="text-sm text-[var(--text-muted)]">
        ← Quizzes
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-title m-0 text-3xl font-bold text-[var(--text)]">
            {quiz.title}
          </h1>
          <p className="m-0 mt-1 text-sm text-[var(--text-muted)]">
            Keyword <code>{quiz.keyword}</code> · {quiz.items.length} items ·{' '}
            {quiz.is_open ? 'open' : 'closed'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/quizzes/$keyword"
            params={{ keyword: quiz.keyword }}
            className={secondaryButton}
          >
            Try it
          </Link>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            data-testid="quiz-edit-toggle"
            className={primaryButtonSmall}
          >
            {editing ? 'Close editor' : 'Edit quiz'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mb-8">
          <ErrorBoundary>
            <QuizEditor
              key={editorVersion}
              initial={quiz}
              onSaved={async () => {
                await invalidate()
                setEditorVersion((v) => v + 1)
                setEditing(false)
              }}
              onDeleted={() => {
                invalidate()
                navigate({ to: '/quizzes' })
              }}
            />
          </ErrorBoundary>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-[var(--text)]">Results</h2>
      <ErrorBoundary>
        <QuizResults quiz={quiz} onChanged={invalidate} />
      </ErrorBoundary>
    </main>
  )
}
