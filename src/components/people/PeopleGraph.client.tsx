import { useEffect, useMemo, useRef } from 'react'
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
} from 'react-force-graph-2d'
import { useElementSize } from '#/lib/hooks/useElementSize'
import { useThemeMode } from '#/lib/hooks/useThemeMode'
import type { ConnectionKind, DbConnection, DbPerson } from '#/server/people'

type GraphNode = NodeObject<{ id: string; name: string }>
type GraphLink = {
  source: string
  target: string
  label: string
  kind: ConnectionKind
}

// Partners bond tightly; everything else (parent/child, sibling, friend,
// ...) keeps normal spacing so couples visually cluster in the layout.
const LINK_DISTANCE: Record<ConnectionKind, number> = {
  partner: 20,
  family: 80,
  sibling: 80,
  friend: 80,
  coworker: 80,
  other: 80,
}
const LINK_STRENGTH: Record<ConnectionKind, number> = {
  partner: 1,
  family: 0.2,
  sibling: 0.2,
  friend: 0.2,
  coworker: 0.2,
  other: 0.2,
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

  const graphData = useMemo(
    () => ({
      nodes: people.map((p) => ({ id: p.id, name: p.name })) as GraphNode[],
      links: connections.map((c) => ({
        source: c.person_a_id,
        target: c.person_b_id,
        label: c.label,
        kind: c.kind,
      })) as GraphLink[],
    }),
    [people, connections],
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
  }, [isGraphMounted])

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

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
      className="h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
      {width > 0 && height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={width}
          height={height}
          nodeLabel="name"
          linkLabel="label"
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

            ctx.font = `${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillStyle = textColor
            ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 6)
          }}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={(link, ctx, globalScale) => {
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
            ctx.fillText((link as unknown as GraphLink).label, midX, midY)
          }}
        />
      )}
    </div>
  )
}
