import { createFileRoute, notFound } from '@tanstack/react-router'
import { PeopleQuiz } from '#/components/people/PeopleQuiz'
import { PeopleTabs } from '#/components/people/PeopleTabs'
import { SITE_TITLE } from '#/lib/site'
import { getServerUser } from '#/server/auth'
import { getPeopleGraph } from '#/server/people'

const pageTitle = `People Quiz | ${SITE_TITLE}`

export const Route = createFileRoute('/people/quiz')({
  // Same admin-only guard as /people — a 404 rather than a login redirect
  // for anyone unauthenticated.
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw notFound()
  },
  loader: async () => getPeopleGraph(),
  head: () => ({
    meta: [{ title: pageTitle }, { name: 'robots', content: 'noindex' }],
  }),
  component: PeopleQuizPage,
})

function PeopleQuizPage() {
  const { people, connections } = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="mb-6">
        <p className="island-kicker mb-2">Admin</p>
        <h1
          data-testid="people-quiz-heading"
          className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl"
        >
          People Quiz
        </h1>
      </section>

      <PeopleTabs />

      <PeopleQuiz people={people} connections={connections} />
    </main>
  )
}
