import type {
  EdgeDirection,
  EdgePresentation,
  EdgeRouting,
  GraphEdgeResponse,
  GraphProperties,
} from "@/contracts/graph/graph.contract";

export type CreateEdgeCommand = {
  type: "create-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
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
  createdAt: string;
};

export type UpdateEdgeCommand = {
  type: "update-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
  expectedVersion: number;
  direction: EdgeDirection;
  name: string;
  description: string;
  kind: string;
  iconKey: string | null;
  properties: GraphProperties;
  presentation: EdgePresentation;
  routing: EdgeRouting;
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
