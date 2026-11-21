import { useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
} from '@tanstack/react-router'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { QuizEditor } from '#/components/quizzes/QuizEditor'
import { adminQuizzesQueryOptions } from '#/lib/queries'
import { SITE_TITLE } from '#/lib/site'
import { getServerUser } from '#/server/auth'

export const Route = createFileRoute('/quizzes/admin/new')({
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw notFound()
  },
  head: () => ({
    meta: [
      { title: `New quiz | ${SITE_TITLE}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: NewQuizPage,
})

function NewQuizPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <Link to="/quizzes" className="text-sm text-[var(--text-muted)]">
        ← Quizzes
      </Link>
      <h1 className="display-title mb-6 mt-2 text-3xl font-bold text-[var(--text)]">
        New quiz
      </h1>
      <ErrorBoundary>
        <QuizEditor
          onSaved={(quiz) => {
            queryClient.invalidateQueries({
              queryKey: adminQuizzesQueryOptions.queryKey,
            })
            navigate({
              to: '/quizzes/admin/$quizId',
              params: { quizId: quiz.id },
            })
          }}
        />
      </ErrorBoundary>
    </main>
  )
}
