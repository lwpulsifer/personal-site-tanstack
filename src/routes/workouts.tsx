import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getServerUser } from '#/server/auth'
import { workoutsQueryOptions, stravaActivitiesQueryOptions, eventsQueryOptions } from '#/lib/queries'
import { getMondayOfWeek, addDays } from '#/lib/date-utils'
import { queryClient } from '#/router'
import { WeeklyCalendar } from '#/components/workouts/WeeklyCalendar'
import { EventCountdown } from '#/components/workouts/EventCountdown'

export const Route = createFileRoute('/workouts')({
  loader: async () => {
    const user = await getServerUser()
    if (!user) throw redirect({ to: '/login' })

    // Prefetch the current week so the component renders without a loading state.
    const startDate = getMondayOfWeek()
    const endDate = addDays(startDate, 6)

    await Promise.all([
      queryClient.ensureQueryData(workoutsQueryOptions(startDate)),
      queryClient.ensureQueryData(eventsQueryOptions),
      // Strava is optional — don't block the page if it fails or isn't configured.
      queryClient.prefetchQuery(stravaActivitiesQueryOptions(startDate, endDate)),
    ])

    return {}
  },
  head: () => ({ meta: [{ title: 'Workouts' }] }),
  component: WorkoutsPage,
})

function WorkoutsPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const startDate = getMondayOfWeek(weekOffset)
  const endDate = addDays(startDate, 6)

  // For weekOffset=0 these are already in cache from the loader — no loading state.
  const workoutsQuery = useQuery(workoutsQueryOptions(startDate))
  const stravaQuery = useQuery(stravaActivitiesQueryOptions(startDate, endDate))
  const eventsQuery = useQuery(eventsQueryOptions)

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <div className="mb-6">
        <p className="island-kicker mb-2">Planning</p>
        <h1 className="display-title m-0 text-4xl font-bold tracking-tight text-[var(--text)] sm:text-5xl">
          Workouts
        </h1>
      </div>

      <EventCountdown events={eventsQuery.data ?? []} />

      {workoutsQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-[var(--text-muted)]">
          Loading…
        </div>
      ) : workoutsQuery.isError ? (
        <div className="rounded-xl bg-red-50 p-6 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {workoutsQuery.error instanceof Error
            ? workoutsQuery.error.message
            : 'Failed to load workouts'}
        </div>
      ) : (
        <WeeklyCalendar
          workouts={workoutsQuery.data ?? []}
          stravaActivities={stravaQuery.data ?? []}
          events={eventsQuery.data ?? []}
          startDate={startDate}
          onWeekChange={(delta) => setWeekOffset((prev) => prev + delta)}
        />
      )}
    </main>
  )
}
