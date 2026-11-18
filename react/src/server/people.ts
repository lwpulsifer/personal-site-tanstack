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
      supabase
        .from('people')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('people_connections')
        .select('*')
        .order('created_at', { ascending: false }),
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

export const updatePerson = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ personId: z.string(), name: z.string().min(1) }))
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: person, error } = await supabase
      .from('people')
      .update({ name: data.name })
      .eq('id', data.personId)
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

const ConnectionKindSchema = z.enum([
  'partner',
  'family',
  'parent_child',
  'sibling',
  'friend',
  'coworker',
  'other',
])

const InsertConnectionSchema = z
  .object({
    personAId: z.string(),
    personBId: z.string(),
    kind: ConnectionKindSchema,
    // Ancillary free-text comment on top of `kind`, the core relationship fact.
    label: z.string().optional(),
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
        kind: data.kind,
        label: data.label?.trim() || null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return connection as DbConnection
  })

const UpdateConnectionSchema = z
  .object({
    connectionId: z.string(),
    personAId: z.string(),
    personBId: z.string(),
    kind: ConnectionKindSchema,
    label: z.string().optional(),
  })
  .refine((data) => data.personAId !== data.personBId, {
    message: 'A person cannot be connected to themselves',
  })

export const updateConnection = createServerFn({ method: 'POST' })
  .inputValidator(UpdateConnectionSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const { data: connection, error } = await supabase
      .from('people_connections')
      .update({
        person_a_id: data.personAId,
        person_b_id: data.personBId,
        kind: data.kind,
        label: data.label?.trim() || null,
      })
      .eq('id', data.connectionId)
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

const InsertConnectionGroupSchema = z
  .object({
    personIds: z.array(z.string()).min(2),
    kind: ConnectionKindSchema,
    // 'clique' connects every person to every other person (a friend group,
    // a household). 'star' connects only anchorId to everyone else in the
    // list, without connecting the others to each other (e.g. one person's
    // several coworkers, who aren't necessarily connected to one another).
    mode: z.enum(['clique', 'star']).default('clique'),
    anchorId: z.string().optional(),
    // Ancillary free-text comment applied to every connection in the group.
    label: z.string().optional(),
  })
  .refine((data) => new Set(data.personIds).size === data.personIds.length, {
    message: 'A group cannot include the same person twice',
  })
  .refine(
    (data) =>
      data.mode !== 'star' || data.personIds.includes(data.anchorId ?? ''),
    { message: 'The anchor person must be one of the selected people' },
  )

// Connects people in bulk with the same relationship kind, skipping any pair
// that's already connected with that kind (so re-submitting with one new
// member only creates the connections involving the new person).
export const insertConnectionGroup = createServerFn({ method: 'POST' })
  .inputValidator(InsertConnectionGroupSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    const ids = data.personIds

    const pairsToConsider: [string, string][] =
      data.mode === 'star'
        ? ids
            .filter((id) => id !== data.anchorId)
            .map((id) => [data.anchorId as string, id])
        : ids.flatMap((a, i) =>
            ids.slice(i + 1).map((b) => [a, b] as [string, string]),
          )

    const { data: existing, error: existingError } = await supabase
      .from('people_connections')
      .select('person_a_id, person_b_id')
      .eq('kind', data.kind)
      .or(`person_a_id.in.(${ids.join(',')}),person_b_id.in.(${ids.join(',')})`)
    if (existingError) throw new Error(existingError.message)

    const pairKey = (a: string, b: string) =>
      [a, b].sort((x, y) => x.localeCompare(y)).join(':')
    const existingPairs = new Set(
      (existing ?? []).map((c) => pairKey(c.person_a_id, c.person_b_id)),
    )

    const rows: {
      person_a_id: string
      person_b_id: string
      kind: ConnectionKind
      label: string | null
    }[] = []
    for (const [a, b] of pairsToConsider) {
      if (existingPairs.has(pairKey(a, b))) continue
      rows.push({
        person_a_id: a,
        person_b_id: b,
        kind: data.kind,
        label: data.label?.trim() || null,
      })
    }

    const skipped = pairsToConsider.length - rows.length
    if (rows.length === 0) {
      return { connections: [] as DbConnection[], skipped }
    }

    const { data: connections, error } = await supabase
      .from('people_connections')
      .insert(rows)
      .select()
    if (error) throw new Error(error.message)
    return { connections: (connections ?? []) as DbConnection[], skipped }
  })

const InsertConnectionBatchSchema = z.object({
  connections: z
    .array(
      z
        .object({
          personAId: z.string(),
          personBId: z.string(),
          kind: ConnectionKindSchema,
        })
        .refine((c) => c.personAId !== c.personBId, {
          message: 'A person cannot be connected to themselves',
        }),
    )
    .min(1),
})

// Inserts a specific, arbitrary list of (person, person, kind) triples — as
// opposed to insertConnectionGroup, which generates all the pairs itself from
// a single kind and a set of people. Used to accept a batch of suggested
// connections (see the people-graph suggestions panel), where each pair
// already has an independently-determined kind rather than sharing one.
// Skips any pair that's already connected with that same kind.
export const insertConnectionBatch = createServerFn({ method: 'POST' })
  .inputValidator(InsertConnectionBatchSchema)
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()

    const ids = Array.from(
      new Set(data.connections.flatMap((c) => [c.personAId, c.personBId])),
    )
    const { data: existing, error: existingError } = await supabase
      .from('people_connections')
      .select('person_a_id, person_b_id, kind')
      .or(`person_a_id.in.(${ids.join(',')}),person_b_id.in.(${ids.join(',')})`)
    if (existingError) throw new Error(existingError.message)

    const tripleKey = (a: string, b: string, kind: ConnectionKind) =>
      `${[a, b].sort((x, y) => x.localeCompare(y)).join(':')}:${kind}`
    const existingTriples = new Set(
      (existing ?? []).map((c) =>
        tripleKey(c.person_a_id, c.person_b_id, c.kind),
      ),
    )

    const rows = data.connections
      .filter(
        (c) =>
          !existingTriples.has(tripleKey(c.personAId, c.personBId, c.kind)),
      )
      .map((c) => ({
        person_a_id: c.personAId,
        person_b_id: c.personBId,
        kind: c.kind,
        label: null,
      }))

    const skipped = data.connections.length - rows.length
    if (rows.length === 0) {
      return { connections: [] as DbConnection[], skipped }
    }

    const { data: connections, error } = await supabase
      .from('people_connections')
      .insert(rows)
      .select()
    if (error) throw new Error(error.message)
    return { connections: (connections ?? []) as DbConnection[], skipped }
  })

export const searchPeople = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      query: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().min(0).default(0),
    }),
  )
  .handler(async ({ data }) => {
    await requireAuth()
    const supabase = getSupabaseServiceClient()
    let q = supabase
      .from('people')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (data.query?.trim()) {
      q = q.ilike('name', `%${data.query.trim()}%`)
    }
    const {
      data: people,
      error,
      count,
    } = await q.range(data.offset, data.offset + data.limit - 1)
    if (error) throw new Error(error.message)
    return { people: (people ?? []) as DbPerson[], total: count ?? 0 }
  })
