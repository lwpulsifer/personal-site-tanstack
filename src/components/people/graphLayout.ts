// Pure layout helpers and tuning constants for the people graph, split out of
// the component so they hold no framework state. Ported verbatim from the React
// app's PeopleGraph.client.tsx.
import type { NodeObject } from 'force-graph'
import type { ConnectionKind, DbConnection } from '../../server/people'

export type GraphNode = NodeObject & { id: string; name: string }
export type GraphLink = {
  id: string
  source: string
  target: string
  displayText: string
  tooltipText: string
  kind: ConnectionKind
}

// Builds an undirected adjacency map from connections, optionally skipping
// edges `includeEdge` rejects (e.g. by kind, or touching a given person).
export function buildSymmetricAdjacency(
  connections: DbConnection[],
  includeEdge: (c: DbConnection) => boolean = () => true,
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  for (const c of connections) {
    if (!includeEdge(c)) continue
    if (!adjacency.has(c.person_a_id)) adjacency.set(c.person_a_id, new Set())
    if (!adjacency.has(c.person_b_id)) adjacency.set(c.person_b_id, new Set())
    adjacency.get(c.person_a_id)?.add(c.person_b_id)
    adjacency.get(c.person_b_id)?.add(c.person_a_id)
  }
  return adjacency
}

// Hop-distance from `start` to every node reachable from it, via BFS.
export function bfsDistances(
  adjacency: Map<string, Set<string>>,
  start: string,
): Map<string, number> {
  const distances = new Map<string, number>([[start, 0]])
  const queue = [start]
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
}

// Assigns every id in `ids` (other than `exclude`) a connected-component id
// — the id of whichever member of that component comes first in `ids`.
export function connectedComponents(
  ids: string[],
  adjacency: Map<string, Set<string>>,
  exclude?: string | null,
): Map<string, string> {
  const componentId = new Map<string, string>()
  for (const id of ids) {
    if (id === exclude || componentId.has(id)) continue
    const queue = [id]
    componentId.set(id, id)
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!componentId.has(neighbor)) {
          componentId.set(neighbor, id)
          queue.push(neighbor)
        }
      }
    }
  }
  return componentId
}

// The looser relationship kinds used to sit at a flat 480px, which spread
// everyone out equally regardless of which sub-group they belonged to. Now
// that the cluster force (below) pulls each connected sub-group together,
// these can be much shorter — the cluster force does the "keep families and
// friend groups apart from each other" job instead.
export const LINK_DISTANCE: Record<ConnectionKind, number> = {
  partner: 10,
  parent_child: 130,
  family: 90,
  sibling: 90,
  friend: 100,
  coworker: 100,
  other: 100,
}

// Strength of the pull of each node toward its cluster's centroid (see
// CLUSTER_ID below). d3-force-clustering applies this as a spring: the
// per-tick pull is `strength * distanceFromCentroid`, not a constant nudge —
// so it scales up with how spread out the cluster already is. A high value
// here fights the radial force below (which wants to spread a multi-
// generation family across several rings by hop-distance from "me") and the
// link forces (which want a legible tree shape): the further those forces
// pull a family member from the shared centroid, the harder this yanks them
// back, which is what made larger clusters visibly fold in on themselves
// instead of spreading into a readable shape. Keep this low — just enough
// to read as "these people belong together" via loose whitespace, not
// enough to override the layout the other forces are trying to produce.
export const CLUSTER_STRENGTH = 0.1

export const NODE_COLLISION_RADIUS = 45

// Partners get a much smaller collision radius than everyone else, so the
// short partner link distance above can actually pull couples in close
// instead of being fought back apart by the general collision spacing.
//
// A partner who has no other connections of their own (e.g. an in-law with
// no other family entered) has nothing else pulling them toward either
// side's cluster, so the partner link is the only thing keeping them close
// against the strong global charge repulsion below — hence how short both
// of these are.
export const PARTNER_COLLISION_RADIUS = 8

// Ring spacing for the radial layout: each additional hop away from "me" in
// the connection graph gets pushed out to a bigger radius, so relationships
// that are further from me are also physically further away on screen.
export const RADIAL_STEP = 280

// Below this zoom level name/relationship labels are hidden so the fully
// zoomed-out graph reads as clean dots and lines.
export const LABEL_ZOOM_THRESHOLD = 0.2

export const SELF_PERSON_NAME = 'Liam (me)'
export const LINK_STRENGTH: Record<ConnectionKind, number> = {
  partner: 1,
  parent_child: 0.3,
  family: 0.15,
  sibling: 0.15,
  friend: 0.15,
  coworker: 0.15,
  other: 0.15,
}

// Uniform repulsion between every node pair. The cluster force below pulls
// each group's own members together against it, so a strong charge mostly
// shows up as bigger gaps *between* clusters rather than looser packing
// within one.
export const CHARGE_STRENGTH = -1200
export const CHARGE_DISTANCE_MAX = 2200

