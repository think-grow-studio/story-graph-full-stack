import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  EdgeStateResponse,
  GraphNodeResponse,
  NodeStateResponse,
} from "@/contracts/graph/graph.contract";
import type { EditorCommand } from "../commands/editor-command";
import type { EditorPersistence } from "../persistence/editor-persistence";
import { useEditorSaveQueue } from "../save-queue/use-editor-save-queue";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { useEditorHistory } from "./use-editor-history";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const targetNodeId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const scopeId = "77777777-7777-4777-8777-777777777777";
const workspaceId = "workspace-1";
const now = "2026-08-30T00:00:00.000Z";

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
}

async function flushUntilCalls(
  mock: { mock: { calls: unknown[][] } },
  expectedCalls: number,
) {
  for (let index = 0; index < 12 && mock.mock.calls.length < expectedCalls; index += 1) {
    await flushMicrotasks();
  }
}

function node(name: string, version: number): GraphNodeResponse {
  return {
    id: nodeId,
    storyId,
    name,
    description: "Original",
    iconKey: null,
    properties: { role: "lead" },
    version,
    createdAt: now,
    updatedAt: now,
  };
}

function createStore() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
    nodes: [node("Alice", 3)],
    edges: [],
    boardNodes: [
      {
        boardId,
        nodeId,
        x: 100,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardEdges: [],
  });
  return store;
}

function createScopedStore() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      scopeId,
      name: "Chapter Characters",
      description: "",
      revision: 1,
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
    nodes: [
      node("Alice", 3),
      {
        id: targetNodeId,
        storyId,
        name: "Crown",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    nodeStates: [],
    edges: [
      {
        id: edgeId,
        storyId,
        sourceNodeId: nodeId,
        targetNodeId,
        name: "serves",
        description: "",
        iconKey: null,
        properties: {},
        version: 4,
        createdAt: now,
        updatedAt: now,
      },
    ],
    edgeStates: [],
    boardNodes: [
      {
        boardId,
        nodeId,
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
        nodeId: targetNodeId,
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

function updateNode(name: string): EditorCommand {
  return {
    type: "update-node",
    boardId,
    workspaceId,
    nodeId,
    version: 3,
    name,
    description: "Original",
    properties: { role: "lead" },
  };
}

function createPersistence(
  updateNodeImpl: EditorPersistence["updateNode"],
  updateNodeStateImpl: EditorPersistence["updateNodeState"] = vi.fn(),
  updateEdgeStateImpl: EditorPersistence["updateEdgeState"] = vi.fn(),
): EditorPersistence {
  return {
    createNode: vi.fn(),
    placeBoardNode: vi.fn(),
    moveNode: vi.fn(),
    createEdge: vi.fn(),
    updateNode: updateNodeImpl,
    updateNodeState: updateNodeStateImpl,
    updateEdge: vi.fn(),
    updateEdgeState: updateEdgeStateImpl,
    removeBoardNode: vi.fn(),
    restoreBoardNode: vi.fn(),
    removeBoardEdge: vi.fn(),
    restoreBoardEdge: vi.fn(),
  };
}

describe("editor history with Save Queue", () => {
  it("queues Undo behind a pending forward update on the same Node lane", async () => {
    const first = deferred<GraphNodeResponse>();
    const updateNodePersistence = vi
      .fn<EditorPersistence["updateNode"]>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(node("Alice", 5));
    const store = createStore();
    const persistence = createPersistence(updateNodePersistence);

    const { result } = renderHook(() => {
      const saveQueue = useEditorSaveQueue(store, persistence, boardId);
      const history = useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue: saveQueue.dispatch,
        blocked: saveQueue.snapshot.saveState === "error",
      });
      return { saveQueue, history };
    });

    act(() => {
      result.current.history.dispatch(updateNode("Alicia"));
    });
    await act(flushMicrotasks);
    expect(updateNodePersistence).toHaveBeenCalledTimes(1);
    expect(updateNodePersistence.mock.calls[0]?.[0]).toMatchObject({
      name: "Alicia",
      version: 3,
    });
    expect(result.current.saveQueue.snapshot.saveState).toBe("saving");

    act(() => {
      expect(result.current.history.undo()).toBe(true);
    });
    expect(store.getState().nodes[0]?.name).toBe("Alice");
    await act(flushMicrotasks);
    expect(updateNodePersistence).toHaveBeenCalledTimes(1);

    first.resolve(node("Alicia", 4));
    await act(async () => {
      await flushUntilCalls(updateNodePersistence, 2);
    });

    expect(updateNodePersistence).toHaveBeenCalledTimes(2);
    expect(updateNodePersistence.mock.calls[1]?.[0]).toMatchObject({
      name: "Alice",
      version: 4,
    });
    expect(result.current.history.snapshot).toMatchObject({
      undoCount: 0,
      redoCount: 1,
    });
  });

  it("queues first-write NodeState Undo behind the pending create and reuses version 1", async () => {
    const first = deferred<NodeStateResponse>();
    const updateNodeStatePersistence = vi
      .fn<EditorPersistence["updateNodeState"]>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({
        scopeId,
        nodeId,
        name: null,
        description: null,
        properties: null,
        version: 2,
        createdAt: now,
        updatedAt: "2026-08-30T00:02:00.000Z",
      });
    const store = createScopedStore();
    const persistence = createPersistence(vi.fn(), updateNodeStatePersistence);

    const { result } = renderHook(() => {
      const saveQueue = useEditorSaveQueue(store, persistence, boardId);
      const history = useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue: saveQueue.dispatch,
        blocked: saveQueue.snapshot.saveState === "error",
      });
      return { saveQueue, history };
    });

    act(() => {
      result.current.history.dispatch({
        type: "update-node-state",
        boardId,
        workspaceId,
        scopeId,
        nodeId,
        version: null,
        name: "Queen Alice",
        description: null,
        properties: null,
      });
    });
    await act(flushMicrotasks);

    expect(updateNodeStatePersistence).toHaveBeenCalledTimes(1);
    expect(updateNodeStatePersistence.mock.calls[0]?.[0]).toMatchObject({
      version: null,
      name: "Queen Alice",
    });
    expect(store.getState().nodeStates[0]).toMatchObject({
      name: "Queen Alice",
      version: null,
    });

    act(() => {
      expect(result.current.history.undo()).toBe(true);
    });
    expect(store.getState().nodeStates[0]).toMatchObject({
      name: null,
      description: null,
      properties: null,
      version: null,
    });
    await act(flushMicrotasks);
    expect(updateNodeStatePersistence).toHaveBeenCalledTimes(1);

    first.resolve({
      scopeId,
      nodeId,
      name: "Queen Alice",
      description: null,
      properties: null,
      version: 1,
      createdAt: now,
      updatedAt: "2026-08-30T00:01:00.000Z",
    });
    await act(async () => {
      await flushUntilCalls(updateNodeStatePersistence, 2);
    });

    expect(updateNodeStatePersistence).toHaveBeenCalledTimes(2);
    expect(updateNodeStatePersistence.mock.calls[1]?.[0]).toMatchObject({
      version: 1,
      name: null,
      description: null,
      properties: null,
    });
    expect(store.getState().nodes[0]?.name).toBe("Alice");
    expect(result.current.history.snapshot).toMatchObject({
      undoCount: 0,
      redoCount: 1,
    });
  });

  it("queues first-write EdgeState Undo behind the pending create and reuses version 1", async () => {
    const first = deferred<EdgeStateResponse>();
    const updateEdgeStatePersistence = vi
      .fn<EditorPersistence["updateEdgeState"]>()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({
        scopeId,
        edgeId,
        name: null,
        description: null,
        properties: null,
        version: 2,
        createdAt: now,
        updatedAt: "2026-08-30T00:02:00.000Z",
      });
    const store = createScopedStore();
    const persistence = createPersistence(vi.fn(), vi.fn(), updateEdgeStatePersistence);

    const { result } = renderHook(() => {
      const saveQueue = useEditorSaveQueue(store, persistence, boardId);
      const history = useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue: saveQueue.dispatch,
        blocked: saveQueue.snapshot.saveState === "error",
      });
      return { saveQueue, history };
    });

    act(() => {
      result.current.history.dispatch({
        type: "update-edge-state",
        boardId,
        workspaceId,
        scopeId,
        edgeId,
        version: null,
        name: "rules",
        description: null,
        properties: null,
      });
    });
    await act(flushMicrotasks);

    expect(updateEdgeStatePersistence).toHaveBeenCalledTimes(1);
    expect(updateEdgeStatePersistence.mock.calls[0]?.[0]).toMatchObject({
      version: null,
      name: "rules",
    });
    expect(store.getState().edgeStates[0]).toMatchObject({
      name: "rules",
      version: null,
    });
    expect(store.getState().edges[0]?.name).toBe("serves");

    act(() => {
      expect(result.current.history.undo()).toBe(true);
    });
    expect(store.getState().edgeStates[0]).toMatchObject({
      name: null,
      description: null,
      properties: null,
      version: null,
    });
    await act(flushMicrotasks);
    expect(updateEdgeStatePersistence).toHaveBeenCalledTimes(1);

    first.resolve({
      scopeId,
      edgeId,
      name: "rules",
      description: null,
      properties: null,
      version: 1,
      createdAt: now,
      updatedAt: "2026-08-30T00:01:00.000Z",
    });
    await act(async () => {
      await flushUntilCalls(updateEdgeStatePersistence, 2);
    });

    expect(updateEdgeStatePersistence).toHaveBeenCalledTimes(2);
    expect(updateEdgeStatePersistence.mock.calls[1]?.[0]).toMatchObject({
      version: 1,
      name: null,
      description: null,
      properties: null,
    });
    expect(store.getState().edges[0]?.name).toBe("serves");
    expect(result.current.history.snapshot).toMatchObject({
      undoCount: 0,
      redoCount: 1,
    });
  });

  it("blocks history after a failed update and Retry does not create a new history entry", async () => {
    const updateNodePersistence = vi
      .fn<EditorPersistence["updateNode"]>()
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce(node("Alicia", 4))
      .mockResolvedValueOnce(node("Alice", 5));
    const store = createStore();
    const persistence = createPersistence(updateNodePersistence);

    const { result } = renderHook(() => {
      const saveQueue = useEditorSaveQueue(store, persistence, boardId);
      const history = useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue: saveQueue.dispatch,
        blocked: saveQueue.snapshot.saveState === "error",
      });
      return { saveQueue, history };
    });

    act(() => {
      result.current.history.dispatch(updateNode("Alicia"));
    });
    await act(flushMicrotasks);
    await act(flushMicrotasks);

    expect(result.current.saveQueue.snapshot.saveState).toBe("error");
    expect(result.current.history.snapshot.undoCount).toBe(1);
    act(() => {
      expect(result.current.history.undo()).toBe(false);
    });
    expect(updateNodePersistence).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.saveQueue.retryFailed();
    });
    await act(async () => {
      await flushUntilCalls(updateNodePersistence, 2);
      await flushMicrotasks();
    });

    expect(result.current.saveQueue.snapshot.saveState).toBe("saved");
    expect(result.current.history.snapshot).toMatchObject({
      undoCount: 1,
      redoCount: 0,
    });

    act(() => {
      expect(result.current.history.undo()).toBe(true);
    });
    await act(async () => {
      await flushUntilCalls(updateNodePersistence, 3);
    });
    expect(updateNodePersistence.mock.calls[2]?.[0]).toMatchObject({
      name: "Alice",
      version: 4,
    });
  });
});
