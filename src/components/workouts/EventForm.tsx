import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEvent, updateEvent, deleteEvent } from '#/server/events'
import type { CalendarEvent } from '#/server/events'
import { WORKOUT_TYPES, type WorkoutType } from '#/lib/workout-types'
import { EVENTS_QUERY_KEY } from '#/lib/queries'
import dayjs from '#/lib/dayjs'

type Props = {
  initial?: CalendarEvent | { date?: string }
  onClose: () => void
}

function isCalendarEvent(v: CalendarEvent | { date?: string }): v is CalendarEvent {
  return 'id' in v
}

export function EventForm({ initial, onClose }: Props) {
  const queryClient = useQueryClient()
  const existing = initial && isCalendarEvent(initial) ? initial : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [date, setDate] = useState(
    existing?.date ?? (initial && 'date' in initial ? initial.date : undefined) ?? dayjs.utc().format('YYYY-MM-DD'),
  )
  const [location, setLocation] = useState(existing?.location ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [selectedTypes, setSelectedTypes] = useState<WorkoutType[]>(
    (existing?.types as WorkoutType[]) ?? [],
  )

  const isEditing = !!existing

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function toggleType(t: WorkoutType) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    )
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createEvent({
        data: {
          name: name.trim(),
          date,
          types: selectedTypes,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateEvent({
        data: {
          id: existing!.id,
          name: name.trim(),
          date,
          types: selectedTypes,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent({ data: { id: existing!.id } }),
    onSuccess: () => {
      invalidate()
      onClose()
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const error = createMutation.error ?? updateMutation.error ?? deleteMutation.error
  const canSubmit = !!name.trim() && !!date

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
            {isEditing ? 'Edit Event' : 'Add Event'}
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
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Iron Man 70.3, Boston Marathon…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--blue)] focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Date + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Austin, TX"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
              />
            </div>
          </div>

          {/* Sport types */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">
              Sport types (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {WORKOUT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    selectedTypes.includes(t)
                      ? 'bg-amber-500 text-white'
                      : 'border border-[var(--border)] text-[var(--text-muted)] hover:border-amber-400 hover:text-[var(--text)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
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
              placeholder="Goal time, race details…"
              className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--blue)]"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error instanceof Error ? error.message : 'Something went wrong'}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {isEditing && (
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={isPending}
                className="rounded-full px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                Delete
              </button>
            )}
            <div className="ml-auto flex gap-2">
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
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-amber-600 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isPending ? 'Saving…' : isEditing ? 'Save' : 'Add Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
