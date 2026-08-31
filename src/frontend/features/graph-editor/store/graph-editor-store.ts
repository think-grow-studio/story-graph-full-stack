import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  GraphEditorEdgePair,
  GraphEditorNodePair,
  GraphEditorState,
} from "../model/editor-types";

export type GraphEditorStore = StoreApi<GraphEditorState>;

export function createGraphEditorStore(): GraphEditorStore {
  return createStore<GraphEditorState>()((set, get) => ({
    scope: null,
    nodes: [],
    nodeStates: [],
    edges: [],
    edgeStates: [],
    boardNodes: [],
    boardEdges: [],
    hydrate: (snapshot) =>
      set({
        scope: snapshot.scope ?? null,
        nodes: [...snapshot.nodes],
        nodeStates: [...(snapshot.nodeStates ?? [])],
        edges: [...snapshot.edges],
        edgeStates: [...(snapshot.edgeStates ?? [])],
        boardNodes: [...snapshot.boardNodes],
        boardEdges: [...snapshot.boardEdges],
      }),
    addOptimisticNode: (input) => set((state) => upsertNodePair(state, input)),
    reconcileNode: (input) => set((state) => upsertNodePair(state, input)),
    replaceNode: (node) =>
      set((state) => ({
        nodes: state.nodes.map((current) =>
          current.id === node.id ? node : current,
        ),
      })),
    replaceNodeState: (nodeState) =>
      set((state) => ({
        nodeStates: [
          ...state.nodeStates.filter(
            (current) =>
              current.scopeId !== nodeState.scopeId ||
              current.nodeId !== nodeState.nodeId,
          ),
          nodeState,
        ],
      })),
    removeNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        nodeStates: state.nodeStates.filter(
          (nodeState) => nodeState.nodeId !== nodeId,
        ),
        boardNodes: state.boardNodes.filter(
          (boardNode) => boardNode.nodeId !== nodeId,
        ),
      })),
    detachNodeFromBoard: (nodeId) => {
      const current = get();
      const boardNode =
        current.boardNodes.find((candidate) => candidate.nodeId === nodeId) ?? null;
      const incidentEdgeIds = new Set(
        current.edges
          .filter(
            (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
          )
          .map((edge) => edge.id),
      );
      const boardEdges = current.boardEdges.filter((candidate) =>
        incidentEdgeIds.has(candidate.edgeId),
      );

      set((state) => ({
        boardNodes: state.boardNodes.filter(
          (candidate) => candidate.nodeId !== nodeId,
        ),
        boardEdges: state.boardEdges.filter(
          (candidate) => !incidentEdgeIds.has(candidate.edgeId),
        ),
      }));

      return { boardNode, boardEdges };
    },
    restoreNodeToBoard: (input) => {
      if (!input.boardNode) return;
      set((state) => ({
        boardNodes: [
          ...state.boardNodes.filter(
            (candidate) => candidate.nodeId !== input.boardNode!.nodeId,
          ),
          input.boardNode!,
        ],
        boardEdges: [
          ...state.boardEdges.filter(
            (candidate) =>
              !input.boardEdges.some(
                (restored) => restored.edgeId === candidate.edgeId,
              ),
          ),
          ...input.boardEdges,
        ],
      }));
    },
    setNodePosition: (nodeId, position) =>
      set((state) => ({
        boardNodes: state.boardNodes.map((boardNode) =>
          boardNode.nodeId === nodeId
            ? { ...boardNode, x: position.x, y: position.y }
            : boardNode,
        ),
      })),
    replaceBoardNode: (boardNode) =>
      set((state) => ({
        boardNodes: [
          ...state.boardNodes.filter(
            (current) => current.nodeId !== boardNode.nodeId,
          ),
          boardNode,
        ],
      })),
    addOptimisticEdge: (input) => set((state) => upsertEdgePair(state, input)),
    reconcileEdge: (input) => set((state) => upsertEdgePair(state, input)),
    replaceEdge: (edge) =>
      set((state) => ({
        edges: state.edges.map((current) =>
          current.id === edge.id ? edge : current,
        ),
      })),
    replaceEdgeState: (edgeState) =>
      set((state) => ({
        edgeStates: [
          ...state.edgeStates.filter(
            (current) =>
              current.scopeId !== edgeState.scopeId ||
              current.edgeId !== edgeState.edgeId,
          ),
          edgeState,
        ],
      })),
    removeEdge: (edgeId) =>
      set((state) => ({
        edges: state.edges.filter((edge) => edge.id !== edgeId),
        boardEdges: state.boardEdges.filter((boardEdge) => boardEdge.edgeId !== edgeId),
      })),
    detachEdgeFromBoard: (edgeId) => {
      const boardEdge =
        get().boardEdges.find((candidate) => candidate.edgeId === edgeId) ?? null;
      set((state) => ({
        boardEdges: state.boardEdges.filter(
          (candidate) => candidate.edgeId !== edgeId,
        ),
      }));
      return boardEdge;
    },
    restoreEdgeToBoard: (boardEdge) =>
      set((state) => ({
        boardEdges: [
          ...state.boardEdges.filter(
            (candidate) => candidate.edgeId !== boardEdge.edgeId,
          ),
          boardEdge,
        ],
      })),
  }));
}

function upsertNodePair(
  state: GraphEditorState,
  input: GraphEditorNodePair,
): Pick<GraphEditorState, "nodes" | "boardNodes"> {
  return {
    nodes: [
      ...state.nodes.filter((node) => node.id !== input.node.id),
      input.node,
    ],
    boardNodes: [
      ...state.boardNodes.filter(
        (boardNode) => boardNode.nodeId !== input.boardNode.nodeId,
      ),
      input.boardNode,
    ],
  };
}

function upsertEdgePair(
  state: GraphEditorState,
  input: GraphEditorEdgePair,
): Pick<GraphEditorState, "edges" | "boardEdges"> {
  return {
    edges: [
      ...state.edges.filter((edge) => edge.id !== input.edge.id),
      input.edge,
    ],
    boardEdges: [
      ...state.boardEdges.filter((boardEdge) => boardEdge.edgeId !== input.boardEdge.edgeId),
      input.boardEdge,
    ],
  };
}
