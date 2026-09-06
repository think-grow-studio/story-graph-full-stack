import type {
  BoardSnapshotResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type GraphEditorSnapshot = BoardSnapshotResponse;

export type DeletedGraphEditorNodeSnapshot = {
  node: GraphNodeResponse;
  edges: GraphEdgeResponse[];
};

export type GraphEditorState = {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  hydrate: (snapshot: GraphEditorSnapshot) => void;
  addOptimisticNode: (node: GraphNodeResponse) => void;
  replaceNode: (node: GraphNodeResponse) => void;
  setNodePosition: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  deleteNode: (nodeId: string) => DeletedGraphEditorNodeSnapshot | null;
  restoreNode: (snapshot: DeletedGraphEditorNodeSnapshot) => void;
  addOptimisticEdge: (edge: GraphEdgeResponse) => void;
  replaceEdge: (edge: GraphEdgeResponse) => void;
  deleteEdge: (edgeId: string) => GraphEdgeResponse | null;
  restoreEdge: (edge: GraphEdgeResponse) => void;
};
