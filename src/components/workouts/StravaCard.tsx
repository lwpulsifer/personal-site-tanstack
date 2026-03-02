import type { StravaActivity } from '#/server/strava'

type Props = {
  activity: StravaActivity
}

/** Standalone card for a Strava activity that has no matching planned workout. */
export function StravaCard({ activity }: Props) {
  const km = activity.distance > 0 ? `${(activity.distance / 1000).toFixed(1)}km` : null
  const duration =
    activity.movingTime > 0
      ? activity.movingTime >= 3600
        ? `${Math.floor(activity.movingTime / 3600)}h ${Math.floor((activity.movingTime % 3600) / 60)}m`
        : `${Math.floor(activity.movingTime / 60)}m`
      : null

  return (
    <div className="rounded-xl border border-orange-200/60 bg-orange-50/60 p-3 dark:border-orange-800/40 dark:bg-orange-950/20">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{activity.name}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {activity.type}
            {km ? ` · ${km}` : ''}
            {duration ? ` · ${duration}` : ''}
          </p>
        </div>
        <a
          href={`https://www.strava.com/activities/${activity.stravaId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] font-semibold text-orange-600 hover:underline dark:text-orange-400"
          aria-label={`View ${activity.name} on Strava`}
        >
          Strava ↗
        </a>
      </div>
    </div>
  )
}
