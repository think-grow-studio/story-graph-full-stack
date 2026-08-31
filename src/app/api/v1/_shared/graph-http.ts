import type {
  Board,
  BoardEdge,
  BoardNode,
  BoardSnapshot,
  EdgeState,
  GraphEdge,
  GraphNode,
  NodeState,
  Scope,
} from "@/backend/modules/graph/domain/graph";
import {
  boardEdgeResponseSchema,
  boardNodeResponseSchema,
  boardResponseSchema,
  boardSnapshotResponseSchema,
  edgeStateResponseSchema,
  graphEdgeResponseSchema,
  graphNodeResponseSchema,
  nodeStateResponseSchema,
  scopeResponseSchema,
} from "@/contracts/graph/graph.contract";

export function toScopeResponse(value: Scope) {
  return scopeResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

export function toNodeStateResponse(value: NodeState) {
  return nodeStateResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

export function toEdgeStateResponse(value: EdgeState) {
  return edgeStateResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

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

export function toBoardNodeResponse(value: BoardNode) {
  return boardNodeResponseSchema.parse({
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  });
}

export function toBoardEdgeResponse(value: BoardEdge) {
  return boardEdgeResponseSchema.parse({
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
    scope: input.snapshot.scope ? toScopeResponse(input.snapshot.scope) : null,
    nodes: input.snapshot.nodes.map(toGraphNodeResponse),
    nodeStates: input.snapshot.nodeStates.map(toNodeStateResponse),
    edges: input.snapshot.edges.map(toGraphEdgeResponse),
    edgeStates: input.snapshot.edgeStates.map(toEdgeStateResponse),
    boardNodes: input.snapshot.boardNodes.map(toBoardNodeResponse),
    boardEdges: input.snapshot.boardEdges.map(toBoardEdgeResponse),
  });
}
