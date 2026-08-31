export type JsonObject = Record<string, unknown>;

export interface Scope {
  id: string;
  storyId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NodeState {
  scopeId: string;
  nodeId: string;
  name: string | null;
  description: string | null;
  properties: JsonObject | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Board {
  id: string;
  storyId: string;
  scopeId: string | null;
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
  scope: Scope | null;
  nodes: GraphNode[];
  nodeStates: NodeState[];
  edges: GraphEdge[];
  boardNodes: BoardNode[];
  boardEdges: BoardEdge[];
}
