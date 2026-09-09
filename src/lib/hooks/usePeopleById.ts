import { useMemo } from 'react'
import type { DbPerson } from '#/server/people'

/** Indexes a people list by id, for O(1) name/row lookups by connection endpoint. */
export function usePeopleById(people: DbPerson[]): Map<string, DbPerson> {
  return useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
}
