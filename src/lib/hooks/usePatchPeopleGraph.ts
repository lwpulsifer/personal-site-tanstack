import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { type PeopleGraphData, peopleGraphQueryOptions } from '#/lib/queries'

/**
 * Returns a function that patches the people-graph query cache in place.
 * A mutation's response already contains the affected row(s), so patching
 * directly lets the graph/panels update immediately instead of waiting on
 * invalidate()'s round-trip refetch (still worth triggering separately, for
 * eventual consistency).
 */
export function usePatchPeopleGraph() {
  const queryClient = useQueryClient()
  return useCallback(
    (updater: (old: PeopleGraphData) => PeopleGraphData) => {
      queryClient.setQueryData<PeopleGraphData>(
        peopleGraphQueryOptions.queryKey,
        (old) => (old ? updater(old) : old),
      )
    },
    [queryClient],
  )
}
