import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  BoardResponse,
  BoardSnapshotResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

import {
  createBoard,
  createEdgeOnBoard,
  createNodeOnBoard,
  getBoardSnapshot,
  listBoards,
  removeEdgeFromBoard,
  removeNodeFromBoard,
  updateBoardNode,
  updateEdge,
  updateNode,
  type RemoveEdgeFromBoardInput,
  type RemoveNodeFromBoardInput,
  type UpdateEdgeInput,
  type UpdateNodeInput,
} from "./graph.api";

export const graphQueryKeys = {
  boards: (workspaceId: string, storyId: string) =>
    ["graph", "boards", workspaceId, storyId] as const,
  snapshot: (workspaceId: string, boardId: string) =>
    ["graph", "snapshot", workspaceId, boardId] as const,
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

export function useCreateNodeOnBoardMutation() {
  return useMutation({ mutationFn: createNodeOnBoard });
}

export function useCreateEdgeOnBoardMutation() {
  return useMutation({ mutationFn: createEdgeOnBoard });
}

export function useUpdateNodeMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNodeInput) => updateNode(input),
    onSuccess: (node) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => replaceSnapshotNode(current, node),
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
    mutationFn: (input: UpdateEdgeInput) => updateEdge(input),
    onSuccess: (edge) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => replaceSnapshotEdge(current, edge),
      );
    },
  });
}

export function useUpdateBoardNodeMutation() {
  return useMutation({ mutationFn: updateBoardNode });
}

export function useRemoveNodeFromBoardMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoveNodeFromBoardInput) => removeNodeFromBoard(input),
    onSuccess: (_result, input) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => detachSnapshotNode(current, input.nodeId),
      );
    },
  });
}

export function useRemoveEdgeFromBoardMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoveEdgeFromBoardInput) => removeEdgeFromBoard(input),
    onSuccess: (_result, input) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => detachSnapshotEdge(current, input.edgeId),
      );
    },
  });
}

function replaceSnapshotNode(
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

function replaceSnapshotEdge(
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

function detachSnapshotNode(
  current: BoardSnapshotResponse | undefined,
  nodeId: string,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  const incidentEdgeIds = new Set(
    current.edges
      .filter(
        (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
      )
      .map((edge) => edge.id),
  );
  return {
    ...current,
    nodes: current.nodes.filter((node) => node.id !== nodeId),
    boardNodes: current.boardNodes.filter(
      (boardNode) => boardNode.nodeId !== nodeId,
    ),
    edges: current.edges.filter((edge) => !incidentEdgeIds.has(edge.id)),
    boardEdges: current.boardEdges.filter(
      (boardEdge) => !incidentEdgeIds.has(boardEdge.edgeId),
    ),
  };
}

function detachSnapshotEdge(
  current: BoardSnapshotResponse | undefined,
  edgeId: string,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    edges: current.edges.filter((edge) => edge.id !== edgeId),
    boardEdges: current.boardEdges.filter((boardEdge) => boardEdge.edgeId !== edgeId),
  };
}
