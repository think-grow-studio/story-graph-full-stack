import { describe, expect, it, vi } from "vitest";

import type { EditorPersistence } from "../persistence/editor-persistence";
import { createGraphEditorStore } from "../store/graph-editor-store";
import {
  applyEditorCommand,
  persistAndReconcileEditorCommand,
} from "./editor-command-runtime";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const carolId = "66666666-6666-4666-8666-666666666666";
const scopeId = "77777777-7777-4777-8777-777777777777";
const workspaceId = "workspace-1";
const now = "2026-08-29T00:00:00.000Z";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

function scopedStore() {
  const store = hydratedStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      scopeId,
      name: "Chapter Characters",
      description: "",
      revision: 3,
      createdAt: now,
      updatedAt: now,
    },
    scope: {
      id: scopeId,
      storyId,
      name: "Chapter 10",
      description: "",
      createdAt: now,
      updatedAt: now,
    },
    nodes: store.getState().nodes,
    nodeStates: [],
    edges: store.getState().edges,
    boardNodes: store.getState().boardNodes,
    boardEdges: store.getState().boardEdges,
  });
  return store;
}

function persistence(): EditorPersistence {
  return {
    createNode: vi.fn(),
    placeBoardNode: vi.fn(),
    moveNode: vi.fn(),
    createEdge: vi.fn(),
    updateNode: vi.fn(),
    updateNodeState: vi.fn(),
    updateEdge: vi.fn(),
    removeBoardNode: vi.fn(),
    restoreBoardNode: vi.fn(),
    removeBoardEdge: vi.fn(),
    restoreBoardEdge: vi.fn(),
  };
}

function createNodeCommand() {
  return {
    type: "create-node" as const,
    boardId,
    workspaceId,
    storyId,
    nodeId: carolId,
    name: "Carol",
    position: { x: 250, y: 180 },
    createdAt: now,
  };
}

function existingCarol() {
  return {
    id: carolId,
    storyId,
    name: "Carol",
    description: "Scout",
    iconKey: null,
    properties: { faction: "Guard" },
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
}

function placeBoardNodeCommand() {
  return {
    type: "place-board-node" as const,
    boardId,
    workspaceId,
    node: existingCarol(),
    position: { x: 250, y: 180 },
    createdAt: now,
  };
}

describe("editor command runtime", () => {
  it("applies a create Node locally before persistence", () => {
    const store = hydratedStore();
    const command = createNodeCommand();

    expect(applyEditorCommand(store, command)).toBe(true);

    expect(store.getState().nodes.some((node) => node.id === command.nodeId)).toBe(true);
    expect(store.getState().boardNodes.some((node) => node.nodeId === command.nodeId)).toBe(true);
  });

  it("keeps a locally created Node when durable create fails", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = createNodeCommand();
    applyEditorCommand(store, command);
    vi.mocked(durable.createNode).mockRejectedValue(new Error("offline"));

    await expect(
      persistAndReconcileEditorCommand(store, durable, command),
    ).rejects.toThrow("offline");

    expect(store.getState().nodes.some((node) => node.id === command.nodeId)).toBe(true);
    expect(store.getState().boardNodes.some((node) => node.nodeId === command.nodeId)).toBe(true);
  });

  it("applies canonical Node edits immediately and keeps them on persistence failure", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "update-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
      version: 1,
      name: "Alicia",
      description: "changed locally",
      properties: { role: "lead" },
    };
    vi.mocked(durable.updateNode).mockRejectedValue(new Error("offline"));

    expect(applyEditorCommand(store, command)).toBe(true);
    expect(store.getState().nodes.find((node) => node.id === aliceId)).toMatchObject({
      name: "Alicia",
      description: "changed locally",
      properties: { role: "lead" },
      version: 1,
    });

    await expect(
      persistAndReconcileEditorCommand(store, durable, command),
    ).rejects.toThrow("offline");

    expect(store.getState().nodes.find((node) => node.id === aliceId)?.name).toBe("Alicia");
  });

  it("detaches Board presentation immediately and does not restore it on persistence failure", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "remove-board-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
    };
    vi.mocked(durable.removeBoardNode).mockRejectedValue(new Error("offline"));

    expect(applyEditorCommand(store, command)).toBe(true);
    expect(store.getState().nodes.some((node) => node.id === aliceId)).toBe(true);
    expect(store.getState().edges.some((edge) => edge.id === edgeId)).toBe(true);
    expect(store.getState().boardNodes.some((node) => node.nodeId === aliceId)).toBe(false);
    expect(store.getState().boardEdges.some((edge) => edge.edgeId === edgeId)).toBe(false);

    await expect(
      persistAndReconcileEditorCommand(store, durable, command),
    ).rejects.toThrow("offline");

    expect(store.getState().boardNodes.some((node) => node.nodeId === aliceId)).toBe(false);
  });

  it("does not snap a newer working position back to an older persisted move", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = {
      type: "move-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
      position: { x: 120, y: 140 },
    };
    applyEditorCommand(store, command);
    store.getState().setNodePosition(aliceId, { x: 180, y: 220 });
    vi.mocked(durable.moveNode).mockResolvedValue({
      ...store.getState().boardNodes.find((node) => node.nodeId === aliceId)!,
      x: 120,
      y: 140,
      updatedAt: "2026-08-29T00:01:00.000Z",
    });

    await persistAndReconcileEditorCommand(store, durable, command);

    expect(store.getState().boardNodes.find((node) => node.nodeId === aliceId)).toMatchObject({
      x: 180,
      y: 220,
    });
  });

  it("does not overwrite a newer Node position with a delayed create response", async () => {
    const store = hydratedStore();
    const durable = persistence();
    const command = createNodeCommand();
    applyEditorCommand(store, command);
    store.getState().setNodePosition(command.nodeId, { x: 500, y: 600 });
    vi.mocked(durable.createNode).mockResolvedValue({
      node: store.getState().nodes.find((node) => node.id === command.nodeId)!,
      boardNode: {
        ...store.getState().boardNodes.find((node) => node.nodeId === command.nodeId)!,
        x: command.position.x,
        y: command.position.y,
        updatedAt: "2026-08-29T00:01:00.000Z",
      },
    });

    await persistAndReconcileEditorCommand(store, durable, command);

    expect(store.getState().boardNodes.find((node) => node.nodeId === command.nodeId)).toMatchObject({
      x: 500,
      y: 600,
    });
  });

  it("places an existing canonical Node locally without creating NodeState", () => {
    const store = hydratedStore();
    const command = placeBoardNodeCommand();
    const nodeStateCount = store.getState().nodeStates.length;

    expect(applyEditorCommand(store, command)).toBe(true);

    expect(store.getState().nodes.find((node) => node.id === carolId)).toEqual(
      existingCarol(),
    );
    expect(store.getState().boardNodes.find((node) => node.nodeId === carolId)).toMatchObject({
      boardId,
      nodeId: carolId,
      x: 250,
      y: 180,
    });
    expect(store.getState().nodeStates).toHaveLength(nodeStateCount);
  });

  it("keeps a newer local position when existing Node placement response is stale", async () => {
    const store = hydratedStore();
    const command = placeBoardNodeCommand();
    const durable = persistence();

    applyEditorCommand(store, command);
    store.getState().setNodePosition(carolId, { x: 500, y: 600 });
    vi.mocked(durable.placeBoardNode).mockResolvedValue({
      node: existingCarol(),
      boardNode: {
        boardId,
        nodeId: carolId,
        x: 250,
        y: 180,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: "2026-08-29T00:01:00.000Z",
      },
    });

    await persistAndReconcileEditorCommand(store, durable, command);

    expect(store.getState().boardNodes.find((node) => node.nodeId === carolId)).toMatchObject({
      x: 500,
      y: 600,
    });
  });

  it("applies a first scoped NodeState write without mutating the canonical Node", () => {
    const store = scopedStore();
    const canonicalBefore = structuredClone(
      store.getState().nodes.find((node) => node.id === aliceId)!,
    );
    const command = {
      type: "update-node-state" as const,
      boardId,
      workspaceId,
      scopeId,
      nodeId: aliceId,
      version: null,
      name: "Queen Alice",
      description: null,
      properties: { role: "queen" },
    };

    expect(applyEditorCommand(store, command)).toBe(true);

    expect(store.getState().nodes.find((node) => node.id === aliceId)).toEqual(
      canonicalBefore,
    );
    expect(store.getState().nodeStates).toContainEqual({
      scopeId,
      nodeId: aliceId,
      name: "Queen Alice",
      description: null,
      properties: { role: "queen" },
      version: null,
      createdAt: null,
      updatedAt: null,
    });
  });

  it("advances persisted NodeState metadata without overwriting a newer local override", async () => {
    const store = scopedStore();
    const gate = deferred<{
      scopeId: string;
      nodeId: string;
      name: string | null;
      description: string | null;
      properties: Record<string, unknown> | null;
      version: number;
      createdAt: string;
      updatedAt: string;
    }>();
    const durable = {
      ...persistence(),
      updateNodeState: vi.fn(() => gate.promise),
    };
    const first = {
      type: "update-node-state" as const,
      boardId,
      workspaceId,
      scopeId,
      nodeId: aliceId,
      version: null,
      name: "Queen Alice",
      description: null,
      properties: null,
    };

    applyEditorCommand(store, first);
    const persistencePromise = persistAndReconcileEditorCommand(store, durable, first);
    applyEditorCommand(store, {
      ...first,
      name: "Empress Alice",
    });

    gate.resolve({
      scopeId,
      nodeId: aliceId,
      name: "Queen Alice",
      description: null,
      properties: null,
      version: 1,
      createdAt: now,
      updatedAt: "2026-08-29T00:01:00.000Z",
    });
    await persistencePromise;

    expect(store.getState().nodeStates).toContainEqual({
      scopeId,
      nodeId: aliceId,
      name: "Empress Alice",
      description: null,
      properties: null,
      version: 1,
      createdAt: now,
      updatedAt: "2026-08-29T00:01:00.000Z",
    });
    expect(store.getState().nodes.find((node) => node.id === aliceId)?.name).toBe(
      "Alice",
    );
  });

  it("applies a first scoped EdgeState write without mutating the canonical Edge", () => {
    const store = scopedStore();
    const canonicalBefore = structuredClone(
      store.getState().edges.find((edge) => edge.id === edgeId)!,
    );
    const command = {
      type: "update-edge-state" as const,
      boardId,
      workspaceId,
      scopeId,
      edgeId,
      version: null,
      name: "rules",
      description: null,
      properties: { strength: 9 },
    };

    expect(applyEditorCommand(store, command)).toBe(true);

    expect(store.getState().edges.find((edge) => edge.id === edgeId)).toEqual(
      canonicalBefore,
    );
    expect(store.getState().edgeStates).toContainEqual({
      scopeId,
      edgeId,
      name: "rules",
      description: null,
      properties: { strength: 9 },
      version: null,
      createdAt: null,
      updatedAt: null,
    });
  });

  it("advances persisted EdgeState metadata without overwriting a newer local override", async () => {
    const store = scopedStore();
    const gate = deferred<{
      scopeId: string;
      edgeId: string;
      name: string | null;
      description: string | null;
      properties: Record<string, unknown> | null;
      version: number;
      createdAt: string;
      updatedAt: string;
    }>();
    const durable = {
      ...persistence(),
      updateEdgeState: vi.fn(() => gate.promise),
    };
    const first = {
      type: "update-edge-state" as const,
      boardId,
      workspaceId,
      scopeId,
      edgeId,
      version: null,
      name: "rules",
      description: null,
      properties: null,
    };

    applyEditorCommand(store, first);
    const persistencePromise = persistAndReconcileEditorCommand(store, durable, first);
    applyEditorCommand(store, {
      ...first,
      name: "commands",
    });

    gate.resolve({
      scopeId,
      edgeId,
      name: "rules",
      description: null,
      properties: null,
      version: 1,
      createdAt: now,
      updatedAt: "2026-08-29T00:01:00.000Z",
    });
    await persistencePromise;

    expect(store.getState().edgeStates).toContainEqual({
      scopeId,
      edgeId,
      name: "commands",
      description: null,
      properties: null,
      version: 1,
      createdAt: now,
      updatedAt: "2026-08-29T00:01:00.000Z",
    });
    expect(store.getState().edges.find((edge) => edge.id === edgeId)?.name).toBe(
      "knows",
    );
  });
});
