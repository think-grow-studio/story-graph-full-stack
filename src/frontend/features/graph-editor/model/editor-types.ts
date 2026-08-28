import type {
  BoardEdgeResponse,
  BoardNodeResponse,
  BoardSnapshotResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type GraphEditorSnapshot = BoardSnapshotResponse;

export type GraphEditorState = {
  nodes: GraphNodeResponse[];
  edges: GraphEdgeResponse[];
  boardNodes: BoardNodeResponse[];
  boardEdges: BoardEdgeResponse[];
  hydrate: (snapshot: GraphEditorSnapshot) => void;
  setNodePosition: (
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
};
