export type GraphPropertyValue =
  | string
  | GraphPropertyValue[]
  | { [key: string]: GraphPropertyValue };
export type GraphProperties = Record<string, GraphPropertyValue>;

export interface GraphSettings {
  defaultEdgeRouting: "orthogonal" | "straight" | "curved";
  snapToGrid: boolean;
  layoutMode: "free";
}

export interface NodePresentation {
  shape: "rounded-rect" | "rect" | "ellipse" | "diamond";
  fillColor: string | null;
  borderColor: string | null;
  borderWidth: number | null;
  textColor: string | null;
}

export type EdgeDirection = "DIRECTED" | "UNDIRECTED";

export interface EdgePresentation {
  strokeColor: string | null;
  strokeWidth: number | null;
  strokeStyle: "solid" | "dashed" | "dotted";
  labelColor: string | null;
}

export type PortPreference = "auto" | "top" | "right" | "bottom" | "left";

export interface EdgeRouting {
  type: "orthogonal" | "straight" | "curved";
  sourcePort: PortPreference;
  targetPort: PortPreference;
  waypoints: Array<{ x: number; y: number }>;
}

export interface Board {
  id: string;
  storyId: string;
  name: string;
  description: string;
  tags: string[];
  graphSettings: GraphSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphNode {
  id: string;
  boardId: string;
  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  zIndex: number;
  presentation: NodePresentation;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphEdge {
  id: string;
  boardId: string;
  sourceNodeId: string;
  targetNodeId: string;
  direction: EdgeDirection;
  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;
  presentation: EdgePresentation;
  routing: EdgeRouting;
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
