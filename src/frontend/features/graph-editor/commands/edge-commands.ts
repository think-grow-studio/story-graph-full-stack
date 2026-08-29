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

export type RemoveBoardEdgeCommand = {
  type: "remove-board-edge";
  boardId: string;
  workspaceId: string;
  edgeId: string;
};
