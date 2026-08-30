import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";

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

export type PlaceBoardNodeCommand = {
  type: "place-board-node";
  boardId: string;
  workspaceId: string;
  node: GraphNodeResponse;
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

export type RestoreBoardNodeCommand = {
  type: "restore-board-node";
  boardId: string;
  workspaceId: string;
  nodeId: string;
  boardNode: {
    boardId: string;
    nodeId: string;
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    zIndex: number;
    style: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  boardEdges: Array<{
    boardId: string;
    edgeId: string;
    style: Record<string, unknown>;
    labelPresentation: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
};
