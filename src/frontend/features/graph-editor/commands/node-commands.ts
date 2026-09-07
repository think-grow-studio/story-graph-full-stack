import type {
  GraphEdgeResponse,
  GraphNodeResponse,
  GraphProperties,
  NodePresentation,
} from "@/contracts/graph/graph.contract";

export type CreateNodeCommand = {
  type: "create-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;
  position: { x: number; y: number };
  width: number | null;
  height: number | null;
  zIndex: number;
  presentation: NodePresentation;
  createdAt: string;
};

export type MoveNodeCommand = {
  type: "move-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  expectedVersion: number;
  position: { x: number; y: number };
};

export type UpdateNodeCommand = {
  type: "update-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  expectedVersion: number;
  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;
  presentation: NodePresentation;
};

export type DeleteNodeCommand = {
  type: "delete-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
};

export type RestoreNodeCommand = {
  type: "restore-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  node: GraphNodeResponse;
  edges: GraphEdgeResponse[];
};
