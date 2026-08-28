import {
  boardNodeResponseSchema,
  boardResponseSchema,
  boardSnapshotResponseSchema,
  createBoardRequestSchema,
  createNodeRequestSchema,
  createNodeResponseSchema,
  listBoardsResponseSchema,
  updateBoardNodeRequestSchema,
  type BoardNodeResponse,
  type BoardResponse,
  type BoardSnapshotResponse,
  type GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

import { apiClient } from "../client/api-client";

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
  name: string;
  description: string;
}): Promise<BoardResponse> {
  const payload = createBoardRequestSchema.parse({
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
  });
  const response = await apiClient.post(`/stories/${input.storyId}/boards`, payload);
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
