// d3-force-3d ships no types; force-graph depends on it internally, and we
// use it directly to add a collision force to the people graph. This is a
// minimal ambient declaration covering just what we call.
declare module 'd3-force-3d' {
  interface Force {
    (alpha: number): void
    initialize?: (nodes: unknown[], ...args: unknown[]) => void
    [key: string]: unknown
  }

  interface CollideForce extends Force {
    radius(radius: number | ((node: unknown) => number)): CollideForce
    strength(strength: number): CollideForce
  }

  export function forceCollide(
    radius?: number | ((node: unknown) => number),
  ): CollideForce

  interface RadialForce extends Force {
    radius(radius: number | ((node: unknown) => number)): RadialForce
    strength(strength: number | ((node: unknown) => number)): RadialForce
    x(x: number): RadialForce
    y(y: number): RadialForce
  }

  export function forceRadial(
    radius?: number | ((node: unknown) => number),
    x?: number,
    y?: number,
  ): RadialForce
}
