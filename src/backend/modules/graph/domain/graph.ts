export type JsonObject = Record<string, unknown>;

export interface Board {
  id: string;
  storyId: string;
  name: string;
  description: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphNode {
  id: string;
  storyId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  storyId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardNode {
  boardId: string;
  nodeId: string;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  style: JsonObject;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardEdge {
  boardId: string;
  edgeId: string;
  style: JsonObject;
  labelPresentation: JsonObject;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardSnapshot {
  board: Board;
  nodes: GraphNode[];
  edges: GraphEdge[];
  boardNodes: BoardNode[];
  boardEdges: BoardEdge[];
}
