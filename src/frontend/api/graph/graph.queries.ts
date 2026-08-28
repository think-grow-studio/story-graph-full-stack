import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { BoardResponse } from "@/contracts/graph/graph.contract";

import { createBoard, listBoards } from "./graph.api";

export const graphQueryKeys = {
  boards: (workspaceId: string, storyId: string) =>
    ["graph", "boards", workspaceId, storyId] as const,
};

export function useBoardsQuery(
  workspaceId: string | undefined,
  storyId: string,
) {
  return useQuery({
    queryKey: workspaceId
      ? graphQueryKeys.boards(workspaceId, storyId)
      : ["graph", "boards", "pending", storyId],
    queryFn: () => listBoards(storyId, workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateBoardMutation(
  workspaceId: string | undefined,
  storyId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description: string }) => {
      if (!workspaceId) {
        throw new Error("Workspace is not ready");
      }
      return createBoard({ storyId, workspaceId, ...input });
    },
    onSuccess: (created) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardResponse[]>(
        graphQueryKeys.boards(workspaceId, storyId),
        (current = []) => [...current, created],
      );
    },
  });
}
