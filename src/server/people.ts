import { query } from '@solidjs/router'
import { respond } from '@solidjs/web'
import { z } from 'zod'
import type { Enums, Tables } from '../lib/database.types'
import { parse } from './validate'

export type DbPerson = Tables<'people'>
export type DbConnection = Tables<'people_connections'>
export type ConnectionKind = Enums<'connection_kind'>

export type PeopleGraphData = { people: DbPerson[]; connections: DbConnection[] }

// Everything here is admin-only — including reads — since this is a private
// social graph, unlike books/blog which have a public-read surface.
// Mutations name the query keys they touched (prefix-matched).
const PEOPLE_KEYS = ['people-graph', 'search-people']

export const getPeopleGraph = query(async (): Promise<PeopleGraphData> => {
  'use server'
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const supabase = getSupabaseServiceClient()
  const [{ data: people, error: peopleError }, { data: connections, error: connectionsError }] =
    await Promise.all([
      supabase.from('people').select('*').order('created_at', { ascending: false }),
      supabase.from('people_connections').select('*').order('created_at', { ascending: false }),
    ])
  if (peopleError) throw new Error(peopleError.message)
  if (connectionsError) throw new Error(connectionsError.message)
  return {
    people: (people ?? []) as DbPerson[],
    connections: (connections ?? []) as DbConnection[],
  }
}, 'people-graph')

export async function insertPerson(name: string) {
  'use server'
  parse(z.string().min(1), name)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { data: person, error } = await getSupabaseServiceClient()
    .from('people')
    .insert({ name })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return respond(person as DbPerson, { revalidate: PEOPLE_KEYS })
}

export async function updatePerson(personId: string, name: string) {
  'use server'
  personId = parse(z.string(), personId)
  parse(z.string().min(1), name)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { data: person, error } = await getSupabaseServiceClient()
    .from('people')
    .update({ name })
    .eq('id', personId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return respond(person as DbPerson, { revalidate: PEOPLE_KEYS })
}

export async function deletePerson(personId: string) {
  'use server'
  personId = parse(z.string(), personId)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { error } = await getSupabaseServiceClient().from('people').delete().eq('id', personId)
  if (error) throw new Error(error.message)
  return respond({ ok: true }, { revalidate: PEOPLE_KEYS })
}

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
  .refine((d) => d.personAId !== d.personBId, {
    message: 'A person cannot be connected to themselves',
  })
export type InsertConnectionInput = z.infer<typeof InsertConnectionSchema>

export async function insertConnection(input: InsertConnectionInput) {
  'use server'
  const data = parse(InsertConnectionSchema, input)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { data: connection, error } = await getSupabaseServiceClient()
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
  return respond(connection as DbConnection, { revalidate: PEOPLE_KEYS })
}

const UpdateConnectionSchema = z
  .object({
    connectionId: z.string(),
    personAId: z.string(),
    personBId: z.string(),
    kind: ConnectionKindSchema,
    label: z.string().optional(),
  })
  .refine((d) => d.personAId !== d.personBId, {
    message: 'A person cannot be connected to themselves',
  })
export type UpdateConnectionInput = z.infer<typeof UpdateConnectionSchema>

export async function updateConnection(input: UpdateConnectionInput) {
  'use server'
  const data = parse(UpdateConnectionSchema, input)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { data: connection, error } = await getSupabaseServiceClient()
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
  return respond(connection as DbConnection, { revalidate: PEOPLE_KEYS })
}

export async function deleteConnection(connectionId: string) {
  'use server'
  connectionId = parse(z.string(), connectionId)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const { error } = await getSupabaseServiceClient()
    .from('people_connections')
    .delete()
    .eq('id', connectionId)
  if (error) throw new Error(error.message)
  return respond({ ok: true }, { revalidate: PEOPLE_KEYS })
}

const InsertConnectionGroupSchema = z
  .object({
    personIds: z.array(z.string()).min(2),
    kind: ConnectionKindSchema,
    // 'clique' connects every person to every other person (a friend group,
    // a household). 'star' connects only anchorId to everyone else in the
    // list, without connecting the others to each other.
    mode: z.enum(['clique', 'star']).default('clique'),
    anchorId: z.string().optional(),
    // Ancillary free-text comment applied to every connection in the group.
    label: z.string().optional(),
  })
  .refine((d) => new Set(d.personIds).size === d.personIds.length, {
    message: 'A group cannot include the same person twice',
  })
  .refine((d) => d.mode !== 'star' || d.personIds.includes(d.anchorId ?? ''), {
    message: 'The anchor person must be one of the selected people',
  })
export type InsertConnectionGroupInput = z.input<typeof InsertConnectionGroupSchema>

// Connects people in bulk with the same relationship kind, skipping any pair
// that's already connected with that kind (so re-submitting with one new
// member only creates the connections involving the new person).
export async function insertConnectionGroup(input: InsertConnectionGroupInput) {
  'use server'
  const data = parse(InsertConnectionGroupSchema, input)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const supabase = getSupabaseServiceClient()
  const ids = data.personIds

  const pairsToConsider: [string, string][] =
    data.mode === 'star'
      ? ids.filter((id) => id !== data.anchorId).map((id) => [data.anchorId as string, id])
      : ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b] as [string, string]))

  const { data: existing, error: existingError } = await supabase
    .from('people_connections')
    .select('person_a_id, person_b_id')
    .eq('kind', data.kind)
    .or(`person_a_id.in.(${ids.join(',')}),person_b_id.in.(${ids.join(',')})`)
  if (existingError) throw new Error(existingError.message)

  const pairKey = (a: string, b: string) => [a, b].sort((x, y) => x.localeCompare(y)).join(':')
  const existingPairs = new Set((existing ?? []).map((c) => pairKey(c.person_a_id, c.person_b_id)))

  const rows: { person_a_id: string; person_b_id: string; kind: ConnectionKind; label: string | null }[] = []
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
    return respond({ connections: [] as DbConnection[], skipped }, { revalidate: PEOPLE_KEYS })
  }
  const { data: connections, error } = await supabase.from('people_connections').insert(rows).select()
  if (error) throw new Error(error.message)
  return respond(
    { connections: (connections ?? []) as DbConnection[], skipped },
    { revalidate: PEOPLE_KEYS },
  )
}

const InsertConnectionBatchSchema = z.object({
  connections: z
    .array(
      z
        .object({ personAId: z.string(), personBId: z.string(), kind: ConnectionKindSchema })
        .refine((c) => c.personAId !== c.personBId, {
          message: 'A person cannot be connected to themselves',
        }),
    )
    .min(1),
})
export type InsertConnectionBatchInput = z.infer<typeof InsertConnectionBatchSchema>

// Inserts a specific list of (person, person, kind) triples — as opposed to
// insertConnectionGroup, which generates the pairs itself from a single kind.
// Used to accept a batch of suggested connections, where each pair has an
// independently-determined kind. Skips any pair already connected with that kind.
export async function insertConnectionBatch(input: InsertConnectionBatchInput) {
  'use server'
  const data = parse(InsertConnectionBatchSchema, input)
  const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
  await requireAuth()
  const supabase = getSupabaseServiceClient()

  const ids = Array.from(new Set(data.connections.flatMap((c) => [c.personAId, c.personBId])))
  const { data: existing, error: existingError } = await supabase
    .from('people_connections')
    .select('person_a_id, person_b_id, kind')
    .or(`person_a_id.in.(${ids.join(',')}),person_b_id.in.(${ids.join(',')})`)
  if (existingError) throw new Error(existingError.message)

  const tripleKey = (a: string, b: string, kind: ConnectionKind) =>
    `${[a, b].sort((x, y) => x.localeCompare(y)).join(':')}:${kind}`
  const existingTriples = new Set(
    (existing ?? []).map((c) => tripleKey(c.person_a_id, c.person_b_id, c.kind)),
  )

  const rows = data.connections
    .filter((c) => !existingTriples.has(tripleKey(c.personAId, c.personBId, c.kind)))
    .map((c) => ({
      person_a_id: c.personAId,
      person_b_id: c.personBId,
      kind: c.kind,
      label: null,
    }))

  const skipped = data.connections.length - rows.length
  if (rows.length === 0) {
    return respond({ connections: [] as DbConnection[], skipped }, { revalidate: PEOPLE_KEYS })
  }
  const { data: connections, error } = await supabase.from('people_connections').insert(rows).select()
  if (error) throw new Error(error.message)
  return respond(
    { connections: (connections ?? []) as DbConnection[], skipped },
    { revalidate: PEOPLE_KEYS },
  )
}

export const searchPeople = query(
  async (searchText: string, limit: number, offset: number) => {
    'use server'
    searchText = parse(z.string(), searchText)
    limit = parse(z.number().int().min(1).max(200), limit)
    offset = parse(z.number().int().min(0), offset)
    const { requireAuth, getSupabaseServiceClient } = await import('./supabase')
    await requireAuth()
    let q = getSupabaseServiceClient()
      .from('people')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
    if (searchText.trim()) q = q.ilike('name', `%${searchText.trim()}%`)
    const { data: people, error, count } = await q.range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)
    return { people: (people ?? []) as DbPerson[], total: count ?? 0 }
  },
  'search-people',
)
