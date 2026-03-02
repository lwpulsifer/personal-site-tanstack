import { createServerFn } from '@tanstack/react-start'
import { getSupabaseClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { addDays } from '#/lib/date-utils'
import dayjs from '#/lib/dayjs'
import { WorkoutTypeEnum } from '#/lib/workout-types'
import type { WorkoutType } from '#/lib/workout-types'
import { z } from 'zod'

export type WorkoutInstance = {
  id: string
  template_id: string | null
  user_id: string
  title: string
  type: WorkoutType
  custom_type: string | null
  scheduled_date: string
  duration_minutes: number | null
  notes: string | null
  completed: boolean
  completed_at: string | null
  strava_activity_id: number | null
  created_at: string
  updated_at: string
}

const RecurrenceEnum = z.enum(['none', 'daily', 'weekly', 'biweekly', 'custom'])

// ── Queries ───────────────────────────────────────────────────────────────────

export const getWorkoutsForWeek = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ startDate: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()
    const endDate = addDays(data.startDate, 6)

    const { data: instances, error } = await supabase
      .from('workout_instances')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_date', data.startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')

    if (error) throw new Error(error.message)
    return (instances ?? []) as WorkoutInstance[]
  })

// ── Mutations ─────────────────────────────────────────────────────────────────

const CreateWorkoutSchema = z.object({
  title: z.string(),
  type: WorkoutTypeEnum,
  custom_type: z.string().optional(),
  date: z.string(),
  duration_minutes: z.number().optional(),
  notes: z.string().optional(),
  recurrence: RecurrenceEnum,
  recurrence_days: z.array(z.number()).optional(),
  recurrence_interval_days: z.number().optional(),
  end_after_days: z.number().optional(),
})

export const createWorkout = createServerFn({ method: 'POST' })
  .inputValidator(CreateWorkoutSchema)
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    if (data.recurrence === 'none') {
      const { data: instance, error } = await supabase
        .from('workout_instances')
        .insert({
          user_id: user.id,
          title: data.title,
          type: data.type,
          custom_type: data.custom_type ?? null,
          scheduled_date: data.date,
          duration_minutes: data.duration_minutes ?? null,
          notes: data.notes ?? null,
        })
        .select()
        .single()

      if (error) throw new Error(error.message)
      return instance
    }

    // Recurring: create template + instances for end_after_days (default 90)
    const endDate = addDays(data.date, data.end_after_days ?? 90)

    const { data: template, error: templateError } = await supabase
      .from('workout_templates')
      .insert({
        user_id: user.id,
        title: data.title,
        type: data.type,
        custom_type: data.custom_type ?? null,
        recurrence: data.recurrence,
        recurrence_days: data.recurrence_days ?? null,
        recurrence_interval_days: data.recurrence_interval_days ?? null,
        duration_minutes: data.duration_minutes ?? null,
        notes: data.notes ?? null,
        start_date: data.date,
        end_date: endDate,
      })
      .select()
      .single()

    if (templateError) throw new Error(templateError.message)

    const dates = generateRecurringDates(
      data.date,
      endDate,
      data.recurrence,
      data.recurrence_days ?? null,
      data.recurrence_interval_days ?? null,
    )

    if (dates.length > 0) {
      const instances = dates.map((d) => ({
        user_id: user.id,
        template_id: template.id,
        title: data.title,
        type: data.type,
        custom_type: data.custom_type ?? null,
        scheduled_date: d,
        duration_minutes: data.duration_minutes ?? null,
        notes: data.notes ?? null,
      }))

      const { error: insertError } = await supabase.from('workout_instances').insert(instances)
      if (insertError) throw new Error(insertError.message)
    }

    return template
  })

export const updateWorkout = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      type: WorkoutTypeEnum.optional(),
      custom_type: z.string().nullable().optional(),
      duration_minutes: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { id, ...updates } = data
    const { error } = await supabase
      .from('workout_instances')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const moveWorkout = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), newDate: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('workout_instances')
      .update({ scheduled_date: data.newDate, updated_at: new Date().toISOString() })
      .eq('id', data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteWorkout = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      scope: z.enum(['single', 'future', 'all']),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    if (data.scope === 'single') {
      const { error } = await supabase
        .from('workout_instances')
        .delete()
        .eq('id', data.id)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }

    // For future/all scopes, fetch the instance first
    const { data: instance, error: fetchError } = await supabase
      .from('workout_instances')
      .select('template_id, scheduled_date')
      .eq('id', data.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !instance) throw new Error('Workout not found')

    if (!instance.template_id) {
      const { error } = await supabase
        .from('workout_instances')
        .delete()
        .eq('id', data.id)
      if (error) throw new Error(error.message)
      return { ok: true }
    }

    if (data.scope === 'future') {
      await supabase
        .from('workout_instances')
        .delete()
        .eq('template_id', instance.template_id)
        .eq('user_id', user.id)
        .gte('scheduled_date', instance.scheduled_date)

      const yesterday = addDays(instance.scheduled_date, -1)
      await supabase
        .from('workout_templates')
        .update({ end_date: yesterday })
        .eq('id', instance.template_id)
        .eq('user_id', user.id)
    } else {
      // all
      await supabase
        .from('workout_instances')
        .delete()
        .eq('template_id', instance.template_id)
        .eq('user_id', user.id)

      await supabase
        .from('workout_templates')
        .delete()
        .eq('id', instance.template_id)
        .eq('user_id', user.id)
    }

    return { ok: true }
  })

export const completeWorkout = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string(),
      stravaActivityId: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('workout_instances')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        strava_activity_id: data.stravaActivityId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const uncompleteWorkout = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('workout_instances')
      .update({
        completed: false,
        completed_at: null,
        strava_activity_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRecurringDates(
  startDate: string,
  endDate: string,
  recurrence: string,
  recurrenceDays: number[] | null,
  recurrenceIntervalDays: number | null,
): string[] {
  const dates: string[] = []
  const end = dayjs.utc(endDate)
  let current = dayjs.utc(startDate)

  if (recurrence === 'daily') {
    while (!current.isAfter(end)) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(1, 'day')
    }
  } else if (recurrence === 'weekly' || recurrence === 'biweekly') {
    const days = recurrenceDays ?? []
    // Arbitrary Monday epoch used only for biweekly parity.
    // Any fixed Monday works; changing it shifts which weeks are "on".
    const EPOCH = dayjs.utc('2024-01-01') // 2024-01-01 is a Monday
    const startWeekNum = dayjs.utc(startDate).diff(EPOCH, 'week')

    while (!current.isAfter(end)) {
      const weekOffset = current.diff(EPOCH, 'week') - startWeekNum
      const isActiveWeek = recurrence === 'weekly' || weekOffset % 2 === 0

      if (isActiveWeek && days.includes(current.day())) {
        dates.push(current.format('YYYY-MM-DD'))
      }
      current = current.add(1, 'day')
    }
  } else if (recurrence === 'custom') {
    const interval = recurrenceIntervalDays ?? 1
    while (!current.isAfter(end)) {
      dates.push(current.format('YYYY-MM-DD'))
      current = current.add(interval, 'day')
    }
  }

  return dates
}
