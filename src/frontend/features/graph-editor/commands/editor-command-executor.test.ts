import { describe, expect, it, vi } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";
import type { EditorPersistence } from "../persistence/editor-persistence";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { executeEditorCommand } from "./editor-command-executor";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "workspace-1";
const now = "2026-09-06T00:00:00.000Z";

function alice(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: nodeId,
    boardId,
    name: "Alice",
    description: "",
    iconKey: null,
    properties: {},
    x: 100,
    y: 100,
    width: null,
    height: null,
    zIndex: 0,
    presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    version: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,

    kind: "entity",
  };
}

function hydratedStore() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,

      graphSettings: { defaultEdgeRouting: "orthogonal", snapToGrid: false, layoutMode: "free" },
    },
    nodes: [alice()],
    edges: [],
  });
  return store;
}

function persistence(updateNode: EditorPersistence["updateNode"]): EditorPersistence {
  return {
    createNode: vi.fn(),
    moveNode: vi.fn(),
    updateNode,
    deleteNode: vi.fn(),
    restoreNode: vi.fn(),
    createEdge: vi.fn(),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn(),
    restoreEdge: vi.fn(),
  };
}

describe("executeEditorCommand compatibility helper", () => {
  it("applies a direct update optimistically and reconciles the persisted version", async () => {
    const store = hydratedStore();
    const updateNode = vi.fn().mockResolvedValue(
      alice({ name: "Alicia", version: 4, updatedAt: "2026-09-06T00:01:00.000Z" }),
    );

    await executeEditorCommand(store, persistence(updateNode), {
      type: "update-node",
      boardId,
      workspaceId,
      nodeId,
      expectedVersion: 1,
      name: "Alicia",
      description: "",
      properties: {},

      kind: "entity",
      iconKey: null,
      presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    });

    expect(updateNode).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, name: "Alicia" }),
    );
    expect(store.getState().nodes[0]).toMatchObject({
      name: "Alicia",
      version: 4,
    });
  });

  it("keeps the optimistic direct update when persistence fails", async () => {
    const store = hydratedStore();
    const updateNode = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      executeEditorCommand(store, persistence(updateNode), {
        type: "update-node",
        boardId,
        workspaceId,
        nodeId,
        expectedVersion: 3,
        name: "Alicia",
        description: "",
        properties: {},

        kind: "entity",
        iconKey: null,
        presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
      }),
    ).rejects.toThrow("offline");

    expect(store.getState().nodes[0]?.name).toBe("Alicia");
  });
});