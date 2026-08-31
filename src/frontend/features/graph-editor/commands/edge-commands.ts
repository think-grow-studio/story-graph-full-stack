export type CreateEdgeCommand = {
  type: "create-edge";
  boardId: string;
  workspaceId: string;
  storyId: string;
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
  version: number;
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export type UpdateEdgeStateCommand = {
  type: "update-edge-state";
  boardId: string;
  workspaceId: string;
  scopeId: string;
  edgeId: string;
  version: number | null;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown> | null;
};

export type RemoveBoardEdgeCommand = {
  type: "remove-board-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
};

export type RestoreBoardEdgeCommand = {
  type: "restore-board-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
  style: Record<string, unknown>;
  labelPresentation: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
