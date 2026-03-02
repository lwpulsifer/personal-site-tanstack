import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createWorkout, updateWorkout } from '#/server/workouts'
import type { WorkoutInstance } from '#/server/workouts'
import { WORKOUT_TYPES, type WorkoutType } from '#/lib/workout-types'
import { WORKOUTS_QUERY_KEY } from '#/lib/queries'
import dayjs from '#/lib/dayjs'

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'custom'

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Props = {
  // For new workouts, pass { date }. For editing, pass the full WorkoutInstance.
  initial: Partial<WorkoutInstance> & { date?: string }
  onClose: () => void
}

export function WorkoutForm({ initial, onClose }: Props) {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState(initial.title ?? '')
  const [type, setType] = useState<WorkoutType>((initial.type as WorkoutType) ?? 'Run')
  const [customType, setCustomType] = useState(initial.custom_type ?? '')
  const [date, setDate] = useState(
    initial.scheduled_date ?? initial.date ?? dayjs.utc().format('YYYY-MM-DD'),
  )
  const [duration, setDuration] = useState(String(initial.duration_minutes ?? ''))
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none')
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
  const [recurrenceInterval, setRecurrenceInterval] = useState('7')
  const [endAfterDays, setEndAfterDays] = useState('')

  const isEditing = !!initial.id

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleDay(day: number) {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createWorkout({
        data: {
          title: title.trim(),
          type,
          custom_type: type === 'Other' ? customType : undefined,
          date,
          duration_minutes: duration ? Number(duration) : undefined,
          notes: notes || undefined,
          recurrence,
          recurrence_days:
            recurrence === 'weekly' || recurrence === 'biweekly' ? recurrenceDays : undefined,
          recurrence_interval_days:
            recurrence === 'custom' ? Number(recurrenceInterval) : undefined,
          end_after_days: endAfterDays ? Number(endAfterDays) : undefined,
        },
      }),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateWorkout({
        data: {
          id: initial.id!,
          title: title.trim() || undefined,
          type,
          custom_type: type === 'Other' ? customType : null,
          duration_minutes: duration ? Number(duration) : null,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = createMutation.error ?? updateMutation.error

  const needsDays = recurrence === 'weekly' || recurrence === 'biweekly'
  const canSubmit = !!title.trim() && (!needsDays || recurrenceDays.length > 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (isEditing) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="island-shell w-full max-w-md rounded-[2rem] p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">
            {isEditing ? 'Edit Workout' : 'Add Workout'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1.5 text-sm text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Morning run, leg day…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              >
                {WORKOUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={isEditing}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Custom type */}
          {type === 'Other' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                Custom type label
              </label>
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="e.g. Pilates, Boxing…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Duration (minutes, optional)
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              placeholder="60"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Zone 2, tempo, easy pace…"
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>

          {/* Recurrence (new workouts only) */}
          {!isEditing && (
            <div>
              <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
                Repeat
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['none', 'daily', 'weekly', 'biweekly', 'custom'] as RecurrenceType[]).map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrence(r)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        recurrence === r
                          ? 'bg-[var(--blue-deep)] text-white'
                          : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--blue)] hover:text-[var(--text)]'
                      }`}
                    >
                      {r === 'none'
                        ? 'None'
                        : r === 'daily'
                          ? 'Daily'
                          : r === 'weekly'
                            ? 'Weekly'
                            : r === 'biweekly'
                              ? 'Biweekly'
                              : 'Custom'}
                    </button>
                  ),
                )}
              </div>

              {needsDays && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-[var(--text-muted)]">On these days:</p>
                  <div className="flex gap-1.5">
                    {DAY_NAMES.map((name, idx) => (
                      <button
                        key={DAY_FULL[idx]}
                        type="button"
                        title={DAY_FULL[idx]}
                        onClick={() => toggleDay(idx)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                          recurrenceDays.includes(idx)
                            ? 'bg-[var(--blue-deep)] text-white'
                            : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--blue)]'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrence === 'custom' && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">Every</span>
                  <input
                    type="number"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(e.target.value)}
                    min="1"
                    max="365"
                    className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">days</span>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">End after</span>
                <input
                  type="number"
                  value={endAfterDays}
                  onChange={(e) => setEndAfterDays(e.target.value)}
                  min="1"
                  max="730"
                  placeholder="90"
                  className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
                />
                <span className="text-xs text-[var(--text-muted)]">days (default: 90)</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error instanceof Error ? error.message : 'Something went wrong'}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--hover-bg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canSubmit}
              className="rounded-full bg-[var(--blue-deep)] px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isPending ? 'Saving…' : isEditing ? 'Save' : 'Add Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
