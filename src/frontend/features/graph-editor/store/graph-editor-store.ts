import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  GraphEditorNodePair,
  GraphEditorState,
} from "../model/editor-types";

export type GraphEditorStore = StoreApi<GraphEditorState>;

export function createGraphEditorStore(): GraphEditorStore {
  return createStore<GraphEditorState>()((set) => ({
    nodes: [],
    edges: [],
    boardNodes: [],
    boardEdges: [],
    hydrate: (snapshot) =>
      set({
        nodes: [...snapshot.nodes],
        edges: [...snapshot.edges],
        boardNodes: [...snapshot.boardNodes],
        boardEdges: [...snapshot.boardEdges],
      }),
    addOptimisticNode: (input) => set((state) => upsertNodePair(state, input)),
    reconcileNode: (input) => set((state) => upsertNodePair(state, input)),
    removeNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.filter((node) => node.id !== nodeId),
        boardNodes: state.boardNodes.filter(
          (boardNode) => boardNode.nodeId !== nodeId,
        ),
      })),
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
