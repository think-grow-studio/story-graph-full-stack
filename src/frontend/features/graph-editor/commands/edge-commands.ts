import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";

export type CreateEdgeCommand = {
  type: "create-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  name: string;
  createdAt: string;
};

export type UpdateEdgeCommand = {
  type: "update-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
  expectedVersion: number;
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export type DeleteEdgeCommand = {
  type: "delete-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
};

export type RestoreEdgeCommand = {
  type: "restore-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
  edge: GraphEdgeResponse;
};
