export type CreateNodeCommand = {
  type: "create-node";
  boardId: string;
  workspaceId: string;
  storyId: string;
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
  position: { x: number; y: number };
};

export type UpdateNodeCommand = {
  type: "update-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  version: number;
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export type RemoveBoardNodeCommand = {
  type: "remove-board-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
};
