import type {
  BoardEdgeResponse,
  BoardNodeResponse,
  BoardResponse,
  BoardSnapshotResponse,
  EdgeStateResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
  NodeStateResponse,
  ScopeResponse,
} from "@/contracts/graph/graph.contract";
import type { EditorEdgeState } from "./effective-edge";
import type { EditorNodeState } from "./effective-node";

export type GraphEditorSnapshot = Omit<
  BoardSnapshotResponse,
  "board" | "scope" | "nodeStates" | "edgeStates"
> & {
  board: Omit<BoardResponse, "scopeId"> & { scopeId?: string | null };
  scope?: ScopeResponse | null;
  nodeStates?: NodeStateResponse[];
  edgeStates?: EdgeStateResponse[];
};
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
  scope: ScopeResponse | null;
  nodes: GraphNodeResponse[];
  nodeStates: EditorNodeState[];
  edges: GraphEdgeResponse[];
  edgeStates: EditorEdgeState[];
  boardNodes: BoardNodeResponse[];
  boardEdges: BoardEdgeResponse[];
  hydrate: (snapshot: GraphEditorSnapshot) => void;
  addOptimisticNode: (input: GraphEditorNodePair) => void;
  reconcileNode: (input: GraphEditorNodePair) => void;
  replaceNode: (node: GraphNodeResponse) => void;
  replaceNodeState: (nodeState: EditorNodeState) => void;
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
  replaceEdgeState: (edgeState: EditorEdgeState) => void;
  removeEdge: (edgeId: string) => void;
  detachEdgeFromBoard: (edgeId: string) => BoardEdgeResponse | null;
  restoreEdgeToBoard: (boardEdge: BoardEdgeResponse) => void;
};
