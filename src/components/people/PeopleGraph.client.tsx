import { forceCollide, forceRadial } from 'd3-force-3d'
import forceClustering from 'd3-force-clustering'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
} from 'react-force-graph-2d'
import {
  CONNECTION_KIND_OPTIONS,
  connectionDisplayText,
} from '#/lib/connectionKind'
import { useElementSize } from '#/lib/hooks/useElementSize'
import { useThemeMode } from '#/lib/hooks/useThemeMode'
import type { ConnectionKind, DbConnection, DbPerson } from '#/server/people'
import type { GraphFocusRequest } from './graphFocus'

type GraphNode = NodeObject<{ id: string; name: string }>
type GraphLink = {
  id: string
  source: string
  target: string
  displayText: string
  tooltipText: string
  kind: ConnectionKind
}

// The looser relationship kinds used to sit at a flat 480px, which spread
// everyone out equally regardless of which sub-group they belonged to. Now
// that the cluster force (below) pulls each connected sub-group together,
// these can be much shorter — the cluster force does the "keep families and
// friend groups apart from each other" job instead.
const LINK_DISTANCE: Record<ConnectionKind, number> = {
  partner: 10,
  parent_child: 130,
  family: 90,
  sibling: 90,
  friend: 100,
  coworker: 100,
  other: 100,
}

// Strength of the pull of each node toward its cluster's centroid (see
// CLUSTER_ID below). Fairly strong: the tighter each cluster packs
// internally, the more the shared charge/collision repulsion below reads as
// whitespace *between* clusters rather than just general spread.
const CLUSTER_STRENGTH = 0.9

const NODE_COLLISION_RADIUS = 45

// Partners get a much smaller collision radius than everyone else, so the
// short partner link distance above can actually pull couples in close
// instead of being fought back apart by the general collision spacing.
//
// A partner who has no other connections of their own (e.g. an in-law with
// no other family entered) has nothing else pulling them toward either
// side's cluster, so the partner link is the only thing keeping them close
// against the strong global charge repulsion below — hence how short both
// of these are.
const PARTNER_COLLISION_RADIUS = 8

// Ring spacing for the radial layout: each additional hop away from "me" in
// the connection graph gets pushed out to a bigger radius, so relationships
// that are further from me are also physically further away on screen.
const RADIAL_STEP = 280

// Below this zoom level name/relationship labels are hidden so the fully
// zoomed-out graph reads as clean dots and lines.
const LABEL_ZOOM_THRESHOLD = 0.2

const SELF_PERSON_NAME = 'Liam (me)'
const LINK_STRENGTH: Record<ConnectionKind, number> = {
  partner: 1,
  parent_child: 0.3,
  family: 0.15,
  sibling: 0.15,
  friend: 0.15,
  coworker: 0.15,
  other: 0.15,
}

// ── Layout modes ──────────────────────────────────────────────────────────────
// 'groups' is the hard-partition approach: connected components (see
// clusterIdByPersonId below) get pulled to a shared centroid by a cluster
// force, with strong charge to read as gaps between groups. 'density'
// replaces that with a continuous alternative: no cluster force at all —
// instead every link's distance/strength is scaled by how many neighbors its
// two endpoints share (Jaccard similarity, excluding "me"), so densely
// interconnected neighborhoods pull tight on their own merit rather than via
// an assigned cluster id. A single bridging edge (like a marriage between two
// otherwise-unconnected families) then naturally stays weak instead of
// needing to be manually excluded from cluster computation.
type LayoutMode = 'groups' | 'density'

const GROUPS_CHARGE_STRENGTH = -1200
const GROUPS_CHARGE_DISTANCE_MAX = 2200
const DENSITY_CHARGE_STRENGTH = -500
const DENSITY_CHARGE_DISTANCE_MAX = 1400

// At jaccard=1 (endpoints share every other connection), distance shrinks to
// this fraction of its base and strength gets boosted by this much (capped
// at 1). At jaccard=0, both are unchanged from the per-kind base.
const DENSITY_DISTANCE_MIN_FACTOR = 0.4
const DENSITY_STRENGTH_BOOST = 0.5

// ── GraphSearchOverlay ────────────────────────────────────────────────────────
// Owns the search-input state so that typing never causes the parent (and
// therefore ForceGraph2D) to re-render.
const GraphSearchOverlay = memo(function GraphSearchOverlay({
  visiblePeople,
  fgRef,
  graphNodes,
  onSelectPerson,
  onHighlight,
}: {
  visiblePeople: DbPerson[]
  fgRef: React.RefObject<ForceGraphMethods<GraphNode, GraphLink> | undefined>
  graphNodes: GraphNode[]
  onSelectPerson?: (person: DbPerson) => void
  onHighlight: (id: string | null) => void
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return visiblePeople
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [visiblePeople, query])

  function jumpToPerson(person: DbPerson) {
    const node = graphNodes.find((n) => n.id === person.id)
    if (node?.x != null && node.y != null) {
      fgRef.current?.centerAt(node.x, node.y, 800)
      fgRef.current?.zoom(4, 800)
    }
    onHighlight(person.id)
    setQuery('')
    onSelectPerson?.(person)
  }

  return (
    <div className="absolute left-3 top-3 z-10 w-56">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) jumpToPerson(matches[0])
        }}
        placeholder="Jump to person..."
        aria-label="Jump to person"
        data-testid="people-search-input"
        className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] shadow-sm outline-none focus:border-[var(--blue)]"
      />
      {matches.length > 0 && (
        <ul
          data-testid="people-search-results"
          className="mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                data-testid="people-search-result"
                onClick={() => jumpToPerson(p)}
                className="block w-full px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)]"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

// ── GraphFilterPanel ──────────────────────────────────────────────────────────
// Owns the filter-dropdown state so that selecting a person / kind only
// re-renders this panel, not the graph, until the user clicks "Filter".
const GraphFilterPanel = memo(function GraphFilterPanel({
  people,
  activeFilter,
  onApply,
  onClear,
}: {
  people: DbPerson[]
  activeFilter: { personId: string; kind: ConnectionKind } | null
  onApply: (filter: { personId: string; kind: ConnectionKind }) => void
  onClear: () => void
}) {
  const [filterPersonId, setFilterPersonId] = useState('')
  const [filterKind, setFilterKind] = useState<ConnectionKind>(
    CONNECTION_KIND_OPTIONS[0].value,
  )

  return (
    <div className="absolute right-3 top-3 z-10 flex w-60 flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-sm">
      <select
        aria-label="Filter: person"
        value={filterPersonId}
        onChange={(e) => setFilterPersonId(e.target.value)}
        data-testid="people-filter-person-select"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
      >
        <option value="">Person…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter: relationship type"
        value={filterKind}
        onChange={(e) => setFilterKind(e.target.value as ConnectionKind)}
        data-testid="people-filter-kind-select"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] outline-none focus:border-[var(--blue)]"
      >
        {CONNECTION_KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!filterPersonId}
          onClick={() =>
            onApply({ personId: filterPersonId, kind: filterKind })
          }
          data-testid="people-filter-apply-btn"
          className="flex-1 rounded-full bg-[var(--blue-deep)] px-2 py-1 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
        >
          Filter
        </button>
        {activeFilter && (
          <button
            type="button"
            onClick={onClear}
            data-testid="people-filter-clear-btn"
            className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
})

// ── PeopleGraph ───────────────────────────────────────────────────────────────
export function PeopleGraph({
  people,
  connections,
  onSelectPerson,
  focusRequest,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  onSelectPerson?: (person: DbPerson) => void
  focusRequest?: GraphFocusRequest | null
}) {
  const { ref, width, height } = useElementSize<HTMLDivElement>()
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  )
  const hasCenteredOnSelfRef = useRef(false)

  const pendingFocusRef = useRef<GraphFocusRequest | null>(null)
  const lastFocusRequestId = useRef<number | null>(null)

  const [activeFilter, setActiveFilter] = useState<{
    personId: string
    kind: ConnectionKind
  } | null>(null)

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('groups')

  const handleApplyFilter = useCallback(
    (filter: { personId: string; kind: ConnectionKind }) =>
      setActiveFilter(filter),
    [],
  )
  const handleClearFilter = useCallback(() => setActiveFilter(null), [])

  const reachableIds = useMemo(() => {
    if (!activeFilter) return null
    const adjacency = new Map<string, Set<string>>()
    for (const c of connections) {
      if (c.kind !== activeFilter.kind) continue
      if (!adjacency.has(c.person_a_id)) adjacency.set(c.person_a_id, new Set())
      if (!adjacency.has(c.person_b_id)) adjacency.set(c.person_b_id, new Set())
      adjacency.get(c.person_a_id)?.add(c.person_b_id)
      adjacency.get(c.person_b_id)?.add(c.person_a_id)
    }
    const visited = new Set<string>([activeFilter.personId])
    const queue = [activeFilter.personId]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    return visited
  }, [activeFilter, connections])

  const visiblePeople = useMemo(
    () =>
      reachableIds ? people.filter((p) => reachableIds.has(p.id)) : people,
    [people, reachableIds],
  )
  const visibleConnections = useMemo(
    () =>
      reachableIds && activeFilter
        ? connections.filter(
            (c) =>
              c.kind === activeFilter.kind &&
              reachableIds.has(c.person_a_id) &&
              reachableIds.has(c.person_b_id),
          )
        : connections,
    [connections, reachableIds, activeFilter],
  )

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  // Nodes with a "partner" connection get pulled tighter together (see the
  // collide force below) so couples visually read as a single unit.
  const partnerNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of visibleConnections) {
      if (c.kind !== 'partner') continue
      ids.add(c.person_a_id)
      ids.add(c.person_b_id)
    }
    return ids
  }, [visibleConnections])

  const selfId = useMemo(
    () => people.find((p) => p.name === SELF_PERSON_NAME)?.id ?? null,
    [people],
  )

  // Hop-distance from "me" through the visible connections, via BFS. Used to
  // lay the graph out in rings around me: further relationships (more hops
  // away) sit physically further out. Nodes not reachable from me (or when
  // there's no "me" node) fall back to Infinity, so the radial force below
  // leaves them alone and the existing charge/link forces place them.
  const distanceFromSelf = useMemo(() => {
    const distances = new Map<string, number>()
    if (!selfId) return distances
    const adjacency = new Map<string, Set<string>>()
    for (const c of visibleConnections) {
      if (!adjacency.has(c.person_a_id)) adjacency.set(c.person_a_id, new Set())
      if (!adjacency.has(c.person_b_id)) adjacency.set(c.person_b_id, new Set())
      adjacency.get(c.person_a_id)?.add(c.person_b_id)
      adjacency.get(c.person_b_id)?.add(c.person_a_id)
    }
    distances.set(selfId, 0)
    const queue = [selfId]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      const currentDistance = distances.get(current) ?? 0
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDistance + 1)
          queue.push(neighbor)
        }
      }
    }
    return distances
  }, [selfId, visibleConnections])

  // Cluster id per person, used to pull family units / friend circles / coworker
  // groups together (see the cluster force below). There's no explicit
  // "family"/"group" field in the data model, so this is derived from graph
  // structure: connected components of the relationship graph with "me"
  // removed. Everyone connects back to me directly or transitively, so "me"
  // is the hub that would otherwise merge every sub-group into one giant
  // component; people who are still connected to each other without going
  // through me are, in practice, a real group (a nuclear family, a friend
  // circle, coworkers at the same job).
  //
  // 'partner' edges are also excluded here, even though they're not "my"
  // edges: two blood families are otherwise-independent components that
  // happen to be bridged by a single marriage/partnership. Leaving that edge
  // in would merge both families into one component. The couple still sits
  // visually close via the separate short partner link force below — each
  // partner is just pulled toward their own side's cluster centroid instead
  // of one shared one, so the couple becomes the seam between two distinct
  // family clusters rather than the two families blurring into one.
  const clusterIdByPersonId = useMemo(() => {
    const adjacency = new Map<string, Set<string>>()
    for (const c of visibleConnections) {
      if (c.person_a_id === selfId || c.person_b_id === selfId) continue
      if (c.kind === 'partner') continue
      if (!adjacency.has(c.person_a_id)) adjacency.set(c.person_a_id, new Set())
      if (!adjacency.has(c.person_b_id)) adjacency.set(c.person_b_id, new Set())
      adjacency.get(c.person_a_id)?.add(c.person_b_id)
      adjacency.get(c.person_b_id)?.add(c.person_a_id)
    }
    const clusterIds = new Map<string, string>()
    for (const person of visiblePeople) {
      if (person.id === selfId || clusterIds.has(person.id)) continue
      const queue = [person.id]
      clusterIds.set(person.id, person.id)
      while (queue.length > 0) {
        const current = queue.shift()
        if (!current) break
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!clusterIds.has(neighbor)) {
            clusterIds.set(neighbor, person.id)
            queue.push(neighbor)
          }
        }
      }
    }
    return clusterIds
  }, [visiblePeople, visibleConnections, selfId])

  // A display name per cluster, so the graph can show one label for a whole
  // group instead of every member's name. Picks the most common free-text
  // comment among that cluster's internal connections (e.g. "college
  // roommates"); if none of them have a comment, falls back to the name of
  // whichever cluster member is directly connected to me — the actual person
  // I know, rather than a generic relationship kind.
  const clusterMeta = useMemo(() => {
    const memberIdsByCluster = new Map<string, string[]>()
    for (const [personId, clusterId] of clusterIdByPersonId) {
      if (!memberIdsByCluster.has(clusterId))
        memberIdsByCluster.set(clusterId, [])
      memberIdsByCluster.get(clusterId)?.push(personId)
    }

    // Who's directly connected to me — used as the naming fallback below:
    // whichever cluster member I actually know personally is a much more
    // meaningful "who is this" label than a generic relationship kind.
    const directlyConnectedToSelf = new Set<string>()
    if (selfId) {
      for (const c of visibleConnections) {
        if (c.person_a_id === selfId) directlyConnectedToSelf.add(c.person_b_id)
        else if (c.person_b_id === selfId)
          directlyConnectedToSelf.add(c.person_a_id)
      }
    }

    const meta = new Map<string, { memberIds: string[]; name: string }>()
    for (const [clusterId, memberIds] of memberIdsByCluster) {
      if (memberIds.length < 2) continue
      const memberSet = new Set(memberIds)
      const labelCounts = new Map<string, number>()
      for (const c of visibleConnections) {
        if (!memberSet.has(c.person_a_id) || !memberSet.has(c.person_b_id))
          continue
        const tag = c.label?.trim()
        if (tag) labelCounts.set(tag, (labelCounts.get(tag) ?? 0) + 1)
      }
      const topLabel = [...labelCounts.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0]
      // "First" here just means memberIds' own order (BFS assignment order),
      // not anything the user picks — it's a stable, deterministic tiebreak
      // when more than one member happens to connect directly to me.
      const firstConnectedName = memberIds
        .filter((id) => directlyConnectedToSelf.has(id))
        .map((id) => peopleById.get(id)?.name)
        .find((name): name is string => !!name)
      const name = topLabel ?? firstConnectedName ?? null
      if (name) meta.set(clusterId, { memberIds, name })
    }
    return meta
  }, [clusterIdByPersonId, visibleConnections, selfId, peopleById])

  // For 'density' layout mode: each person's neighbor set (excluding "me",
  // same reasoning as clusterIdByPersonId above — otherwise nearly everyone
  // shares "me" as a neighbor, which would swamp the similarity signal).
  const neighborsExcludingSelf = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of visibleConnections) {
      if (c.person_a_id === selfId || c.person_b_id === selfId) continue
      if (!map.has(c.person_a_id)) map.set(c.person_a_id, new Set())
      if (!map.has(c.person_b_id)) map.set(c.person_b_id, new Set())
      map.get(c.person_a_id)?.add(c.person_b_id)
      map.get(c.person_b_id)?.add(c.person_a_id)
    }
    return map
  }, [visibleConnections, selfId])

  // Jaccard similarity of each link's two endpoints' neighbor sets — how
  // many of the people they're each connected to are the same people. High
  // overlap means "densely-connected local neighborhood", which is the
  // continuous stand-in for cluster membership in density mode.
  const jaccardByLinkId = useMemo(() => {
    const scores = new Map<string, number>()
    for (const c of visibleConnections) {
      const a = neighborsExcludingSelf.get(c.person_a_id)
      const b = neighborsExcludingSelf.get(c.person_b_id)
      if (!a || !b) {
        scores.set(c.id, 0)
        continue
      }
      let intersectionSize = 0
      for (const id of a) if (b.has(id)) intersectionSize++
      const unionSize = new Set([...a, ...b]).size
      scores.set(c.id, unionSize === 0 ? 0 : intersectionSize / unionSize)
    }
    return scores
  }, [visibleConnections, neighborsExcludingSelf])

  const graphData = useMemo(
    () => ({
      nodes: visiblePeople.map((p) => ({
        id: p.id,
        name: p.name,
      })) as GraphNode[],
      links: visibleConnections.map((c) => {
        const displayText = connectionDisplayText(c.kind, c.label)
        const nameA = peopleById.get(c.person_a_id)?.name ?? 'Unknown'
        const nameB = peopleById.get(c.person_b_id)?.name ?? 'Unknown'
        return {
          id: c.id,
          source: c.person_a_id,
          target: c.person_b_id,
          displayText,
          tooltipText: `${nameA} — ${nameB}: ${displayText}`,
          kind: c.kind,
        }
      }) as GraphLink[],
    }),
    [visiblePeople, visibleConnections, peopleById],
  )

  // Keeps references to each cluster's live node objects (react-force-graph
  // mutates these in place with x/y every simulation tick), so the cluster
  // label can be drawn at the current centroid each frame without
  // recomputing cluster membership on every render.
  const nodesByClusterId = useMemo(() => {
    const map = new Map<string, GraphNode[]>()
    for (const node of graphData.nodes) {
      const clusterId = clusterIdByPersonId.get(node.id)
      if (!clusterId) continue
      if (!map.has(clusterId)) map.set(clusterId, [])
      map.get(clusterId)?.push(node)
    }
    return map
  }, [graphData.nodes, clusterIdByPersonId])

  // Apply focus requests immediately when target nodes are already placed,
  // otherwise queue for onEngineStop (new nodes have no position yet).
  useEffect(() => {
    if (!focusRequest) return
    if (focusRequest.requestId === lastFocusRequestId.current) return
    lastFocusRequestId.current = focusRequest.requestId

    if (focusRequest.kind === 'person') {
      const node = graphData.nodes.find((n) => n.id === focusRequest.personId)
      if (node?.x != null && node.y != null) {
        fgRef.current?.centerAt(node.x, node.y, 800)
        fgRef.current?.zoom(4, 800)
        setHighlightedId(focusRequest.personId)
      } else {
        pendingFocusRef.current = focusRequest
      }
    } else {
      const nodeA = graphData.nodes.find((n) => n.id === focusRequest.personAId)
      const nodeB = graphData.nodes.find((n) => n.id === focusRequest.personBId)
      if (nodeA?.x != null && nodeB?.x != null) {
        fgRef.current?.zoomToFit(
          800,
          80,
          (n) =>
            n.id === focusRequest.personAId || n.id === focusRequest.personBId,
        )
      } else {
        pendingFocusRef.current = focusRequest
      }
    }
  }, [focusRequest, graphData])

  const isGraphMounted = width > 0 && height > 0
  useEffect(() => {
    if (!isGraphMounted) return
    const linkForce = fgRef.current?.d3Force('link')
    if (layoutMode === 'density') {
      linkForce
        ?.distance((link: GraphLink) => {
          const base = LINK_DISTANCE[link.kind]
          const jaccard = jaccardByLinkId.get(link.id) ?? 0
          return base * (1 - (1 - DENSITY_DISTANCE_MIN_FACTOR) * jaccard)
        })
        .strength((link: GraphLink) => {
          const base = LINK_STRENGTH[link.kind]
          const jaccard = jaccardByLinkId.get(link.id) ?? 0
          return Math.min(1, base + DENSITY_STRENGTH_BOOST * jaccard)
        })
    } else {
      linkForce
        ?.distance((link: GraphLink) => LINK_DISTANCE[link.kind])
        .strength((link: GraphLink) => LINK_STRENGTH[link.kind])
    }
    // Charge is a uniform repulsion between every node pair. In 'groups'
    // mode the cluster force pulls each group's own members together
    // against it, so a strong charge mostly shows up as bigger gaps
    // *between* clusters. In 'density' mode there's no cluster force, so a
    // more moderate charge lets the density-weighted links do the work of
    // pulling related neighborhoods together instead of fighting a strong
    // uniform repulsion.
    fgRef.current
      ?.d3Force('charge')
      ?.strength(
        layoutMode === 'groups'
          ? GROUPS_CHARGE_STRENGTH
          : DENSITY_CHARGE_STRENGTH,
      )
      .distanceMax(
        layoutMode === 'groups'
          ? GROUPS_CHARGE_DISTANCE_MAX
          : DENSITY_CHARGE_DISTANCE_MAX,
      )
    fgRef.current?.d3Force(
      'collide',
      forceCollide((node: unknown) =>
        partnerNodeIds.has((node as GraphNode).id)
          ? PARTNER_COLLISION_RADIUS
          : NODE_COLLISION_RADIUS,
      ),
    )
    fgRef.current?.d3Force(
      'cluster',
      layoutMode === 'groups'
        ? forceClustering()
            .clusterId(
              (node: unknown) =>
                clusterIdByPersonId.get((node as GraphNode).id) ??
                (node as GraphNode).id,
            )
            .strength(CLUSTER_STRENGTH)
        : null,
    )

    // Orient the graph around "me": pin my node at the origin, and pull
    // every other node toward a ring whose radius grows with hop-distance
    // from me, so relationships further away (in the connection graph) end
    // up physically further away on screen. Nodes with no path to me (or
    // when there's no "me" node) get no radial pull and are placed by the
    // link/charge forces alone.
    for (const node of graphData.nodes as (GraphNode & {
      fx?: number
      fy?: number
    })[]) {
      if (node.id === selfId) {
        node.fx = 0
        node.fy = 0
      } else {
        node.fx = undefined
        node.fy = undefined
      }
    }
    fgRef.current?.d3Force(
      'radial',
      selfId
        ? forceRadial(
            (node: unknown) => {
              const distance = distanceFromSelf.get((node as GraphNode).id)
              return distance == null ? 0 : distance * RADIAL_STEP
            },
            0,
            0,
          ).strength((node: unknown) => {
            const id = (node as GraphNode).id
            return distanceFromSelf.has(id) && id !== selfId ? 0.3 : 0
          })
        : null,
    )
  }, [
    isGraphMounted,
    graphData.nodes,
    selfId,
    distanceFromSelf,
    partnerNodeIds,
    clusterIdByPersonId,
    layoutMode,
    jaccardByLinkId,
  ])

  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Hovering any node in a cluster reveals every member's name in that
  // cluster — otherwise only the cluster's own label (drawn in
  // onRenderFramePost below) identifies the group, keeping a busy graph
  // readable at a glance.
  const hoveredClusterId = hoveredNodeId
    ? (clusterIdByPersonId.get(hoveredNodeId) ?? null)
    : null

  const { mode } = useThemeMode()
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mode` change is the signal to re-resolve the CSS color
  const textColor = useMemo(
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--text')
        .trim(),
    [mode],
  )

  // ── Stable ForceGraph2D callbacks ──────────────────────────────────────────
  // All are wrapped in useCallback so that ForceGraph2D only sees new references
  // when its own dependencies actually changed, preventing unnecessary internal
  // re-processing on unrelated state changes (e.g. search input keystrokes).

  const linkColor = useCallback(
    (link: object) =>
      (link as GraphLink).kind === 'partner'
        ? 'rgba(244,63,94,0.7)'
        : 'rgba(148,163,184,0.6)',
    [],
  )

  const linkWidth = useCallback(
    (link: object) => ((link as GraphLink).kind === 'partner' ? 2 : 1),
    [],
  )

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const label = n.name
      const fontSize = 12 / globalScale
      ctx.beginPath()
      ctx.arc(n.x ?? 0, n.y ?? 0, 4, 0, 2 * Math.PI)
      ctx.fillStyle = '#2563eb'
      ctx.fill()

      if (n.id === highlightedId) {
        ctx.beginPath()
        ctx.arc(n.x ?? 0, n.y ?? 0, 8, 0, 2 * Math.PI)
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2 / globalScale
        ctx.stroke()
      }

      // Individual names are only drawn for "me", the highlighted/searched
      // person, or every member of the currently hovered cluster — otherwise
      // a large graph is just names stacked on names. Ungrouped nodes (no
      // cluster, e.g. someone only connected to me) always show their name,
      // since there's no cluster label standing in for them. There's no
      // cluster concept at all in density mode, so names just follow the
      // zoom threshold there, same as before clustering existed.
      const nodeClusterId = clusterIdByPersonId.get(n.id)
      const showLabel =
        layoutMode === 'density' ||
        n.id === selfId ||
        n.id === highlightedId ||
        n.id === hoveredNodeId ||
        !nodeClusterId ||
        (hoveredClusterId != null && nodeClusterId === hoveredClusterId)

      if (globalScale >= LABEL_ZOOM_THRESHOLD && showLabel) {
        ctx.font = `${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = textColor
        ctx.fillText(label, n.x ?? 0, (n.y ?? 0) + 6)
      }
    },
    [
      highlightedId,
      textColor,
      selfId,
      hoveredNodeId,
      hoveredClusterId,
      clusterIdByPersonId,
      layoutMode,
    ],
  )

  // Relationship text is only drawn for the hovered link — with hundreds of
  // connections, labeling every link at once was more clutter than signal.
  const linkCanvasObject = useCallback(
    (link: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const l = link as GraphLink
      if (l.id !== hoveredLinkId) return
      const source = l.source as unknown as GraphNode
      const target = l.target as unknown as GraphNode
      if (typeof source !== 'object' || typeof target !== 'object') return
      const midX = ((source.x ?? 0) + (target.x ?? 0)) / 2
      const midY = ((source.y ?? 0) + (target.y ?? 0)) / 2
      const fontSize = 10 / globalScale
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(100,116,139,0.9)'
      ctx.fillText(l.displayText, midX, midY)
    },
    [hoveredLinkId],
  )

  const onLinkHover = useCallback((link: object | null) => {
    setHoveredLinkId(link ? (link as GraphLink).id : null)
  }, [])

  const onNodeHover = useCallback((node: object | null) => {
    setHoveredNodeId(node ? (node as GraphNode).id : null)
  }, [])

  // Draws each cluster's derived name above its current bounding box. There's
  // no "meta node"/compound-node concept in d3-force or react-force-graph —
  // clusters are just a shared clusterId pulling ordinary nodes toward a
  // shared centroid (see the cluster force above) — so the label position is
  // recomputed from the live node positions every frame here instead of
  // being attached to some container node in the simulation.
  const onRenderFramePost = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (layoutMode !== 'groups') return
      for (const [clusterId, meta] of clusterMeta) {
        const nodes = nodesByClusterId.get(clusterId)
        if (!nodes) continue
        let sumX = 0
        let minY = Number.POSITIVE_INFINITY
        let count = 0
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue
          sumX += node.x
          minY = Math.min(minY, node.y)
          count++
        }
        if (count === 0) continue
        const cx = sumX / count
        const fontSize = Math.max(11 / globalScale, 6)
        ctx.font = `600 ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = 'rgba(100,116,139,0.75)'
        ctx.fillText(meta.name, cx, minY - 12 / globalScale)
      }
    },
    [clusterMeta, nodesByClusterId, layoutMode],
  )

  const onNodeClick = useCallback(
    (node: object) => {
      const person = peopleById.get(String((node as GraphNode).id))
      if (person) onSelectPerson?.(person)
    },
    [peopleById, onSelectPerson],
  )

  const onEngineStop = useCallback(() => {
    if (!hasCenteredOnSelfRef.current) {
      hasCenteredOnSelfRef.current = true
      // selfId is pinned at the origin by the radial layout, so centering on
      // me is just moving the camera to (0, 0).
      if (selfId) fgRef.current?.centerAt(0, 0, 0)
    }

    const focus = pendingFocusRef.current
    if (!focus) return
    pendingFocusRef.current = null
    if (focus.kind === 'person') {
      const node = graphData.nodes.find((n) => n.id === focus.personId)
      if (node?.x != null && node.y != null) {
        fgRef.current?.centerAt(node.x, node.y, 800)
        fgRef.current?.zoom(4, 800)
        setHighlightedId(focus.personId)
      }
    } else {
      fgRef.current?.zoomToFit(
        800,
        80,
        (node) => node.id === focus.personAId || node.id === focus.personBId,
      )
    }
  }, [selfId, graphData])

  return (
    <div
      ref={ref}
      data-testid="people-graph"
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <GraphSearchOverlay
        visiblePeople={visiblePeople}
        fgRef={fgRef}
        graphNodes={graphData.nodes}
        onSelectPerson={onSelectPerson}
        onHighlight={setHighlightedId}
      />

      <GraphFilterPanel
        people={people}
        activeFilter={activeFilter}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
      />

      <div className="absolute bottom-3 left-3 z-10 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setLayoutMode('groups')}
          data-testid="graph-layout-groups-btn"
          title="Hard clusters: connected components pulled to a shared centroid"
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            layoutMode === 'groups'
              ? 'bg-[var(--blue-deep)] text-white'
              : 'text-[var(--text)] hover:bg-[var(--hover-bg)]'
          }`}
        >
          Groups
        </button>
        <button
          type="button"
          onClick={() => setLayoutMode('density')}
          data-testid="graph-layout-density-btn"
          title="Continuous: link distance/strength scaled by shared-neighbor density"
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            layoutMode === 'density'
              ? 'bg-[var(--blue-deep)] text-white'
              : 'text-[var(--text)] hover:bg-[var(--hover-bg)]'
          }`}
        >
          Density
        </button>
      </div>

      {width > 0 && height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={width}
          height={height}
          nodeLabel="name"
          linkLabel="tooltipText"
          nodeRelSize={5}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkDirectionalParticles={0}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          onLinkHover={onLinkHover}
          onEngineStop={onEngineStop}
          nodeCanvasObject={nodeCanvasObject}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={linkCanvasObject}
          onRenderFramePost={onRenderFramePost}
        />
      )}
    </div>
  )
}
