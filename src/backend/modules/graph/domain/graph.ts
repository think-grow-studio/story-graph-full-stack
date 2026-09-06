export type JsonObject = Record<string, unknown>;

export interface Board {
  id: string;
  storyId: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphNode {
  id: string;
  boardId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  style: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  description: string;
  iconKey: string | null;
  properties: JsonObject;
  style: JsonObject;
  labelPresentation: JsonObject;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardSnapshot {
  board: Board;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type CreateGraphNode = Omit<
  GraphNode,
  "version" | "createdAt" | "updatedAt"
>;

export type RestorableGraphNode = Omit<GraphNode, "createdAt" | "updatedAt">;

export type CreateGraphEdge = Omit<
  GraphEdge,
  "version" | "createdAt" | "updatedAt"
>;

export type RestorableGraphEdge = Omit<GraphEdge, "createdAt" | "updatedAt">;

export interface DeletedNodeSnapshot {
  node: GraphNode;
  edges: GraphEdge[];
}
