import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  DeletedGraphEditorNodeSnapshot,
  GraphEditorState,
} from "../model/editor-types";
import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type GraphEditorStore = StoreApi<GraphEditorState>;

export function createGraphEditorStore(): GraphEditorStore {
  return createStore<GraphEditorState>()((set, get) => ({
    nodes: [],
    edges: [],
    hydrate: (snapshot) =>
      set({
        nodes: [...snapshot.nodes],
        edges: [...snapshot.edges],
      }),
    addOptimisticNode: (node) =>
      set((state) => ({ nodes: upsertById(state.nodes, node) })),
    replaceNode: (node) =>
      set((state) => ({ nodes: upsertById(state.nodes, node) })),
    setNodePosition: (nodeId, position) =>
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, x: position.x, y: position.y }
            : node,
        ),
      })),
    deleteNode: (nodeId) => {
      const current = get();
      const node = current.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return null;

      const edges = current.edges.filter(
        (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
      );
      const deletedEdgeIds = new Set(edges.map((edge) => edge.id));

      set({
        nodes: current.nodes.filter((candidate) => candidate.id !== nodeId),
        edges: current.edges.filter((edge) => !deletedEdgeIds.has(edge.id)),
      });

      return { node, edges };
    },
    restoreNode: (snapshot) =>
      set((state) => ({
        nodes: upsertById(state.nodes, snapshot.node),
        edges: snapshot.edges.reduce(
          (edges, edge) => upsertById(edges, edge),
          state.edges,
        ),
      })),
    addOptimisticEdge: (edge) =>
      set((state) => ({ edges: upsertById(state.edges, edge) })),
    replaceEdge: (edge) =>
      set((state) => ({ edges: upsertById(state.edges, edge) })),
    deleteEdge: (edgeId) => {
      const current = get();
      const edge = current.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return null;

      set({ edges: current.edges.filter((candidate) => candidate.id !== edgeId) });
      return edge;
    },
    restoreEdge: (edge) =>
      set((state) => ({ edges: upsertById(state.edges, edge) })),
  }));
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];

  const updated = [...items];
  updated[index] = next;
  return updated;
}

export type { DeletedGraphEditorNodeSnapshot, GraphEdgeResponse, GraphNodeResponse };
