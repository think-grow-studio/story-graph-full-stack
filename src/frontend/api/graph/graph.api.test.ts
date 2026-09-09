import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../client/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "../client/api-client";
import { createBoard, createEdge, createNode } from "./graph.api";

const storyId = "00000000-0000-4000-8000-000000000001";
const boardId = "00000000-0000-4000-8000-000000000002";
const nodeAId = "00000000-0000-4000-8000-000000000003";
const nodeBId = "00000000-0000-4000-8000-000000000004";
const edgeId = "00000000-0000-4000-8000-000000000005";
const timestamp = "2026-09-07T00:00:00.000Z";

const graphSettings = {
  defaultEdgeRouting: "curved" as const,
  snapToGrid: true,
  layoutMode: "free" as const,
};
const nodePresentation = {
  shape: "ellipse" as const,
  fillColor: null,
  borderColor: null,
  borderWidth: 2,
  textColor: null,
};
const edgePresentation = {
  strokeColor: null,
  strokeWidth: 2,
  strokeStyle: "dashed" as const,
  labelColor: null,
};
const edgeRouting = {
  type: "curved" as const,
  sourcePort: "right" as const,
  targetPort: "left" as const,
  waypoints: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Graph V2 frontend API", () => {
  it("sends explicit Board graph settings instead of silently replacing them with defaults", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: boardId,
        storyId,
        name: "Main",
        description: "",
        tags: [],
        graphSettings,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    await (createBoard as (input: Record<string, unknown>) => Promise<unknown>)({
      storyId,
      workspaceId: "workspace-1",
      name: "Main",
      description: "",
      tags: [],
      graphSettings,
    });

    expect(apiClient.post).toHaveBeenCalledWith(`/stories/${storyId}/boards`, {
      workspaceId: "workspace-1",
      name: "Main",
      description: "",
      tags: [],
      graphSettings,
    });
  });

  it("sends Node kind, string-leaf properties, and presentation with no legacy style field", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: nodeAId,
        boardId,
        name: "Alice",
        description: "Lead",
        kind: "person",
        iconKey: null,
        properties: { age: "20" },
        x: 10,
        y: 20,
        width: null,
        height: null,
        zIndex: 0,
        presentation: nodePresentation,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    await (createNode as (input: Record<string, unknown>) => Promise<unknown>)({
      boardId,
      workspaceId: "workspace-1",
      id: nodeAId,
      name: "Alice",
      description: "Lead",
      kind: "person",
      properties: { age: "20" },
      x: 10,
      y: 20,
      presentation: nodePresentation,
    });

    const [, payload] = vi.mocked(apiClient.post).mock.calls[0]!;
    expect(payload).toMatchObject({
      kind: "person",
      properties: { age: "20" },
      presentation: nodePresentation,
    });
    expect(payload).not.toHaveProperty("style");
  });

  it("sends one Edge semantic statement with direction, presentation, and routing only", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: edgeId,
        boardId,
        sourceNodeId: nodeAId,
        targetNodeId: nodeBId,
        direction: "DIRECTED",
        name: "protects",
        description: "",
        kind: "relationship",
        iconKey: null,
        properties: { since: "2024" },
        presentation: edgePresentation,
        routing: edgeRouting,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });

    await (createEdge as (input: Record<string, unknown>) => Promise<unknown>)({
      boardId,
      workspaceId: "workspace-1",
      id: edgeId,
      sourceNodeId: nodeAId,
      targetNodeId: nodeBId,
      direction: "DIRECTED",
      name: "protects",
      kind: "relationship",
      properties: { since: "2024" },
      presentation: edgePresentation,
      routing: edgeRouting,
    });

    const [, payload] = vi.mocked(apiClient.post).mock.calls[0]!;
    expect(payload).toMatchObject({
      direction: "DIRECTED",
      kind: "relationship",
      presentation: edgePresentation,
      routing: edgeRouting,
    });
    expect(payload).not.toHaveProperty("style");
    expect(payload).not.toHaveProperty("labelPresentation");
  });
});
