import { describe, expect, it, vi } from "vitest";

import { createGraphEditorStore } from "../store/graph-editor-store";
import { executeEditorCommand } from "./editor-command-executor";
import type { EditorPersistence } from "../persistence/editor-persistence";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-08-29T00:00:00.000Z";

function hydratedStore() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      revision: 3,
      createdAt: now,
      updatedAt: now,
    },
    nodes: [
      {
        id: aliceId,
        storyId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: bobId,
        storyId,
        name: "Bob",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    edges: [
      {
        id: edgeId,
        storyId,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        name: "knows",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardNodes: [
      {
        boardId,
        nodeId: aliceId,
        x: 100,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        boardId,
        nodeId: bobId,
        x: 400,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardEdges: [
      {
        boardId,
        edgeId,
        style: {},
        labelPresentation: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  return store;
}

function persistence(): EditorPersistence {
  return {
    createNode: vi.fn(),
    moveNode: vi.fn(),
    createEdge: vi.fn(),
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    removeBoardNode: vi.fn(),
    removeBoardEdge: vi.fn(),
  };
}

describe("executeEditorCommand", () => {
  it("optimistically creates and reconciles a Node", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "create-node" as const,
      boardId,
      workspaceId,
      storyId,
      nodeId: "66666666-6666-4666-8666-666666666666",
      name: "Carol",
      position: { x: 250, y: 180 },
      createdAt: now,
    };
    const persisted = {
      node: {
        id: command.nodeId,
        storyId,
        name: "Carol",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      boardNode: {
        boardId,
        nodeId: command.nodeId,
        x: 250,
        y: 180,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    };
    vi.mocked(durable.createNode).mockResolvedValue(persisted);

    await executeEditorCommand(store, durable, command);

    expect(durable.createNode).toHaveBeenCalledWith(command);
    expect(store.getState().nodes).toContainEqual(persisted.node);
    expect(store.getState().boardNodes).toContainEqual(persisted.boardNode);
  });

  it("rolls back an optimistic Node when persistence fails", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "create-node" as const,
      boardId,
      workspaceId,
      storyId,
      nodeId: "66666666-6666-4666-8666-666666666666",
      name: "Carol",
      position: { x: 250, y: 180 },
      createdAt: now,
    };
    vi.mocked(durable.createNode).mockRejectedValue(new Error("offline"));

    await expect(executeEditorCommand(store, durable, command)).rejects.toThrow("offline");
    expect(store.getState().nodes.some((node) => node.id === command.nodeId)).toBe(false);
    expect(store.getState().boardNodes.some((node) => node.nodeId === command.nodeId)).toBe(false);
  });

  it("persists the latest Node position and keeps working state on failure", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "move-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
      position: { x: 999, y: 888 },
    };
    vi.mocked(durable.moveNode).mockRejectedValue(new Error("offline"));

    await expect(executeEditorCommand(store, durable, command)).rejects.toThrow("offline");
    expect(store.getState().boardNodes.find((node) => node.nodeId === aliceId)).toMatchObject({
      x: 999,
      y: 888,
    });
  });

  it("optimistically creates and rolls back a Relationship", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "create-edge" as const,
      boardId,
      workspaceId,
      storyId,
      edgeId: "77777777-7777-4777-8777-777777777777",
      sourceNodeId: bobId,
      targetNodeId: aliceId,
      name: "protects",
      createdAt: now,
    };
    vi.mocked(durable.createEdge).mockRejectedValue(new Error("offline"));

    await expect(executeEditorCommand(store, durable, command)).rejects.toThrow("offline");
    expect(store.getState().edges.some((edge) => edge.id === command.edgeId)).toBe(false);
    expect(store.getState().boardEdges.some((edge) => edge.edgeId === command.edgeId)).toBe(false);
  });

  it("replaces canonical Node and Edge only after persistence succeeds", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const updatedNode = {
      ...store.getState().nodes[0],
      name: "Alicia",
      version: 2,
    };
    const updatedEdge = {
      ...store.getState().edges[0],
      name: "best friend",
      version: 2,
    };
    vi.mocked(durable.updateNode).mockResolvedValue(updatedNode);
    vi.mocked(durable.updateEdge).mockResolvedValue(updatedEdge);

    await executeEditorCommand(store, durable, {
      type: "update-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
      version: 1,
      name: "Alicia",
      description: "",
      properties: {},
    });
    await executeEditorCommand(store, durable, {
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      version: 1,
      name: "best friend",
      description: "",
      properties: {},
    });

    expect(store.getState().nodes.find((node) => node.id === aliceId)?.name).toBe("Alicia");
    expect(store.getState().edges.find((edge) => edge.id === edgeId)?.name).toBe("best friend");
  });

  it("rolls back Board Node presentation only when removal persistence fails", async () => {
    const store = hydratedStore();
    const durable = persistence();
    vi.mocked(durable.removeBoardNode).mockRejectedValue(new Error("offline"));

    await expect(
      executeEditorCommand(store, durable, {
        type: "remove-board-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
      }),
    ).rejects.toThrow("offline");

    expect(store.getState().nodes.map((node) => node.id)).toContain(aliceId);
    expect(store.getState().edges.map((edge) => edge.id)).toContain(edgeId);
    expect(store.getState().boardNodes.map((node) => node.nodeId)).toContain(aliceId);
    expect(store.getState().boardEdges.map((edge) => edge.edgeId)).toContain(edgeId);
  });

  it("rolls back Board Edge presentation only when removal persistence fails", async () => {
    const store = hydratedStore();
    const durable = persistence();
    vi.mocked(durable.removeBoardEdge).mockRejectedValue(new Error("offline"));

    await expect(
      executeEditorCommand(store, durable, {
        type: "remove-board-edge",
        boardId,
        workspaceId,
        edgeId,
      }),
    ).rejects.toThrow("offline");

    expect(store.getState().edges.map((edge) => edge.id)).toContain(edgeId);
    expect(store.getState().boardEdges.map((edge) => edge.edgeId)).toContain(edgeId);
  });
});
