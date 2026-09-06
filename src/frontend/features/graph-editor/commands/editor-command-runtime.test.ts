import { describe, expect, it, vi } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { createGraphEditorStore } from "../store/graph-editor-store";
import {
  applyEditorCommand,
  persistAndReconcileEditorCommand,
} from "./editor-command-runtime";

const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-06T00:00:00.000Z";

function nodeFixture(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: aliceId,
    boardId,
    name: "Alice",
    description: "Lead",
    iconKey: null,
    properties: {},
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function edgeFixture(overrides: Partial<GraphEdgeResponse> = {}): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    description: "",
    iconKey: null,
    properties: {},
    style: {},
    labelPresentation: {},
    version: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function hydrate(store = createGraphEditorStore()) {
  store.getState().hydrate({
    story: { id: "story-1", name: "Novel" },
    board: {
      id: boardId,
      storyId: "story-1",
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    nodes: [nodeFixture(), nodeFixture({ id: bobId, name: "Bob", x: 200 })],
    edges: [edgeFixture()],
  });
  return store;
}

function persistence(overrides: Record<string, unknown> = {}) {
  return {
    createNode: vi.fn(),
    moveNode: vi.fn(),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    restoreNode: vi.fn(),
    createEdge: vi.fn(),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn(),
    restoreEdge: vi.fn(),
    ...overrides,
  } as never;
}

describe("Board-owned editor command runtime", () => {
  it("applies direct create, move, delete, and restore Node commands", () => {
    const store = hydrate();
    const createdId = "66666666-6666-4666-8666-666666666666";

    expect(
      applyEditorCommand(store, {
        type: "create-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: createdId,
        name: "Charlie",
        position: { x: 50, y: 60 },
        createdAt: now,
      } as never),
    ).toBe(true);
    expect(store.getState().nodes.find((node) => node.id === createdId)).toMatchObject({
      boardId,
      name: "Charlie",
      x: 50,
      y: 60,
    });

    expect(
      applyEditorCommand(store, {
        type: "move-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: createdId,
        expectedVersion: 1,
        position: { x: 80, y: 90 },
      } as never),
    ).toBe(true);
    expect(store.getState().nodes.find((node) => node.id === createdId)).toMatchObject({
      x: 80,
      y: 90,
    });

    expect(
      applyEditorCommand(store, {
        type: "delete-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: aliceId,
      } as never),
    ).toBe(true);
    expect(store.getState().nodes.some((node) => node.id === aliceId)).toBe(false);
    expect(store.getState().edges).toHaveLength(0);

    expect(
      applyEditorCommand(store, {
        type: "restore-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: aliceId,
        node: nodeFixture(),
        edges: [edgeFixture()],
      } as never),
    ).toBe(true);
    expect(store.getState().nodes.find((node) => node.id === aliceId)).toEqual(nodeFixture());
    expect(store.getState().edges).toEqual([edgeFixture()]);
  });

  it("applies direct Edge update, delete, and restore commands", () => {
    const store = hydrate();

    expect(
      applyEditorCommand(store, {
        type: "update-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
        expectedVersion: 4,
        name: "protects",
        description: "updated",
        properties: { weight: 2 },
      } as never),
    ).toBe(true);
    expect(store.getState().edges[0]).toMatchObject({
      name: "protects",
      description: "updated",
      properties: { weight: 2 },
    });

    expect(
      applyEditorCommand(store, {
        type: "delete-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
      } as never),
    ).toBe(true);
    expect(store.getState().edges).toHaveLength(0);

    expect(
      applyEditorCommand(store, {
        type: "restore-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
        edge: edgeFixture(),
      } as never),
    ).toBe(true);
    expect(store.getState().edges).toEqual([edgeFixture()]);
  });

  it("rebases a move command to the latest Node version immediately before persistence", async () => {
    const store = hydrate();
    const moveNode = vi.fn().mockResolvedValue(nodeFixture({ version: 4, x: 30, y: 40 }));
    const adapter = persistence({ moveNode });

    await persistAndReconcileEditorCommand(
      store,
      adapter,
      {
        type: "move-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: aliceId,
        expectedVersion: 1,
        position: { x: 30, y: 40 },
      } as never,
    );

    expect(moveNode).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3 }),
    );
    expect(store.getState().nodes.find((node) => node.id === aliceId)).toMatchObject({
      version: 4,
      x: 10,
      y: 20,
    });
  });

  it("rebases an Edge update and preserves newer optimistic fields when persistence resolves", async () => {
    const store = hydrate();
    let resolve!: (edge: GraphEdgeResponse) => void;
    const updateEdge = vi.fn().mockImplementation(
      () => new Promise<GraphEdgeResponse>((done) => (resolve = done)),
    );
    const adapter = persistence({ updateEdge });

    const pending = persistAndReconcileEditorCommand(
      store,
      adapter,
      {
        type: "update-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
        expectedVersion: 1,
        name: "protects",
        description: "queued",
        properties: {},
      } as never,
    );

    await vi.waitFor(() => expect(updateEdge).toHaveBeenCalledTimes(1));
    expect(updateEdge).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 4 }),
    );

    store.getState().replaceEdge(
      edgeFixture({ name: "newer optimistic", description: "latest", version: 4 }),
    );
    resolve(edgeFixture({ name: "protects", description: "queued", version: 5 }));
    await pending;

    expect(store.getState().edges[0]).toMatchObject({
      name: "newer optimistic",
      description: "latest",
      version: 5,
    });
  });

  it("does not resurrect Nodes or Edges when an earlier save resolves after a later optimistic delete", async () => {
    const store = hydrate();
    let resolveNode!: (node: GraphNodeResponse) => void;
    let resolveEdge!: (edge: GraphEdgeResponse) => void;
    const updateNode = vi.fn().mockImplementation(
      () => new Promise<GraphNodeResponse>((done) => (resolveNode = done)),
    );
    const updateEdge = vi.fn().mockImplementation(
      () => new Promise<GraphEdgeResponse>((done) => (resolveEdge = done)),
    );
    const adapter = persistence({ updateNode, updateEdge });

    const nodeUpdate = {
      type: "update-node",
      boardId,
      workspaceId: "workspace-1",
      nodeId: aliceId,
      expectedVersion: 3,
      name: "Alicia",
      description: "Lead",
      properties: {},
    } as const;
    expect(applyEditorCommand(store, nodeUpdate)).toBe(true);
    const pendingNode = persistAndReconcileEditorCommand(store, adapter, nodeUpdate);
    await vi.waitFor(() => expect(updateNode).toHaveBeenCalledTimes(1));

    expect(
      applyEditorCommand(store, {
        type: "delete-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: aliceId,
      }),
    ).toBe(true);
    resolveNode(nodeFixture({ name: "Alicia", version: 4 }));
    await pendingNode;

    expect(store.getState().nodes.some((node) => node.id === aliceId)).toBe(false);
    expect(store.getState().edges).toHaveLength(0);

    const edgeStore = hydrate();
    const edgeUpdate = {
      type: "update-edge",
      boardId,
      workspaceId: "workspace-1",
      edgeId,
      expectedVersion: 4,
      name: "protects",
      description: "",
      properties: {},
    } as const;
    expect(applyEditorCommand(edgeStore, edgeUpdate)).toBe(true);
    const pendingEdge = persistAndReconcileEditorCommand(edgeStore, adapter, edgeUpdate);
    await vi.waitFor(() => expect(updateEdge).toHaveBeenCalledTimes(1));

    expect(
      applyEditorCommand(edgeStore, {
        type: "delete-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
      }),
    ).toBe(true);
    resolveEdge(edgeFixture({ name: "protects", version: 5 }));
    await pendingEdge;

    expect(edgeStore.getState().edges.some((edge) => edge.id === edgeId)).toBe(false);
  });
});