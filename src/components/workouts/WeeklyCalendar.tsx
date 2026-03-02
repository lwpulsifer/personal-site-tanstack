import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveWorkout } from '#/server/workouts'
import { WORKOUTS_QUERY_KEY } from '#/lib/queries'
import type { WorkoutInstance } from '#/server/workouts'
import type { StravaActivity } from '#/server/strava'
import type { CalendarEvent } from '#/server/events'
import dayjs from '#/lib/dayjs'
import { WorkoutCard } from './WorkoutCard'
import { StravaCard } from './StravaCard'
import { WorkoutForm } from './WorkoutForm'
import { EventForm } from './EventForm'

type Props = {
  workouts: WorkoutInstance[]
  stravaActivities: StravaActivity[]
  events: CalendarEvent[]
  startDate: string // YYYY-MM-DD (Monday of week)
  onWeekChange: (delta: number) => void
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekDates(startDate: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    dayjs.utc(startDate).add(i, 'day').format('YYYY-MM-DD'),
  )
}

function formatWeekHeader(startDate: string): string {
  const start = dayjs.utc(startDate)
  const end = start.add(6, 'day')

  if (start.month() === end.month()) {
    return `${start.format('MMM')} ${start.date()}–${end.date()}, ${end.year()}`
  }
  return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`
}

// ── DroppableDay ──────────────────────────────────────────────────────────────

function DroppableDay({ date, children }: { date: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: date })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-20 rounded-lg border-2 transition-colors ${
        isOver ? 'border-[var(--blue)] bg-[var(--blue)]/5' : 'border-transparent'
      }`}
    >
      {children}
    </div>
  )
}

// ── DraggableCard ─────────────────────────────────────────────────────────────

function DraggableCard({
  workout,
  stravaMatch,
  onEdit,
}: {
  workout: WorkoutInstance
  stravaMatch?: StravaActivity
  onEdit: (w: WorkoutInstance) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: workout.id,
    data: { date: workout.scheduled_date },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab', touchAction: 'none' }}
    >
      <WorkoutCard workout={workout} stravaMatch={stravaMatch} onEdit={onEdit} />
    </div>
  )
}

// ── WeeklyCalendar ────────────────────────────────────────────────────────────

export function WeeklyCalendar({ workouts, stravaActivities, events, startDate, onWeekChange }: Props) {
  const queryClient = useQueryClient()
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutInstance | null>(null)
  const [addingEvent, setAddingEvent] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const moveMutation = useMutation({
    mutationFn: ({ id, newDate }: { id: string; newDate: string }) =>
      moveWorkout({ data: { id, newDate } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKOUTS_QUERY_KEY }),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const workoutId = active.id as string
    const newDate = over.id as string
    const workout = workouts.find((w) => w.id === workoutId)
    if (!workout || workout.scheduled_date === newDate) return
    moveMutation.mutate({ id: workoutId, newDate })
  }

  const weekDates = getWeekDates(startDate)
  const today = dayjs.utc().format('YYYY-MM-DD')
  const isCurrentWeek = weekDates.includes(today)

  function jumpToToday() {
    const t = dayjs.utc()
    const daysToMonday = t.day() === 0 ? 6 : t.day() - 1
    const thisMonday = t.subtract(daysToMonday, 'day').format('YYYY-MM-DD')
    const delta = dayjs.utc(thisMonday).diff(dayjs.utc(startDate), 'week')
    if (delta !== 0) onWeekChange(delta)
  }

  // Group workouts by date
  const byDate = new Map<string, WorkoutInstance[]>()
  for (const w of workouts) {
    byDate.set(w.scheduled_date, [...(byDate.get(w.scheduled_date) ?? []), w])
  }

  function eventsForDate(date: string): CalendarEvent[] {
    return events.filter((e) => e.date === date)
  }

  /** Returns the first unfinished Strava activity on the same day with the same type. */
  function findStravaMatch(workout: WorkoutInstance): StravaActivity | undefined {
    if (workout.completed) return undefined
    return stravaActivities.find(
      (a) => a.date === workout.scheduled_date && a.type === workout.type,
    )
  }

  /** Returns Strava activities for a day that don't match any planned workout. */
  function unmatchedStravaActivities(date: string): StravaActivity[] {
    const dayActivities = stravaActivities.filter((a) => a.date === date)
    const dayWorkouts = byDate.get(date) ?? []
    return dayActivities.filter(
      (a) => !dayWorkouts.some((w) => !w.completed && w.type === a.type),
    )
  }

  function defaultAddDate() {
    if (today >= weekDates[0] && today <= weekDates[6]) return today
    return weekDates[0]
  }

  return (
    <>
      {/* Week navigation header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onWeekChange(-1)}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
          >
            ← Prev
          </button>
          <span className="text-sm font-semibold text-[var(--text)]">
            {formatWeekHeader(startDate)}
          </span>
          <button
            type="button"
            onClick={() => onWeekChange(1)}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text)]"
          >
            Next →
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={jumpToToday}
              className="rounded-full border border-[var(--blue)]/40 px-3 py-1.5 text-sm text-[var(--blue)] transition hover:bg-[var(--blue)]/10"
            >
              Today
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddingEvent(true)}
            className="rounded-full border border-amber-400 px-4 py-1.5 text-sm font-semibold text-amber-700 transition hover:-translate-y-0.5 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            ★ Add Event
          </button>
          <button
            type="button"
            onClick={() => setAddingDate(defaultAddDate())}
            className="rounded-full bg-[var(--blue-deep)] px-4 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--blue-darker)]"
          >
            + Add Workout
          </button>
        </div>
      </div>

      {/* 7-column calendar */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((date) => {
            const dayWorkouts = byDate.get(date) ?? []
            const isToday = date === today
            const d = dayjs.utc(date)

            return (
              <div key={date} className="flex flex-col">
                {/* Day header */}
                <div
                  className={`mb-1.5 rounded-lg py-1.5 text-center ${
                    isToday ? 'bg-[var(--blue-deep)]' : ''
                  }`}
                >
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wide ${
                      isToday ? 'text-blue-100' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {d.format('ddd')}
                  </p>
                  <p
                    className={`text-sm font-bold leading-tight ${
                      isToday ? 'text-white' : 'text-[var(--text)]'
                    }`}
                  >
                    {d.date()}
                  </p>
                </div>

                {/* Event chips */}
                {eventsForDate(date).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setEditingEvent(ev)}
                    className="mb-1 w-full truncate rounded-md bg-amber-100 px-2 py-0.5 text-left text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    ★ {ev.name}
                  </button>
                ))}

                {/* Droppable zone */}
                <DroppableDay date={date}>
                  <div className="flex flex-col gap-1.5 p-0.5">
                    {dayWorkouts.map((w) => (
                      <DraggableCard
                        key={w.id}
                        workout={w}
                        stravaMatch={findStravaMatch(w)}
                        onEdit={setEditingWorkout}
                      />
                    ))}
                    {/* Unmatched Strava activities for this day */}
                    {unmatchedStravaActivities(date).map((a) => (
                      <StravaCard key={a.stravaId} activity={a} />
                    ))}
                    {/* Per-day add button */}
                    <button
                      type="button"
                      onClick={() => setAddingDate(date)}
                      className="mt-0.5 w-full rounded-lg border border-dashed border-[var(--border)] py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]"
                    >
                      +
                    </button>
                  </div>
                </DroppableDay>
              </div>
            )
          })}
        </div>
      </DndContext>

      {/* Add modal */}
      {addingDate && (
        <WorkoutForm initial={{ date: addingDate }} onClose={() => setAddingDate(null)} />
      )}

      {/* Edit modal */}
      {editingWorkout && (
        <WorkoutForm initial={editingWorkout} onClose={() => setEditingWorkout(null)} />
      )}

      {/* Add event modal */}
      {addingEvent && <EventForm onClose={() => setAddingEvent(false)} />}

      {/* Edit event modal */}
      {editingEvent && (
        <EventForm initial={editingEvent} onClose={() => setEditingEvent(null)} />
      )}
    </>
  )
}
