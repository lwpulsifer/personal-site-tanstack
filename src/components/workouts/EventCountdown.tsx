import type { CalendarEvent } from '#/server/events'
import { WORKOUT_TYPE_ABBR, type WorkoutType } from '#/lib/workout-types'
import dayjs from '#/lib/dayjs'

type Props = {
  events: CalendarEvent[]
}

export function EventCountdown({ events }: Props) {
  const today = dayjs.utc().format('YYYY-MM-DD')

  const next = events
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  if (!next) return null

  const isToday = next.date === today
  const daysUntil = dayjs.utc(next.date).diff(dayjs.utc(today), 'day')
  const weeks = Math.floor(daysUntil / 7)
  const days = daysUntil % 7

  let countdown: string
  if (weeks === 0) {
    countdown = `${days} day${days !== 1 ? 's' : ''}`
  } else if (days === 0) {
    countdown = `${weeks} week${weeks !== 1 ? 's' : ''}`
  } else {
    countdown = `${weeks} week${weeks !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}`
  }

  const typeAbbrs = (next.types as WorkoutType[])
    .map((t) => WORKOUT_TYPE_ABBR[t])
    .join(' · ')

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-3.5 dark:bg-amber-900/20">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-base font-bold text-amber-800 dark:text-amber-300">
          ★ {next.name}
        </span>
        {typeAbbrs && (
          <span className="text-xs font-semibold tracking-wide text-amber-600 dark:text-amber-400">
            {typeAbbrs}
          </span>
        )}
        {next.location && (
          <span className="text-xs text-amber-600 dark:text-amber-400">{next.location}</span>
        )}
      </div>
      <span className="shrink-0 text-sm font-bold text-amber-700 dark:text-amber-300">
        {isToday ? "Today is the day — " + next.name + "!" : countdown}
      </span>
    </div>
  )
}
