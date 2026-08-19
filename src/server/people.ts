import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Enums, Tables } from '#/lib/database.types'
import { getSupabaseServiceClient } from '#/lib/supabase'
import { requireAuth } from '#/server/auth.server'

export type DbPerson = Tables<'people'>
export type DbConnection = Tables<'people_connections'>
export type ConnectionKind = Enums<'connection_kind'>

// Everything here is admin-only — including reads — since this is a private
// social graph, unlike books/maps which have a public-read surface.

export const getPeopleGraph = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()

    const [
      { data: people, error: peopleError },
      { data: connections, error: connectionsError },
    ] = await Promise.all([
      supabase.from('people').select('*').order('name'),
      supabase.from('people_connections').select('*').order('created_at'),
    ])

    if (peopleError) throw new Error(peopleError.message)
    if (connectionsError) throw new Error(connectionsError.message)

    return {
      people: (people ?? []) as DbPerson[],
      connections: (connections ?? []) as DbConnection[],
    }
  },
)

const InsertPersonSchema = z.object({
  name: z.string().min(1),
})

export const insertPerson = createServerFn({ method: 'POST' })
  .inputValidator(InsertPersonSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: person, error } = await supabase
      .from('people')
      .insert({ name: data.name })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return person as DbPerson
  })

export const deletePerson = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ personId: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', data.personId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

const InsertConnectionSchema = z
  .object({
    personAId: z.string(),
    personBId: z.string(),
    label: z.string().min(1),
    kind: z.enum([
      'partner',
      'family',
      'sibling',
      'friend',
      'coworker',
      'other',
    ]),
  })
  .refine((data) => data.personAId !== data.personBId, {
    message: 'A person cannot be connected to themselves',
  })

export const insertConnection = createServerFn({ method: 'POST' })
  .inputValidator(InsertConnectionSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: connection, error } = await supabase
      .from('people_connections')
      .insert({
        person_a_id: data.personAId,
        person_b_id: data.personBId,
        label: data.label,
        kind: data.kind,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return connection as DbConnection
  })

export const deleteConnection = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ connectionId: z.string() }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('people_connections')
      .delete()
      .eq('id', data.connectionId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
