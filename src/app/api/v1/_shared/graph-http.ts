import type {
  Board,
  BoardSnapshot,
  GraphEdge,
  GraphNode,
} from "@/backend/modules/graph/domain/graph";
import {
  boardResponseSchema,
  boardSnapshotResponseSchema,
  graphEdgeResponseSchema,
  graphNodeResponseSchema,
} from "@/contracts/graph/graph.contract";

export function toBoardResponse(value: Board) {
  return boardResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

export function toGraphNodeResponse(value: GraphNode) {
  return graphNodeResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

export function toGraphEdgeResponse(value: GraphEdge) {
  return graphEdgeResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

export function toBoardSnapshotResponse(input: {
  story: { id: string; name: string };
  snapshot: BoardSnapshot;
}) {
  return boardSnapshotResponseSchema.parse({
    story: input.story,
    board: toBoardResponse(input.snapshot.board),
    nodes: input.snapshot.nodes.map(toGraphNodeResponse),
    edges: input.snapshot.edges.map(toGraphEdgeResponse),
  });
}
