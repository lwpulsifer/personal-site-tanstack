import { type Accessor, createMemo } from 'solid-js'
import type { DbPerson } from '../server/people'

/** Indexes a people list by id, for O(1) name/row lookups by connection endpoint. */
export function createPeopleById(people: Accessor<DbPerson[]>): Accessor<Map<string, DbPerson>> {
  return createMemo(() => new Map(people().map((p) => [p.id, p])))
}
