import {
  boardResponseSchema,
  boardSnapshotResponseSchema,
  createBoardRequestSchema,
  createEdgeRequestSchema,
  createNodeRequestSchema,
  graphEdgeResponseSchema,
  graphNodeResponseSchema,
  listBoardsResponseSchema,
  restoreEdgeRequestSchema,
  restoreNodeRequestSchema,
  restoreNodeResponseSchema,
  updateBoardRequestSchema,
  updateEdgeRequestSchema,
  updateNodeRequestSchema,
  type BoardResponse,
  type BoardSnapshotResponse,
  type GraphEdgeResponse,
  type GraphNodeResponse,
  type RestoreNodeResponse,
} from "@/contracts/graph/graph.contract";

import { apiClient } from "../client/api-client";

export type RestorableNode = Omit<GraphNodeResponse, "createdAt" | "updatedAt">;
export type RestorableEdge = Omit<GraphEdgeResponse, "createdAt" | "updatedAt">;

export async function listBoards(
  storyId: string,
  workspaceId: string,
): Promise<BoardResponse[]> {
  const response = await apiClient.get(`/stories/${storyId}/boards`, {
    params: { workspaceId },
  });
  return listBoardsResponseSchema.parse(response.data).boards;
}

export type CreateBoardInput = {
  storyId: string;
  workspaceId: string;
  name: string;
  description: string;
  tags: string[];
};

export async function createBoard(input: CreateBoardInput): Promise<BoardResponse> {
  const payload = createBoardRequestSchema.parse({
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
    tags: input.tags,
  });
  const response = await apiClient.post(`/stories/${input.storyId}/boards`, payload);
  return boardResponseSchema.parse(response.data);
}

export type UpdateBoardInput = {
  boardId: string;
  workspaceId: string;
  name?: string;
  description?: string;
  tags?: string[];
};

export async function updateBoard(input: UpdateBoardInput): Promise<BoardResponse> {
  const payload = updateBoardRequestSchema.parse({
    workspaceId: input.workspaceId,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
  });
  const response = await apiClient.patch(`/boards/${input.boardId}`, payload);
  return boardResponseSchema.parse(response.data);
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

export type CreateNodeInput = {
  boardId: string;
  workspaceId: string;
  id: string;
  name: string;
  description?: string;
  iconKey?: string | null;
  properties?: Record<string, unknown>;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  zIndex?: number;
  style?: Record<string, unknown>;
};

export async function createNode(input: CreateNodeInput): Promise<GraphNodeResponse> {
  const payload = createNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    id: input.id,
    name: input.name,
    description: input.description ?? "",
    iconKey: input.iconKey ?? null,
    properties: input.properties ?? {},
    x: input.x,
    y: input.y,
    width: input.width ?? null,
    height: input.height ?? null,
    zIndex: input.zIndex ?? 0,
    style: input.style ?? {},
  });
  const response = await apiClient.post(`/boards/${input.boardId}/nodes`, payload);
  return graphNodeResponseSchema.parse(response.data);
}

export type UpdateNodeInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
  expectedVersion: number;
  name?: string;
  description?: string;
  iconKey?: string | null;
  properties?: Record<string, unknown>;
  x?: number;
  y?: number;
  width?: number | null;
  height?: number | null;
  zIndex?: number;
  style?: Record<string, unknown>;
};

export async function updateNode(input: UpdateNodeInput): Promise<GraphNodeResponse> {
  const payload = updateNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    expectedVersion: input.expectedVersion,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
    ...(input.x !== undefined ? { x: input.x } : {}),
    ...(input.y !== undefined ? { y: input.y } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.zIndex !== undefined ? { zIndex: input.zIndex } : {}),
    ...(input.style !== undefined ? { style: input.style } : {}),
  });
  const response = await apiClient.patch(
    `/boards/${input.boardId}/nodes/${input.nodeId}`,
    payload,
  );
  return graphNodeResponseSchema.parse(response.data);
}

export type DeleteNodeInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
};

export async function deleteNode(input: DeleteNodeInput): Promise<void> {
  await apiClient.delete(`/boards/${input.boardId}/nodes/${input.nodeId}`, {
    params: { workspaceId: input.workspaceId },
  });
}

export type RestoreNodeInput = {
  boardId: string;
  nodeId: string;
  workspaceId: string;
  node: RestorableNode;
  edges: RestorableEdge[];
};

export async function restoreNode(input: RestoreNodeInput): Promise<RestoreNodeResponse> {
  const payload = restoreNodeRequestSchema.parse({
    workspaceId: input.workspaceId,
    node: input.node,
    edges: input.edges,
  });
  const response = await apiClient.post(
    `/boards/${input.boardId}/nodes/${input.nodeId}/restore`,
    payload,
  );
  return restoreNodeResponseSchema.parse(response.data);
}

export type CreateEdgeInput = {
  boardId: string;
  workspaceId: string;
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description?: string;
  iconKey?: string | null;
  properties?: Record<string, unknown>;
  style?: Record<string, unknown>;
  labelPresentation?: Record<string, unknown>;
};

export async function createEdge(input: CreateEdgeInput): Promise<GraphEdgeResponse> {
  const payload = createEdgeRequestSchema.parse({
    workspaceId: input.workspaceId,
    id: input.id,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    name: input.name,
    description: input.description ?? "",
    iconKey: input.iconKey ?? null,
    properties: input.properties ?? {},
    style: input.style ?? {},
    labelPresentation: input.labelPresentation ?? {},
  });
  const response = await apiClient.post(`/boards/${input.boardId}/edges`, payload);
  return graphEdgeResponseSchema.parse(response.data);
}

export type UpdateEdgeInput = {
  boardId: string;
  edgeId: string;
  workspaceId: string;
  expectedVersion: number;
  name?: string;
  description?: string;
  iconKey?: string | null;
  properties?: Record<string, unknown>;
  style?: Record<string, unknown>;
  labelPresentation?: Record<string, unknown>;
};

export async function updateEdge(input: UpdateEdgeInput): Promise<GraphEdgeResponse> {
  const payload = updateEdgeRequestSchema.parse({
    workspaceId: input.workspaceId,
    expectedVersion: input.expectedVersion,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
    ...(input.style !== undefined ? { style: input.style } : {}),
    ...(input.labelPresentation !== undefined
      ? { labelPresentation: input.labelPresentation }
      : {}),
  });
  const response = await apiClient.patch(
    `/boards/${input.boardId}/edges/${input.edgeId}`,
    payload,
  );
  return graphEdgeResponseSchema.parse(response.data);
}

export type DeleteEdgeInput = {
  boardId: string;
  edgeId: string;
  workspaceId: string;
};

export async function deleteEdge(input: DeleteEdgeInput): Promise<void> {
  await apiClient.delete(`/boards/${input.boardId}/edges/${input.edgeId}`, {
    params: { workspaceId: input.workspaceId },
  });
}

export type RestoreEdgeInput = {
  boardId: string;
  edgeId: string;
  workspaceId: string;
  edge: RestorableEdge;
};

export async function restoreEdge(input: RestoreEdgeInput): Promise<GraphEdgeResponse> {
  const payload = restoreEdgeRequestSchema.parse({
    workspaceId: input.workspaceId,
    edge: input.edge,
  });
  const response = await apiClient.post(
    `/boards/${input.boardId}/edges/${input.edgeId}/restore`,
    payload,
  );
  return graphEdgeResponseSchema.parse(response.data);
}
