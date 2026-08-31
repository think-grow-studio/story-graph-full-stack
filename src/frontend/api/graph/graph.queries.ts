import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  BoardEdgeResponse,
  BoardResponse,
  BoardSnapshotResponse,
  EdgeStateResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
  NodeStateResponse,
  RestoreBoardNodeResponse,
  ScopeResponse,
} from "@/contracts/graph/graph.contract";

import {
  createBoard,
  createEdgeOnBoard,
  createNodeOnBoard,
  createScope,
  getBoardSnapshot,
  listBoards,
  listScopes,
  listStoryNodes,
  placeNodeOnBoard,
  removeEdgeFromBoard,
  removeNodeFromBoard,
  restoreEdgeToBoard,
  restoreNodeToBoard,
  updateBoardNode,
  updateEdge,
  updateEdgeState,
  updateNode,
  updateNodeState,
  type PlaceNodeOnBoardInput,
  type RemoveEdgeFromBoardInput,
  type RemoveNodeFromBoardInput,
  type RestoreEdgeToBoardInput,
  type RestoreNodeToBoardInput,
  type UpdateEdgeInput,
  type UpdateEdgeStateInput,
  type UpdateNodeInput,
  type UpdateNodeStateInput,
} from "./graph.api";

export const graphQueryKeys = {
  scopes: (workspaceId: string, storyId: string) =>
    ["graph", "scopes", workspaceId, storyId] as const,
  boards: (workspaceId: string, storyId: string) =>
    ["graph", "boards", workspaceId, storyId] as const,
  nodes: (workspaceId: string, storyId: string) =>
    ["graph", "nodes", workspaceId, storyId] as const,
  snapshot: (workspaceId: string, boardId: string) =>
    ["graph", "snapshot", workspaceId, boardId] as const,
};

export function useScopesQuery(
  workspaceId: string | undefined,
  storyId: string,
) {
  return useQuery({
    queryKey: workspaceId
      ? graphQueryKeys.scopes(workspaceId, storyId)
      : ["graph", "scopes", "pending", storyId],
    queryFn: () => listScopes(storyId, workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateScopeMutation(
  workspaceId: string | undefined,
  storyId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description: string }) => {
      if (!workspaceId) {
        throw new Error("Workspace is not ready");
      }
      return createScope({ storyId, workspaceId, ...input });
    },
    onSuccess: (created) => {
      if (!workspaceId) return;
      queryClient.setQueryData<ScopeResponse[]>(
        graphQueryKeys.scopes(workspaceId, storyId),
        (current = []) => [...current, created],
      );
    },
  });
}

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
    mutationFn: (input: {
      name: string;
      description: string;
      scopeId: string | null;
    }) => {
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

export function useStoryNodesQuery(
  workspaceId: string | undefined,
  storyId: string,
) {
  return useQuery({
    queryKey: workspaceId
      ? graphQueryKeys.nodes(workspaceId, storyId)
      : ["graph", "nodes", "pending", storyId],
    queryFn: () => listStoryNodes(storyId, workspaceId!),
    enabled: Boolean(workspaceId),
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

export function usePlaceNodeOnBoardMutation(
  workspaceId?: string,
  boardId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaceNodeOnBoardInput) => placeNodeOnBoard(input),
    onSuccess: (placed) => {
      if (!workspaceId || !boardId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => addSnapshotNode(current, placed),
      );
    },
  });
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

export function useUpdateNodeStateMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNodeStateInput) => updateNodeState(input),
    onSuccess: (nodeState) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => replaceSnapshotNodeState(current, nodeState),
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

export function useUpdateEdgeStateMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEdgeStateInput) => updateEdgeState(input),
    onSuccess: (edgeState) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => replaceSnapshotEdgeState(current, edgeState),
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

export function useRestoreNodeToBoardMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RestoreNodeToBoardInput) => restoreNodeToBoard(input),
    onSuccess: (restored) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => restoreSnapshotNode(current, restored),
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

export function useRestoreEdgeToBoardMutation(
  workspaceId: string | undefined,
  boardId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RestoreEdgeToBoardInput) => restoreEdgeToBoard(input),
    onSuccess: (restored) => {
      if (!workspaceId) return;
      queryClient.setQueryData<BoardSnapshotResponse>(
        graphQueryKeys.snapshot(workspaceId, boardId),
        (current) => restoreSnapshotEdge(current, restored),
      );
    },
  });
}

function addSnapshotNode(
  current: BoardSnapshotResponse | undefined,
  placed: { node: GraphNodeResponse; boardNode: BoardSnapshotResponse["boardNodes"][number] },
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    nodes: [
      ...current.nodes.filter((node) => node.id !== placed.node.id),
      placed.node,
    ],
    boardNodes: [
      ...current.boardNodes.filter(
        (boardNode) => boardNode.nodeId !== placed.boardNode.nodeId,
      ),
      placed.boardNode,
    ],
  };
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

function replaceSnapshotNodeState(
  current: BoardSnapshotResponse | undefined,
  nodeState: NodeStateResponse,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    nodeStates: [
      ...current.nodeStates.filter(
        (candidate) =>
          candidate.scopeId !== nodeState.scopeId || candidate.nodeId !== nodeState.nodeId,
      ),
      nodeState,
    ],
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

function replaceSnapshotEdgeState(
  current: BoardSnapshotResponse | undefined,
  edgeState: EdgeStateResponse,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    edgeStates: [
      ...current.edgeStates.filter(
        (candidate) =>
          candidate.scopeId !== edgeState.scopeId || candidate.edgeId !== edgeState.edgeId,
      ),
      edgeState,
    ],
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
    nodeStates: current.nodeStates.filter((state) => state.nodeId !== nodeId),
    boardNodes: current.boardNodes.filter(
      (boardNode) => boardNode.nodeId !== nodeId,
    ),
    edges: current.edges.filter((edge) => !incidentEdgeIds.has(edge.id)),
    edgeStates: current.edgeStates.filter((state) => !incidentEdgeIds.has(state.edgeId)),
    boardEdges: current.boardEdges.filter(
      (boardEdge) => !incidentEdgeIds.has(boardEdge.edgeId),
    ),
  };
}

function restoreSnapshotNode(
  current: BoardSnapshotResponse | undefined,
  restored: RestoreBoardNodeResponse,
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  const edgeIds = new Set(restored.edges.map((edge) => edge.id));
  const boardEdgeIds = new Set(
    restored.boardEdges.map((boardEdge) => boardEdge.edgeId),
  );
  return {
    ...current,
    nodes: [
      ...current.nodes.filter((node) => node.id !== restored.node.id),
      restored.node,
    ],
    boardNodes: [
      ...current.boardNodes.filter(
        (boardNode) => boardNode.nodeId !== restored.boardNode.nodeId,
      ),
      restored.boardNode,
    ],
    edges: [
      ...current.edges.filter((edge) => !edgeIds.has(edge.id)),
      ...restored.edges,
    ],
    boardEdges: [
      ...current.boardEdges.filter(
        (boardEdge) => !boardEdgeIds.has(boardEdge.edgeId),
      ),
      ...restored.boardEdges,
    ],
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
    edgeStates: current.edgeStates.filter((state) => state.edgeId !== edgeId),
    boardEdges: current.boardEdges.filter((boardEdge) => boardEdge.edgeId !== edgeId),
  };
}

function restoreSnapshotEdge(
  current: BoardSnapshotResponse | undefined,
  restored: { edge: GraphEdgeResponse; boardEdge: BoardEdgeResponse },
): BoardSnapshotResponse | undefined {
  if (!current) return current;
  return {
    ...current,
    edges: [
      ...current.edges.filter((edge) => edge.id !== restored.edge.id),
      restored.edge,
    ],
    boardEdges: [
      ...current.boardEdges.filter(
        (boardEdge) => boardEdge.edgeId !== restored.boardEdge.edgeId,
      ),
      restored.boardEdge,
    ],
  };
}
