import { forceCollide } from 'd3-force-3d'
import { useEffect, useMemo, useRef, useState } from 'react'
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

type GraphNode = NodeObject<{ id: string; name: string }>
type GraphLink = {
  source: string
  target: string
  displayText: string
  kind: ConnectionKind
}

// Three visually distinct tiers: partner bonds tightest, parent/child is a
// clear middle tier, and everything else (sibling/friend/coworker/family/
// other) spreads out the most.
const LINK_DISTANCE: Record<ConnectionKind, number> = {
  partner: 60,
  parent_child: 260,
  family: 480,
  sibling: 480,
  friend: 480,
  coworker: 480,
  other: 480,
}

// Node radius (matches the circle drawn in nodeCanvasObject) plus label
// width, so the collision force keeps names from overlapping each other.
const NODE_COLLISION_RADIUS = 45

// Below this zoom level (pixels per graph-unit) name/relationship labels are
// hidden entirely, so a fully zoomed-out graph reads as clean dots and lines
// instead of an unreadable jumble of overlapping text.
const LABEL_ZOOM_THRESHOLD = 3
const LINK_STRENGTH: Record<ConnectionKind, number> = {
  partner: 1,
  parent_child: 0.3,
  family: 0.15,
  sibling: 0.15,
  friend: 0.15,
  coworker: 0.15,
  other: 0.15,
}

export function PeopleGraph({
  people,
  connections,
  onSelectPerson,
}: {
  people: DbPerson[]
  connections: DbConnection[]
  onSelectPerson?: (person: DbPerson) => void
}) {
  const { ref, width, height } = useElementSize<HTMLDivElement>()
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(
    undefined,
  )

  // Filters the graph down to a person and everyone reachable from them by
  // repeatedly following connections of a single kind (e.g. "family" ->
  // family-of-family-of-family...), rather than just their direct connections.
  const [filterPersonId, setFilterPersonId] = useState('')
  const [filterKind, setFilterKind] = useState<ConnectionKind>(
    CONNECTION_KIND_OPTIONS[0].value,
  )
  const [activeFilter, setActiveFilter] = useState<{
    personId: string
    kind: ConnectionKind
  } | null>(null)

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

  const graphData = useMemo(
    () => ({
      nodes: visiblePeople.map((p) => ({
        id: p.id,
        name: p.name,
      })) as GraphNode[],
      links: visibleConnections.map((c) => ({
        source: c.person_a_id,
        target: c.person_b_id,
        displayText: connectionDisplayText(c.kind, c.label),
        kind: c.kind,
      })) as GraphLink[],
    }),
    [visiblePeople, visibleConnections],
  )

  // The force simulation is an imperative object outside React's tree (like
  // Leaflet's map instance) — configure its per-link distance/strength via
  // accessor functions the simulation calls on every tick. Keyed on whether
  // ForceGraph2D is actually mounted yet (it only renders once sized), since
  // that's when `fgRef` first has something to configure.
  const isGraphMounted = width > 0 && height > 0
  useEffect(() => {
    if (!isGraphMounted) return
    const linkForce = fgRef.current?.d3Force('link')
    linkForce
      ?.distance((link: GraphLink) => LINK_DISTANCE[link.kind])
      .strength((link: GraphLink) => LINK_STRENGTH[link.kind])

    // Stronger mutual repulsion so unconnected clusters push apart instead
    // of bunching in the center, plus a collision force so node circles and
    // their name labels never sit on top of each other.
    fgRef.current?.d3Force('charge')?.strength(-450).distanceMax(900)
    fgRef.current?.d3Force('collide', forceCollide(NODE_COLLISION_RADIUS))
  }, [isGraphMounted])

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const [query, setQuery] = useState('')
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return visiblePeople
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [visiblePeople, query])

  function jumpToPerson(person: DbPerson) {
    const node = graphData.nodes.find((n) => n.id === person.id)
    if (node?.x != null && node.y != null) {
      fgRef.current?.centerAt(node.x, node.y, 800)
      fgRef.current?.zoom(4, 800)
    }
    setHighlightedId(person.id)
    setQuery('')
    onSelectPerson?.(person)
  }

  // Canvas fillStyle can't resolve CSS custom properties directly, so resolve
  // the `--text` color once per theme change (via useMemo, keyed on `mode`)
  // rather than on every node on every animation frame.
  const { mode } = useThemeMode()
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mode` isn't read directly, but its change is what should trigger re-resolving the color
  const textColor = useMemo(
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--text')
        .trim(),
    [mode],
  )

  return (
    <div
      ref={ref}
      data-testid="people-graph"
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
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
              setActiveFilter({ personId: filterPersonId, kind: filterKind })
            }
            data-testid="people-filter-apply-btn"
            className="flex-1 rounded-full bg-[var(--blue-deep)] px-2 py-1 text-xs font-semibold text-white transition hover:bg-[var(--blue-darker)] disabled:opacity-50"
          >
            Filter
          </button>
          {activeFilter && (
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              data-testid="people-filter-clear-btn"
              className="rounded-full border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--hover-bg)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {width > 0 && height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={width}
          height={height}
          nodeLabel="name"
          linkLabel="displayText"
          nodeRelSize={5}
          linkColor={(link) =>
            (link as unknown as GraphLink).kind === 'partner'
              ? 'rgba(244,63,94,0.7)'
              : 'rgba(148,163,184,0.6)'
          }
          linkWidth={(link) =>
            (link as unknown as GraphLink).kind === 'partner' ? 2 : 1
          }
          linkDirectionalParticles={0}
          onNodeClick={(node) => {
            const person = peopleById.get(String(node.id))
            if (person) onSelectPerson?.(person)
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = (node as GraphNode).name
            const fontSize = 12 / globalScale
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, 4, 0, 2 * Math.PI)
            ctx.fillStyle = '#2563eb'
            ctx.fill()

            if (node.id === highlightedId) {
              ctx.beginPath()
              ctx.arc(node.x ?? 0, node.y ?? 0, 8, 0, 2 * Math.PI)
              ctx.strokeStyle = '#f59e0b'
              ctx.lineWidth = 2 / globalScale
              ctx.stroke()
            }

            if (globalScale >= LABEL_ZOOM_THRESHOLD) {
              ctx.font = `${fontSize}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = textColor
              ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 6)
            }
          }}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx, globalScale) => {
            if (globalScale < LABEL_ZOOM_THRESHOLD) return
            const source = link.source as GraphNode
            const target = link.target as GraphNode
            if (typeof source !== 'object' || typeof target !== 'object') return
            const midX = ((source.x ?? 0) + (target.x ?? 0)) / 2
            const midY = ((source.y ?? 0) + (target.y ?? 0)) / 2
            const fontSize = 10 / globalScale
            ctx.font = `${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = 'rgba(100,116,139,0.9)'
            ctx.fillText((link as unknown as GraphLink).displayText, midX, midY)
          }}
        />
      )}
    </div>
  )
}
