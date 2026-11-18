// A request to pan/zoom the graph onto something just created, e.g. right
// after adding a person or a connection. `requestId` makes each request
// distinct even if it targets the same person/connection as the last one,
// so the effect that watches for it always re-fires.
export type GraphFocusRequest =
  | { kind: 'person'; personId: string; requestId: number }
  | {
      kind: 'connection'
      personAId: string
      personBId: string
      requestId: number
    }
