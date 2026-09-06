import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type CreateNodeCommand = {
  type: "create-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  name: string;
  position: { x: number; y: number };
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
  properties: Record<string, unknown>;
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
