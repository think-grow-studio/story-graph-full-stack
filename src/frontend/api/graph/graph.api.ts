import {
  boardNodeResponseSchema,
  boardResponseSchema,
  boardSnapshotResponseSchema,
  createBoardRequestSchema,
  createEdgeRequestSchema,
  createEdgeResponseSchema,
  createNodeRequestSchema,
  createNodeResponseSchema,
  createScopeRequestSchema,
  edgeStateResponseSchema,
  graphEdgeResponseSchema,
  graphNodeResponseSchema,
  listBoardsResponseSchema,
  listScopesResponseSchema,
  listStoryNodesResponseSchema,
  nodeStateResponseSchema,
  placeBoardNodeRequestSchema,
  putEdgeStateRequestSchema,
  putNodeStateRequestSchema,
  restoreBoardEdgeRequestSchema,
  restoreBoardNodeRequestSchema,
  restoreBoardNodeResponseSchema,
  scopeResponseSchema,
  updateBoardNodeRequestSchema,
  updateEdgeRequestSchema,
  updateNodeRequestSchema,
  type BoardEdgeResponse,
  type BoardNodeResponse,
  type BoardResponse,
  type BoardSnapshotResponse,
  type EdgeStateResponse,
  type GraphEdgeResponse,
  type GraphNodeResponse,
  type NodeStateResponse,
  type RestoreBoardNodeResponse,
  type ScopeResponse,
} from "@/contracts/graph/graph.contract";

import { apiClient } from "../client/api-client";

export async function listScopes(
  storyId: string,
  workspaceId: string,
): Promise<ScopeResponse[]> {
  const response = await apiClient.get(`/stories/${storyId}/scopes`, {
    params: { workspaceId },
  });
  return listScopesResponseSchema.parse(response.data).scopes;
}

export async function createScope(input: {
  storyId: string;
  workspaceId: string;
  name: string;
  description: string;
}): Promise<ScopeResponse> {
  const payload = createScopeRequestSchema.parse({
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
  });
  const response = await apiClient.post(`/stories/${input.storyId}/scopes`, payload);
  return scopeResponseSchema.parse(response.data);
}

export async function listBoards(
  storyId: string,
  workspaceId: string,
): Promise<BoardResponse[]> {
  const response = await apiClient.get(`/stories/${storyId}/boards`, {
    params: { workspaceId },
  });
  return listBoardsResponseSchema.parse(response.data).boards;
}

export async function createBoard(input: {
  storyId: string;
  workspaceId: string;
  scopeId: string | null;
  name: string;
  description: string;
}): Promise<BoardResponse> {
  const payload = createBoardRequestSchema.parse({
    workspaceId: input.workspaceId,
    scopeId: input.scopeId,
    name: input.name,
    description: input.description,
  });
  const response = await apiClient.post(`/stories/${input.storyId}/boards`, payload);
  return boardResponseSchema.parse(response.data);
}

export async function listStoryNodes(
  storyId: string,
  workspaceId: string,
): Promise<GraphNodeResponse[]> {
  const response = await apiClient.get(`/stories/${storyId}/nodes`, {
    params: { workspaceId },
  });
  return listStoryNodesResponseSchema.parse(response.data).nodes;
}

export async function getBoardSnapshot(
  boardId: string,
  workspaceId: string,
): Promise<BoardSnapshotResponse> {
  const response = await apiClient.get(`/boards/${boardId}/snapshot`, {
    params: { workspaceId },
  });
  return boardSnapshotResponseSchema.parse(response.data);
}

export type CreateNodeOnBoardInput = {
  boardId: string;
  workspaceId: string;
  id: string;
  name: string;
  position: { x: number; y: number };
};

export async function createNodeOnBoard(
  input: CreateNodeOnBoardInput,
): Promise<{ node: GraphNodeResponse; boardNode: BoardNodeResponse }> {
  const payload = createNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    id: input.id,
    name: input.name,
    description: "",
    iconKey: null,
    properties: {},
    position: input.position,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
  });
  const response = await apiClient.post(`/boards/${input.boardId}/nodes`, payload);
  return createNodeResponseSchema.parse(response.data);
}

export type PlaceNodeOnBoardInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
  position: { x: number; y: number };
};

export async function placeNodeOnBoard(
  input: PlaceNodeOnBoardInput,
): Promise<{ node: GraphNodeResponse; boardNode: BoardNodeResponse }> {
  const payload = placeBoardNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    x: input.position.x,
    y: input.position.y,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
  });
  const response = await apiClient.put(
    `/boards/${input.boardId}/nodes/${input.nodeId}/presentation`,
    payload,
  );
  return createNodeResponseSchema.parse(response.data);
}

export type CreateEdgeOnBoardInput = {
  boardId: string;
  workspaceId: string;
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
};

export async function createEdgeOnBoard(
  input: CreateEdgeOnBoardInput,
): Promise<{ edge: GraphEdgeResponse; boardEdge: BoardEdgeResponse }> {
  const payload = createEdgeRequestSchema.parse({
    workspaceId: input.workspaceId,
    id: input.id,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    name: input.name,
    description: "",
    iconKey: null,
    properties: {},
  });
  const response = await apiClient.post(`/boards/${input.boardId}/edges`, payload);
  return createEdgeResponseSchema.parse(response.data);
}

export type UpdateNodeInput = {
  nodeId: string;
  workspaceId: string;
  version: number;
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export async function updateNode(input: UpdateNodeInput): Promise<GraphNodeResponse> {
  const payload = updateNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    version: input.version,
    name: input.name,
    description: input.description,
    properties: input.properties,
  });
  const response = await apiClient.patch(`/nodes/${input.nodeId}`, payload);
  return graphNodeResponseSchema.parse(response.data);
}

export type UpdateNodeStateInput = {
  scopeId: string;
  nodeId: string;
  workspaceId: string;
  version: number | null;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
};

export async function updateNodeState(
  input: UpdateNodeStateInput,
): Promise<NodeStateResponse> {
  const payload = putNodeStateRequestSchema.parse({
    workspaceId: input.workspaceId,
    version: input.version,
    name: input.name,
    description: input.description,
    properties: input.properties,
  });
  const response = await apiClient.put(
    `/scopes/${input.scopeId}/nodes/${input.nodeId}/state`,
    payload,
  );
  return nodeStateResponseSchema.parse(response.data);
}

export type UpdateEdgeInput = {
  edgeId: string;
  workspaceId: string;
  version: number;
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export async function updateEdge(input: UpdateEdgeInput): Promise<GraphEdgeResponse> {
  const payload = updateEdgeRequestSchema.parse({
    workspaceId: input.workspaceId,
    version: input.version,
    name: input.name,
    description: input.description,
    properties: input.properties,
  });
  const response = await apiClient.patch(`/edges/${input.edgeId}`, payload);
  return graphEdgeResponseSchema.parse(response.data);
}

export type UpdateEdgeStateInput = {
  scopeId: string;
  edgeId: string;
  workspaceId: string;
  version: number | null;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
};

export async function updateEdgeState(
  input: UpdateEdgeStateInput,
): Promise<EdgeStateResponse> {
  const payload = putEdgeStateRequestSchema.parse({
    workspaceId: input.workspaceId,
    version: input.version,
    name: input.name,
    description: input.description,
    properties: input.properties,
  });
  const response = await apiClient.put(
    `/scopes/${input.scopeId}/edges/${input.edgeId}/state`,
    payload,
  );
  return edgeStateResponseSchema.parse(response.data);
}

export type UpdateBoardNodeInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
  x: number;
  y: number;
};

export async function updateBoardNode(
  input: UpdateBoardNodeInput,
): Promise<BoardNodeResponse> {
  const payload = updateBoardNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    x: input.x,
    y: input.y,
  });
  const response = await apiClient.patch(
    `/boards/${input.boardId}/nodes/${input.nodeId}`,
    payload,
  );
  return boardNodeResponseSchema.parse(response.data);
}

export type RemoveNodeFromBoardInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
};

export async function removeNodeFromBoard(
  input: RemoveNodeFromBoardInput,
): Promise<void> {
  await apiClient.delete(`/boards/${input.boardId}/nodes/${input.nodeId}`, {
    params: { workspaceId: input.workspaceId },
  });
}

export type RestoreNodeToBoardInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
  boardNode: Pick<
    BoardNodeResponse,
    "x" | "y" | "width" | "height" | "zIndex" | "style"
  >;
  boardEdges: Array<
    Pick<BoardEdgeResponse, "edgeId" | "style" | "labelPresentation">
  >;
};

export async function restoreNodeToBoard(
  input: RestoreNodeToBoardInput,
): Promise<RestoreBoardNodeResponse> {
  const payload = restoreBoardNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    x: input.boardNode.x,
    y: input.boardNode.y,
    width: input.boardNode.width,
    height: input.boardNode.height,
    zIndex: input.boardNode.zIndex,
    style: input.boardNode.style,
    boardEdges: input.boardEdges,
  });
  const response = await apiClient.put(
    `/boards/${input.boardId}/nodes/${input.nodeId}`,
    payload,
  );
  return restoreBoardNodeResponseSchema.parse(response.data);
}

export type RemoveEdgeFromBoardInput = {
  boardId: string;
  edgeId: string;
  workspaceId: string;
};

export async function removeEdgeFromBoard(
  input: RemoveEdgeFromBoardInput,
): Promise<void> {
  await apiClient.delete(`/boards/${input.boardId}/edges/${input.edgeId}`, {
    params: { workspaceId: input.workspaceId },
  });
}

export type RestoreEdgeToBoardInput = {
  boardId: string;
  edgeId: string;
  workspaceId: string;
  style: Record<string, unknown>;
  labelPresentation: Record<string, unknown>;
};

export async function restoreEdgeToBoard(
  input: RestoreEdgeToBoardInput,
): Promise<{ edge: GraphEdgeResponse; boardEdge: BoardEdgeResponse }> {
  const payload = restoreBoardEdgeRequestSchema.parse({
    workspaceId: input.workspaceId,
    style: input.style,
    labelPresentation: input.labelPresentation,
  });
  const response = await apiClient.put(
    `/boards/${input.boardId}/edges/${input.edgeId}`,
    payload,
  );
  return createEdgeResponseSchema.parse(response.data);
}
