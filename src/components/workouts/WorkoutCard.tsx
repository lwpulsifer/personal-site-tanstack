import { useRef, useState } from 'react'
import { CheckCircle2, Circle, MoreVertical } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { completeWorkout, uncompleteWorkout, deleteWorkout } from '#/server/workouts'
import type { WorkoutInstance } from '#/server/workouts'
import type { StravaActivity } from '#/server/strava'
import { WORKOUT_TYPE_ABBR } from '#/lib/workout-types'
import { WORKOUTS_QUERY_KEY } from '#/lib/queries'

type Props = {
  workout: WorkoutInstance
  stravaMatch?: StravaActivity
  onEdit: (workout: WorkoutInstance) => void
}

export function WorkoutCard({ workout, stravaMatch, onEdit }: Props) {
  const queryClient = useQueryClient()
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteScope, setShowDeleteScope] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY })
  }

  const completeMutation = useMutation({
    mutationFn: (stravaActivityId?: number) =>
      completeWorkout({ data: { id: workout.id, stravaActivityId } }),
    onSuccess: invalidate,
  })

  const uncompleteMutation = useMutation({
    mutationFn: () => uncompleteWorkout({ data: { id: workout.id } }),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (scope: 'single' | 'future' | 'all') =>
      deleteWorkout({ data: { id: workout.id, scope } }),
    onSuccess: () => {
      setShowMenu(false)
      invalidate()
    },
    onError: (err) => {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed')
    },
  })

  const abbr = WORKOUT_TYPE_ABBR[workout.type] ?? 'OTH'
  const isRecurring = !!workout.template_id
  const isToggling = completeMutation.isPending || uncompleteMutation.isPending

  return (
    <div
      className={`group relative rounded-xl border bg-[var(--surface)] p-3 shadow-sm transition-all ${
        workout.completed
          ? 'border-green-500/30 opacity-60'
          : 'border-[var(--border)] hover:border-[var(--blue)]/30 hover:shadow-md'
      }`}
    >
      {/* Menu button — absolute so it never squishes content */}
      <div ref={menuRef} className="absolute right-1.5 top-1.5">
        <button
          type="button"
          onClick={() => {
            setShowMenu((v) => !v)
            setShowDeleteScope(false)
            setDeleteError(null)
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
          aria-label="Workout options"
        >
          <MoreVertical size={13} />
        </button>

          {showMenu && (
            <div className="absolute right-0 top-7 z-20 min-w-[11rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-lg">
              {!showDeleteScope ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false)
                      onEdit(workout)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteScope(true)}
                    className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    Delete…
                  </button>
                </>
              ) : (
                <>
                  <p className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">
                    Delete which?
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate('single')}
                    disabled={deleteMutation.isPending}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                  >
                    This one only
                  </button>
                  {isRecurring && (
                    <>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate('future')}
                        disabled={deleteMutation.isPending}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                      >
                        This &amp; future
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate('all')}
                        disabled={deleteMutation.isPending}
                        className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                      >
                        All in series
                      </button>
                    </>
                  )}
                  {deleteError && (
                    <p className="px-3 py-1.5 text-xs text-red-500">{deleteError}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteScope(false)
                      setShowMenu(false)
                      setDeleteError(null)
                    }}
                    className="w-full border-t border-[var(--border)] px-3 py-1.5 text-left text-xs text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
      </div>
      <div className="mt-2 flex items-start gap-2 pr-5">
        {/* Completion toggle */}
        <button
          type="button"
          onClick={() =>
            workout.completed ? uncompleteMutation.mutate() : completeMutation.mutate(undefined)
          }
          disabled={isToggling}
          className="mt-0.5 shrink-0 text-[var(--text-muted)] transition hover:text-[var(--blue)] disabled:opacity-50"
          aria-label={workout.completed ? 'Mark as not done' : 'Mark as done'}
        >
          {workout.completed ? (
            <CheckCircle2 size={15} className="text-green-500" />
          ) : (
            <Circle size={15} />
          )}
        </button>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-sm font-semibold leading-snug text-[var(--text)] ${
              workout.completed ? 'opacity-60 line-through' : ''
            }`}
          >
            {workout.title}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {abbr}
          </p>
          {(workout.duration_minutes || workout.notes) && (
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {workout.duration_minutes ? `${workout.duration_minutes}m` : ''}
              {workout.duration_minutes && workout.notes ? ' · ' : ''}
              {workout.notes}
            </p>
          )}
        </div>
      </div>

      {/* Strava match banner */}
      {stravaMatch && !workout.completed && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-orange-50 px-2.5 py-1.5 dark:bg-orange-950/30">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-orange-700 dark:text-orange-400">
              {stravaMatch.name}
              {stravaMatch.distance > 0
                ? ` · ${(stravaMatch.distance / 1000).toFixed(1)}km`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => completeMutation.mutate(stravaMatch.stravaId)}
            disabled={completeMutation.isPending}
            className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
