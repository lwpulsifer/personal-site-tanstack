import { createFileRoute, redirect } from '@tanstack/react-router'
import { ErrorBoundary } from '#/components/ErrorBoundary'
import { QuizRunner } from '#/components/quizzes/QuizRunner'
import { SITE_TITLE } from '#/lib/site'
import { getQuizByKeyword } from '#/server/quizzes'

export const Route = createFileRoute('/quizzes/$keyword')({
  loader: async ({ params }) => {
    const quiz = await getQuizByKeyword({ data: { keyword: params.keyword } })
    if (!quiz) throw redirect({ to: '/quizzes', search: { notFound: true } })
    return quiz
  },
  // Don't keep a quiz in the router cache — closing it should take effect.
  staleTime: 0,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? 'Quiz'} | ${SITE_TITLE}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  errorComponent: ({ error }) => (
    <main className="page-wrap px-4 pb-8 pt-14">
      <p className="text-center text-red-600 dark:text-red-400">
        {error instanceof Error ? error.message : 'Something went wrong.'}
      </p>
    </main>
  ),
  component: QuizPage,
})

function QuizPage() {
  const quiz = Route.useLoaderData()
  const { keyword } = Route.useParams()
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <ErrorBoundary>
        <QuizRunner quiz={quiz} keyword={keyword} />
      </ErrorBoundary>
    </main>
  )
}
