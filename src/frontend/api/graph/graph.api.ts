import {
  boardResponseSchema,
  createBoardRequestSchema,
  listBoardsResponseSchema,
  type BoardResponse,
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
