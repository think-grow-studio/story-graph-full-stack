import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  BoardResponse,
  BoardSnapshotResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

import {
  createBoard,
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  getBoardSnapshot,
  listBoards,
  restoreEdge,
  restoreNode,
  updateBoard,
  updateEdge,
  updateNode,
  type CreateBoardInput,
  type CreateEdgeInput,
  type CreateNodeInput,
  type DeleteEdgeInput,
  type DeleteNodeInput,
  type RestoreEdgeInput,
  type RestoreNodeInput,
  type UpdateBoardInput,
  type UpdateEdgeInput,
  type UpdateNodeInput,
} from "./graph.api";

export const graphQueryKeys = {
  boards: (workspaceId: string, storyId: string) =>
    ["graph", "boards", workspaceId, storyId] as const,
  snapshot: (workspaceId: string, boardId: string) =>
    ["graph", "snapshot", workspaceId, boardId] as const,
};

export function useBoardsQuery(workspaceId: string | undefined, storyId: string) {
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
    mutationFn: (input: Omit<CreateBoardInput, "storyId" | "workspaceId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return createBoard({ ...input, storyId, workspaceId });
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

export function useUpdateBoardMutation(
  workspaceId: string | undefined,
  storyId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UpdateBoardInput, "workspaceId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return updateBoard({ ...input, workspaceId });
    },
    onSuccess: (updated) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardResponse[]>(
        graphQueryKeys.boards(workspaceId, storyId),
        (current = []) =>
          current.map((board) => (board.id === updated.id ? updated : board)),
      );
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, updated.id),
        (current) => (current ? { ...current, board: updated } : current),
      );
    },
  });
}

export function useBoardSnapshotQuery(
  workspaceId: string | undefined,
  boardId: string,
) {
  return useQuery({
    queryKey: workspaceId
      ? graphQueryKeys.snapshot(workspaceId, boardId)
      : ["graph", "snapshot", "pending", boardId],
    queryFn: () => getBoardSnapshot(boardId, workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateNodeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateNodeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return createNode({ ...input, workspaceId, boardId });
    },
    onSuccess: (created) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) =>
          current
            ? {
                ...current,
                nodes: [
                  ...current.nodes.filter((node) => node.id !== created.id),
                  created,
                ],
              }
            : current,
      );
    },
  });
}

export function useUpdateNodeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UpdateNodeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return updateNode({ ...input, workspaceId, boardId });
    },
    onSuccess: (updated) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => replaceNode(current, updated),
      );
    },
  });
}

export function useDeleteNodeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DeleteNodeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return deleteNode({ ...input, workspaceId, boardId });
    },
    onSuccess: (_result, input) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => removeNode(current, input.nodeId),
      );
    },
  });
}

export function useRestoreNodeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<RestoreNodeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return restoreNode({ ...input, workspaceId, boardId });
    },
    onSuccess: (restored) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => {
          if (!current) return current;
          const edgeIds = new Set(restored.edges.map((edge) => edge.id));
          return {
            ...current,
            nodes: [
              ...current.nodes.filter((node) => node.id !== restored.node.id),
              restored.node,
            ],
            edges: [
              ...current.edges.filter((edge) => !edgeIds.has(edge.id)),
              ...restored.edges,
            ],
          };
        },
      );
    },
  });
}

export function useCreateEdgeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateEdgeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return createEdge({ ...input, workspaceId, boardId });
    },
    onSuccess: (created) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) =>
          current
            ? {
                ...current,
                edges: [
                  ...current.edges.filter((edge) => edge.id !== created.id),
                  created,
                ],
              }
            : current,
      );
    },
  });
}

export function useUpdateEdgeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<UpdateEdgeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return updateEdge({ ...input, workspaceId, boardId });
    },
    onSuccess: (updated) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => replaceEdge(current, updated),
      );
    },
  });
}

export function useDeleteEdgeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DeleteEdgeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return deleteEdge({ ...input, workspaceId, boardId });
    },
    onSuccess: (_result, input) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) =>
          current
            ? {
                ...current,
                edges: current.edges.filter((edge) => edge.id !== input.edgeId),
              }
            : current,
      );
    },
  });
}

export function useRestoreEdgeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<RestoreEdgeInput, "workspaceId" | "boardId">) => {
      if (!workspaceId) throw new Error("Workspace is not ready");
      return restoreEdge({ ...input, workspaceId, boardId });
    },
    onSuccess: (restored) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) =>
          current
            ? {
                ...current,
                edges: [
                  ...current.edges.filter((edge) => edge.id !== restored.id),
                  restored,
                ],
              }
            : current,
      );
    },
  });
}

function replaceNode(
  current: BoardSnapshotResponse | undefined,
  node: GraphNodeResponse,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    nodes: current.nodes.map((candidate) =>
      candidate.id === node.id ? node : candidate,
    ),
  };
}

function removeNode(
  current: BoardSnapshotResponse | undefined,
  nodeId: string,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    nodes: current.nodes.filter((node) => node.id !== nodeId),
    edges: current.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    ),
  };
}

function replaceEdge(
  current: BoardSnapshotResponse | undefined,
  edge: GraphEdgeResponse,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    edges: current.edges.map((candidate) =>
      candidate.id === edge.id ? edge : candidate,
    ),
  };
}
