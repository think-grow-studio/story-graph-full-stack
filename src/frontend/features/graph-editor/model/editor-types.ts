import type {
  BoardEdgeResponse,
  BoardNodeResponse,
  BoardSnapshotResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type GraphEditorSnapshot = BoardSnapshotResponse;
export type GraphEditorNodePair = {
  node: GraphNodeResponse;
  boardNode: BoardNodeResponse;
};
export type GraphEditorEdgePair = {
  edge: GraphEdgeResponse;
  boardEdge: BoardEdgeResponse;
};
export type DetachedGraphEditorNodePresentation = {
  boardNode: BoardNodeResponse | null;
  boardEdges: BoardEdgeResponse[];
};

export type GraphEditorState = {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  boardNodes: BoardNodeResponse[];
  boardEdges: BoardEdgeResponse[];
  hydrate: (snapshot: GraphEditorSnapshot) => void;
  addOptimisticNode: (input: GraphEditorNodePair) => void;
  reconcileNode: (input: GraphEditorNodePair) => void;
  replaceNode: (node: GraphNodeResponse) => void;
  removeNode: (nodeId: string) => void;
  detachNodeFromBoard: (nodeId: string) => DetachedGraphEditorNodePresentation;
  restoreNodeToBoard: (input: DetachedGraphEditorNodePresentation) => void;
  setNodePosition: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  replaceBoardNode: (boardNode: BoardNodeResponse) => void;
  addOptimisticEdge: (input: GraphEditorEdgePair) => void;
  reconcileEdge: (input: GraphEditorEdgePair) => void;
  replaceEdge: (edge: GraphEdgeResponse) => void;
  removeEdge: (edgeId: string) => void;
  detachEdgeFromBoard: (edgeId: string) => BoardEdgeResponse | null;
  restoreEdgeToBoard: (boardEdge: BoardEdgeResponse) => void;
};
