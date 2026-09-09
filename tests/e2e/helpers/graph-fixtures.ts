import { expect, type APIRequestContext } from "@playwright/test";

export async function createE2EStory(
  request: APIRequestContext,
  workspaceId: string,
  name: string,
) {
  const response = await request.post("/api/v1/stories", {
    data: { workspaceId, name },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

export async function createE2EBoard(
  request: APIRequestContext,
  storyId: string,
  workspaceId: string,
  name: string,
  tags: string[] = [],
) {
  const response = await request.post(`/api/v1/stories/${storyId}/boards`, {
    data: { workspaceId, name, tags },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

export async function createE2ENode(
  request: APIRequestContext,
  boardId: string,
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    x: number;
    y: number;
    description?: string;
    properties?: Record<string, unknown>;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  const response = await request.post(`/api/v1/boards/${boardId}/nodes`, {
    data: {
      workspaceId,
      id,
      name: input.name,
      description: input.description ?? "",
      properties: input.properties ?? {},
      x: input.x,
      y: input.y,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

type E2EEdgePort = "auto" | "top" | "right" | "bottom" | "left";
type E2EEdgeRoutingType = "orthogonal" | "straight" | "curved";

export async function createE2EEdge(
  request: APIRequestContext,
  boardId: string,
  workspaceId: string,
  input: {
    id?: string;
    sourceNodeId: string;
    targetNodeId: string;
    name: string;
    direction?: "DIRECTED" | "UNDIRECTED";
    description?: string;
    kind?: string;
    properties?: Record<string, unknown>;
    routing?: {
      type: E2EEdgeRoutingType;
      sourcePort: E2EEdgePort;
      targetPort: E2EEdgePort;
      waypoints: Array<{ x: number; y: number }>;
    };
  },
) {
  const id = input.id ?? crypto.randomUUID();
  const response = await request.post(`/api/v1/boards/${boardId}/edges`, {
    data: {
      workspaceId,
      id,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      direction: input.direction ?? "DIRECTED",
      name: input.name,
      description: input.description ?? "",
      kind: input.kind ?? "relationship",
      properties: input.properties ?? {},
      presentation: {
        strokeColor: null,
        strokeWidth: null,
        strokeStyle: "solid",
        labelColor: null,
      },
      routing: input.routing ?? {
        type: "orthogonal",
        sourcePort: "auto",
        targetPort: "auto",
        waypoints: [],
      },
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
