import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import type { EditorPersistence } from "../persistence/editor-persistence";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { useEditorSaveQueue } from "./use-editor-save-queue";

const boardId = "22222222-2222-4222-8222-222222222222";
const storyId = "11111111-1111-4111-8111-111111111111";
const nodeId = "33333333-3333-4333-8333-333333333333";
const targetNodeId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-09-06T00:00:00.000Z";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function node(
  id = nodeId,
  overrides: Partial<GraphNodeResponse> = {},
): GraphNodeResponse {
  return {
    id,
    boardId,
    name: id === nodeId ? "Alice" : "Bob",
    description: "",
    iconKey: null,
    properties: {},
    x: id === nodeId ? 100 : 400,
    y: 100,
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

function edge(overrides: Partial<GraphEdgeResponse> = {}): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: nodeId,
    targetNodeId,
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

function store(withRelationship = false) {
  const result = createGraphEditorStore();
  result.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    nodes: withRelationship ? [node(), node(targetNodeId)] : [node()],
    edges: withRelationship ? [edge()] : [],
  });
  return result;
}

function persistence(
  overrides: Partial<EditorPersistence> = {},
): EditorPersistence {
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
  };
}

describe("useEditorSaveQueue", () => {
  it("applies direct Node movement synchronously and reconciles the persisted version", async () => {
    const editorStore = store();
    const gate = deferred<GraphNodeResponse>();
    const moveNode = vi.fn(() => gate.promise);
    const durable = persistence({ moveNode });
    const { result } = renderHook(() =>
      useEditorSaveQueue(editorStore, durable, boardId),
    );

    let operationId: string | null = null;
    act(() => {
      operationId = result.current.dispatch({
        type: "move-node",
        boardId,
        workspaceId,
        nodeId,
        expectedVersion: 1,
        position: { x: 250, y: 300 },
      });
    });

    expect(operationId).not.toBeNull();
    expect(editorStore.getState().nodes[0]).toMatchObject({ x: 250, y: 300 });
    expect(result.current.snapshot.saveState).toBe("unsaved");

    await act(async () => {
      await flushMicrotasks();
    });
    expect(moveNode).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, position: { x: 250, y: 300 } }),
    );
    expect(result.current.snapshot.saveState).toBe("saving");

    gate.resolve(
      node(nodeId, {
        x: 250,
        y: 300,
        version: 4,
        updatedAt: "2026-09-06T00:01:00.000Z",
      }),
    );
    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.snapshot.saveState).toBe("saved");
    expect(editorStore.getState().nodes[0]).toMatchObject({
      x: 250,
      y: 300,
      version: 4,
    });
  });

  it("keeps the queue live exactly once through React StrictMode effect replay", async () => {
    const editorStore = store();
    const moveNode = vi.fn(async (command) =>
      node(nodeId, {
        x: command.position.x,
        y: command.position.y,
        version: 4,
      }),
    );
    const durable = persistence({ moveNode });
    const { result } = renderHook(
      () => useEditorSaveQueue(editorStore, durable, boardId),
      { wrapper: StrictMode },
    );

    act(() => {
      result.current.dispatch({
        type: "move-node",
        boardId,
        workspaceId,
        nodeId,
        expectedVersion: 3,
        position: { x: 275, y: 325 },
      });
    });
    await act(async () => {
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(moveNode).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.saveState).toBe("saved");
  });

  it("keeps optimistic state on failure and retries the failed lane manually", async () => {
    const editorStore = store();
    let attempts = 0;
    const moveNode = vi.fn(async (command) => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      return node(nodeId, {
        x: command.position.x,
        y: command.position.y,
        version: 4,
      });
    });
    const durable = persistence({ moveNode });
    const { result } = renderHook(() =>
      useEditorSaveQueue(editorStore, durable, boardId),
    );
    const command = {
      type: "move-node" as const,
      boardId,
      workspaceId,
      nodeId,
      expectedVersion: 3,
      position: { x: 400, y: 500 },
    };

    act(() => {
      result.current.dispatch(command);
    });
    await act(async () => {
      await flushMicrotasks();
    });

    expect(editorStore.getState().nodes[0]).toMatchObject({ x: 400, y: 500 });
    expect(result.current.snapshot.saveState).toBe("error");
    expect(result.current.getLaneState(command)).toBe("error");

    act(() => {
      result.current.retryFailed();
    });
    await act(async () => {
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(attempts).toBe(2);
    expect(result.current.snapshot.saveState).toBe("saved");
    expect(result.current.getLaneState(command)).toBe("idle");
    expect(editorStore.getState().nodes[0]).toMatchObject({
      x: 400,
      y: 500,
      version: 4,
    });
  });

  it("waits for an active incident Edge lane before persisting Node delete without resurrecting rows", async () => {
    const editorStore = store(true);
    const edgeGate = deferred<GraphEdgeResponse>();
    const updateEdge = vi.fn(() => edgeGate.promise);
    const deleteNode = vi.fn().mockResolvedValue(undefined);
    const durable = persistence({ updateEdge, deleteNode });
    const { result } = renderHook(() =>
      useEditorSaveQueue(editorStore, durable, boardId),
    );

    act(() => {
      result.current.dispatch({
        type: "update-edge",
        boardId,
        workspaceId,
        edgeId,
        expectedVersion: 4,
        name: "protects",
        description: "",
        properties: {},
      });
    });
    await act(async () => {
      await flushMicrotasks();
    });
    expect(updateEdge).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.dispatch({
        type: "delete-node",
        boardId,
        workspaceId,
        nodeId,
      });
    });
    expect(editorStore.getState().nodes.some((item) => item.id === nodeId)).toBe(false);
    expect(editorStore.getState().edges.some((item) => item.id === edgeId)).toBe(false);

    await act(async () => {
      await flushMicrotasks();
    });
    expect(deleteNode).not.toHaveBeenCalled();

    edgeGate.resolve(edge({ name: "protects", version: 5 }));
    await act(async () => {
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(deleteNode).toHaveBeenCalledTimes(1);
    expect(editorStore.getState().nodes.some((item) => item.id === nodeId)).toBe(false);
    expect(editorStore.getState().edges.some((item) => item.id === edgeId)).toBe(false);
  });
});