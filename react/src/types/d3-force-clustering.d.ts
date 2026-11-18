// d3-force-clustering ships no types. This is a minimal ambient declaration
// covering just what we call to pull the people graph into family/friend
// clusters.
declare module 'd3-force-clustering' {
  interface ClusteringForce {
    (alpha: number): void
    initialize?: (nodes: unknown[], ...args: unknown[]) => void
    clusterId(
      fn: (node: unknown) => string | number | null | undefined,
    ): ClusteringForce
    strength(
      strength:
        | number
        | ((clusterId: unknown, clusterNodes: unknown[]) => number),
    ): ClusteringForce
    distanceMin(distance: number): ClusteringForce
  }

  export default function forceClustering(): ClusteringForce
}
