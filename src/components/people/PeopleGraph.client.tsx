import { forceCollide, forceRadial } from 'd3-force-3d'
import forceClustering from 'd3-force-clustering'
import ForceGraph, { type NodeObject } from 'force-graph'
import { createEffect, createMemo, createSignal, For, onCleanup, onSettled, Show } from 'solid-js'
import { connectionDisplayText } from '../../lib/connectionKind'
import { mode } from '../../lib/theme'
import type { DbConnection, DbPerson } from '../../server/people'
import type { GraphFocusRequest } from './graphFocus'
import {
  bfsDistances,
  buildSymmetricAdjacency,
  CHARGE_DISTANCE_MAX,
  CHARGE_STRENGTH,
  CLUSTER_STRENGTH,
  connectedComponents,
  type GraphLink,
  type GraphNode,
  LABEL_ZOOM_THRESHOLD,
  LINK_DISTANCE,
  LINK_STRENGTH,
  NODE_COLLISION_RADIUS,
  PARTNER_COLLISION_RADIUS,
  RADIAL_STEP,
  SELF_PERSON_NAME,
} from './graphLayout'

// Everything derived from (people, connections), computed once per data change.
// Canvas callbacks read this as a plain object, never as a signal.
function buildModel(people: DbPerson[], connections: DbConnection[]) {
  const peopleById = new Map(people.map((p) => [p.id, p]))

  // Nodes with a "partner" connection get pulled tighter together (see the
  // collide force) so couples visually read as a single unit.
  const partnerNodeIds = new Set<string>()
  for (const c of connections) {
    if (c.kind !== 'partner') continue
    partnerNodeIds.add(c.person_a_id)
    partnerNodeIds.add(c.person_b_id)
  }

  const selfId = people.find((p) => p.name === SELF_PERSON_NAME)?.id ?? null

  // Hop-distance from "me" through the connections, via BFS. Used to lay the
  // graph out in rings around me. Nodes not reachable from me (or when there's
  // no "me" node) get no radial pull.
  const distanceFromSelf = selfId
    ? bfsDistances(buildSymmetricAdjacency(connections), selfId)
    : new Map<string, number>()

  // Cluster id per person, used to pull family units / friend circles /
  // coworker groups together. There's no explicit group field in the data
  // model, so this is derived from graph structure: connected components of
  // the relationship graph with "me" removed, and 'partner' edges excluded
  // (otherwise a single marriage would merge two families into one cluster).
  const clusterIdByPersonId = connectedComponents(
    people.map((p) => p.id),
    buildSymmetricAdjacency(
      connections,
      (c) => c.person_a_id !== selfId && c.person_b_id !== selfId && c.kind !== 'partner',
    ),
    selfId,
  )

  // A display name per cluster: the most common free-text comment among that
  // cluster's internal connections, else the name of a member directly
  // connected to me (the actual person I know).
  const memberIdsByCluster = new Map<string, string[]>()
  for (const [personId, clusterId] of clusterIdByPersonId) {
    if (!memberIdsByCluster.has(clusterId)) memberIdsByCluster.set(clusterId, [])
    memberIdsByCluster.get(clusterId)?.push(personId)
  }
  const directlyConnectedToSelf = new Set<string>()
  if (selfId) {
    for (const c of connections) {
      if (c.person_a_id === selfId) directlyConnectedToSelf.add(c.person_b_id)
      else if (c.person_b_id === selfId) directlyConnectedToSelf.add(c.person_a_id)
    }
  }
  const clusterMeta = new Map<string, { memberIds: string[]; name: string }>()
  for (const [clusterId, memberIds] of memberIdsByCluster) {
    if (memberIds.length < 2) continue
    const memberSet = new Set(memberIds)
    const labelCounts = new Map<string, number>()
    for (const c of connections) {
      if (!memberSet.has(c.person_a_id) || !memberSet.has(c.person_b_id)) continue
      const tag = c.label?.trim()
      if (tag) labelCounts.set(tag, (labelCounts.get(tag) ?? 0) + 1)
    }
    const topLabel = [...labelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const firstConnectedName = memberIds
      .filter((id) => directlyConnectedToSelf.has(id))
      .map((id) => peopleById.get(id)?.name)
      .find((name): name is string => !!name)
    const name = topLabel ?? firstConnectedName ?? null
    if (name) clusterMeta.set(clusterId, { memberIds, name })
  }

  return { people, connections, peopleById, partnerNodeIds, selfId, distanceFromSelf, clusterIdByPersonId, clusterMeta }
}
type Model = ReturnType<typeof buildModel>
type ForceGraphInstance = InstanceType<typeof ForceGraph>

// force-graph (autoPauseRedraw) only repaints when something marks the canvas
// dirty. It has no public refresh(), but a no-op zoom fires its zoom handler,
// which does. Used after our own hover/highlight/theme state changes.
function redraw(graph: ForceGraphInstance | undefined) {
  graph?.zoom(graph.zoom())
}

// ── GraphSearchOverlay ───────────────────────────────────────────────────────
// Owns the search-input state so typing never touches the graph.
function GraphSearchOverlay(props: {
  people: DbPerson[]
  jumpTo: (personId: string) => void
  onSelectPerson?: (person: DbPerson) => void
}) {
  const [query, setQuery] = createSignal('')

  const matches = createMemo(() => {
    const q = query().trim().toLowerCase()
    if (!q) return []
    return props.people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
  })

  function jumpToPerson(person: DbPerson) {
    props.jumpTo(person.id)
    setQuery('')
    props.onSelectPerson?.(person)
  }

  return (
    <div class="absolute left-3 top-3 z-10 w-56">
      <input
        type="text"
        value={query()}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches()[0]) jumpToPerson(matches()[0])
        }}
        placeholder="Jump to person..."
        aria-label="Jump to person"
        data-testid="people-search-input"
        class="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] shadow-sm outline-none focus:border-[var(--blue)]"
      />
      <Show when={matches().length > 0}>
        <ul
          data-testid="people-search-results"
          class="mt-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          <For each={matches()}>
            {(p) => (
              <li>
                <button
                  type="button"
                  data-testid="people-search-result"
                  onClick={() => jumpToPerson(p)}
                  class="block w-full px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)]"
                >
                  {p.name}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}

// ── PeopleGraph ──────────────────────────────────────────────────────────────
export default function PeopleGraph(props: {
  people: DbPerson[]
  connections: DbConnection[]
  onSelectPerson?: (person: DbPerson) => void
  focusRequest?: GraphFocusRequest | null
}) {
  let container!: HTMLDivElement
  // force-graph empties the element it mounts into, so the canvas gets its own
  // host div beside the search overlay (react-force-graph does the same).
  let canvasHost!: HTMLDivElement
  const [size, setSize] = createSignal({ width: 0, height: 0 })

  // The force-graph instance and everything its canvas callbacks read are plain
  // variables (not signals): the graph drives its own render loop, and reading
  // signals from inside it would be an untracked read on every frame.
  let fg: ForceGraphInstance | undefined
  let model: Model | undefined
  let graphNodes: GraphNode[] = []
  let nodesByClusterId = new Map<string, GraphNode[]>()
  let highlightedId: string | null = null
  let hoveredLinkId: string | null = null
  let hoveredNodeId: string | null = null
  let textColor = '#111827'
  let hasCenteredOnSelf = false
  let pendingFocus: GraphFocusRequest | null = null
  let lastFocusRequestId: number | null = null

  // One cached node object per person id: force-graph mutates nodes in place
  // with simulated x/y/vx/vy, and handing it fresh literals on every data
  // refresh would discard those positions and re-simulate from scratch.
  const nodeCache = new Map<string, GraphNode>()
  // force-graph reheats the ENTIRE simulation for any new graphData object, so
  // content-identical refreshes must return the same object.
  let graphDataCache: { signature: string; result: { nodes: GraphNode[]; links: GraphLink[] } } | null =
    null

  onSettled(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(container)
    return () => observer.disconnect()
  })

  onCleanup(() => {
    fg?._destructor()
    fg = undefined
  })

  function setHighlighted(id: string | null) {
    highlightedId = id
    redraw(fg)
  }

  function focusPerson(personId: string): boolean {
    const node = graphNodes.find((n) => n.id === personId)
    if (node?.x == null || node.y == null) return false
    fg?.centerAt(node.x, node.y, 800)
    fg?.zoom(4, 800)
    setHighlighted(personId)
    return true
  }

  function applyFocus(request: GraphFocusRequest): boolean {
    if (request.kind === 'person') return focusPerson(request.personId)
    const nodeA = graphNodes.find((n) => n.id === request.personAId)
    const nodeB = graphNodes.find((n) => n.id === request.personBId)
    if (nodeA?.x == null || nodeB?.x == null) return false
    fg?.zoomToFit(800, 80, (n: NodeObject) => n.id === request.personAId || n.id === request.personBId)
    return true
  }

  function createGraph(): ForceGraphInstance {
    const graph = new ForceGraph(canvasHost)
      .nodeLabel('name')
      .linkLabel('tooltipText')
      .nodeRelSize(5)
      // Default is 15s. With node positions preserved across refreshes, a
      // reheat from an edit only settles a small perturbation, so a few
      // seconds is plenty and the redraw loop stops much sooner.
      .cooldownTime(3000)
      .linkColor((link) =>
        (link as GraphLink).kind === 'partner' ? 'rgba(244,63,94,0.7)' : 'rgba(148,163,184,0.6)',
      )
      .linkWidth((link) => ((link as GraphLink).kind === 'partner' ? 2 : 1))
      .linkDirectionalParticles(0)
      .onNodeClick((node) => {
        const person = model?.peopleById.get(String((node as GraphNode).id))
        if (person) props.onSelectPerson?.(person)
      })
      .onNodeHover((node) => {
        hoveredNodeId = node ? String((node as GraphNode).id) : null
        redraw(graph)
      })
      .onLinkHover((link) => {
        hoveredLinkId = link ? (link as GraphLink).id : null
        redraw(graph)
      })
      .onEngineStop(() => {
        if (!hasCenteredOnSelf) {
          hasCenteredOnSelf = true
          // selfId is pinned at the origin by the radial layout, so centering
          // on me is just moving the camera to (0, 0).
          if (model?.selfId) graph.centerAt(0, 0, 0)
        }
        const focus = pendingFocus
        if (!focus) return
        pendingFocus = null
        applyFocus(focus)
      })
      .nodeCanvasObject((node, ctx, globalScale) => {
        const n = node as GraphNode
        const x = n.x ?? 0
        const y = n.y ?? 0
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2 * Math.PI)
        ctx.fillStyle = '#2563eb'
        ctx.fill()

        if (n.id === highlightedId) {
          ctx.beginPath()
          ctx.arc(x, y, 8, 0, 2 * Math.PI)
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2 / globalScale
          ctx.stroke()
        }

        // Individual names are only drawn for "me", the highlighted/searched
        // person, or every member of the hovered cluster — otherwise a large
        // graph is just names stacked on names. Ungrouped nodes always show
        // their name, since no cluster label stands in for them.
        const nodeClusterId = model?.clusterIdByPersonId.get(n.id)
        const hoveredClusterId = hoveredNodeId
          ? (model?.clusterIdByPersonId.get(hoveredNodeId) ?? null)
          : null
        const showLabel =
          n.id === model?.selfId ||
          n.id === highlightedId ||
          n.id === hoveredNodeId ||
          !nodeClusterId ||
          (hoveredClusterId != null && nodeClusterId === hoveredClusterId)

        if (globalScale >= LABEL_ZOOM_THRESHOLD && showLabel) {
          ctx.font = `${12 / globalScale}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = textColor
          ctx.fillText(n.name, x, y + 6)
        }
      })
      // Relationship text is only drawn for the hovered link.
      .linkCanvasObjectMode(() => 'after')
      .linkCanvasObject((link, ctx, globalScale) => {
        const l = link as GraphLink
        if (l.id !== hoveredLinkId) return
        const source = l.source as unknown as GraphNode
        const target = l.target as unknown as GraphNode
        if (typeof source !== 'object' || typeof target !== 'object') return
        ctx.font = `${10 / globalScale}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(100,116,139,0.9)'
        ctx.fillText(
          l.displayText,
          ((source.x ?? 0) + (target.x ?? 0)) / 2,
          ((source.y ?? 0) + (target.y ?? 0)) / 2,
        )
      })
      // Draws each cluster's derived name above its current bounding box,
      // recomputed from live node positions every frame.
      .onRenderFramePost((ctx, globalScale) => {
        if (!model) return
        for (const [clusterId, meta] of model.clusterMeta) {
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
          ctx.font = `600 ${Math.max(11 / globalScale, 6)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillStyle = 'rgba(100,116,139,0.75)'
          ctx.fillText(meta.name, sumX / count, minY - 12 / globalScale)
        }
      })
    return graph
  }

  // Rebuilds graphData (guarded by a content signature) and re-applies forces.
  function applyModel(m: Model) {
    if (!fg) return
    model = m
    const { people, connections, peopleById } = m

    const signature = `${people.map((p) => `${p.id}:${p.name}`).join('|')}::${connections
      .map((c) => `${c.id}:${c.kind}:${c.label ?? ''}:${c.person_a_id}:${c.person_b_id}`)
      .join('|')}`

    if (!graphDataCache || graphDataCache.signature !== signature) {
      const seenIds = new Set<string>()
      const nodes = people.map((p) => {
        seenIds.add(p.id)
        const existing = nodeCache.get(p.id)
        if (existing) {
          existing.name = p.name
          return existing
        }
        const node = { id: p.id, name: p.name } as GraphNode
        nodeCache.set(p.id, node)
        return node
      })
      for (const id of nodeCache.keys()) if (!seenIds.has(id)) nodeCache.delete(id)

      const links = connections.map((c) => {
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
      }) as GraphLink[]
      graphDataCache = { signature, result: { nodes, links } }
      graphNodes = nodes
      fg.graphData(graphDataCache.result)
    }

    // Keep references to each cluster's live node objects for label drawing.
    nodesByClusterId = new Map()
    for (const node of graphNodes) {
      const clusterId = m.clusterIdByPersonId.get(node.id)
      if (!clusterId) continue
      if (!nodesByClusterId.has(clusterId)) nodesByClusterId.set(clusterId, [])
      nodesByClusterId.get(clusterId)?.push(node)
    }

    // ── Forces ──
    fg.d3Force('link')
      ?.distance((link: GraphLink) => LINK_DISTANCE[link.kind])
      .strength((link: GraphLink) => LINK_STRENGTH[link.kind])
    fg.d3Force('charge')?.strength(CHARGE_STRENGTH).distanceMax(CHARGE_DISTANCE_MAX)
    fg.d3Force(
      'collide',
      forceCollide((node: unknown) =>
        m.partnerNodeIds.has((node as GraphNode).id) ? PARTNER_COLLISION_RADIUS : NODE_COLLISION_RADIUS,
      ),
    )
    fg.d3Force(
      'cluster',
      forceClustering()
        .clusterId(
          (node: unknown) =>
            m.clusterIdByPersonId.get((node as GraphNode).id) ?? (node as GraphNode).id,
        )
        .strength(CLUSTER_STRENGTH),
    )

    // Orient the graph around "me": pin my node at the origin, and pull every
    // other node toward a ring whose radius grows with hop-distance from me.
    for (const node of graphNodes as (GraphNode & { fx?: number; fy?: number })[]) {
      if (node.id === m.selfId) {
        node.fx = 0
        node.fy = 0
      } else {
        node.fx = undefined
        node.fy = undefined
      }
    }
    fg.d3Force(
      'radial',
      m.selfId
        ? forceRadial(
            (node: unknown) => {
              const distance = m.distanceFromSelf.get((node as GraphNode).id)
              return distance == null ? 0 : distance * RADIAL_STEP
            },
            0,
            0,
          ).strength((node: unknown) => {
            const id = (node as GraphNode).id
            return m.distanceFromSelf.has(id) && id !== m.selfId ? 0.3 : 0
          })
        : null,
    )
  }

  const modelMemo = createMemo(() => buildModel(props.people, props.connections))

  // Create the graph once the container has a size, then keep it in sync.
  createEffect(
    () => ({ m: modelMemo(), size: size() }),
    ({ m, size: { width, height } }) => {
      if (width <= 0 || height <= 0) return
      if (!fg) fg = createGraph()
      fg.width(width).height(height)
      applyModel(m)
    },
  )

  // Resolve the CSS text color for the canvas; re-resolve when the theme changes.
  createEffect(
    () => mode(),
    () => {
      textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || textColor
      redraw(fg)
    },
  )

  // Apply focus requests immediately when target nodes are already placed,
  // otherwise queue for onEngineStop (new nodes have no position yet).
  createEffect(
    () => props.focusRequest,
    (request) => {
      if (!request || request.requestId === lastFocusRequestId) return
      lastFocusRequestId = request.requestId
      if (!applyFocus(request)) pendingFocus = request
    },
  )

  return (
    <div
      ref={container}
      data-testid="people-graph"
      class="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <div ref={canvasHost} class="absolute inset-0" />
      <GraphSearchOverlay
        people={props.people}
        jumpTo={(id) => focusPerson(id) || setHighlighted(id)}
        onSelectPerson={props.onSelectPerson}
      />
    </div>
  )
}
