import { createServerFn } from '@tanstack/react-start'
import { getSupabaseClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'
import { WorkoutTypeEnum, type WorkoutType } from '#/lib/workout-types'
import { z } from 'zod'

export type CalendarEvent = {
  id: string
  user_id: string
  name: string
  date: string // YYYY-MM-DD
  types: WorkoutType[]
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const EventSchema = z.object({
  name: z.string().min(1),
  date: z.string(),
  types: z.array(WorkoutTypeEnum).default([]),
  location: z.string().optional(),
  notes: z.string().optional(),
})

// ── Queries ───────────────────────────────────────────────────────────────────

export const getEvents = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireAuth()
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', user.id)
    .order('date')

  if (error) throw new Error(error.message)
  return (data ?? []) as CalendarEvent[]
})

// ── Mutations ─────────────────────────────────────────────────────────────────

export const createEvent = createServerFn({ method: 'POST' })
  .inputValidator(EventSchema)
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        name: data.name.trim(),
        date: data.date,
        types: data.types,
        location: data.location ?? null,
        notes: data.notes ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return event as CalendarEvent
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator(EventSchema.extend({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { id, ...updates } = data
    const { error } = await supabase
      .from('events')
      .update({
        ...updates,
        name: updates.name.trim(),
        location: updates.location ?? null,
        notes: updates.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const user = await requireAuth()
    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { ok: true }
  })
