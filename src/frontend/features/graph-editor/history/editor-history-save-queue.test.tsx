import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";
import type { EditorCommand } from "../commands/editor-command";
import type { EditorPersistence } from "../persistence/editor-persistence";
import { useEditorSaveQueue } from "../save-queue/use-editor-save-queue";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { useEditorHistory } from "./use-editor-history";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
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
): EditorPersistence {
  return {
    createNode: vi.fn(),
    moveNode: vi.fn(),
    createEdge: vi.fn(),
    updateNode: updateNodeImpl,
    updateEdge: vi.fn(),
    removeBoardNode: vi.fn(),
    removeBoardEdge: vi.fn(),
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
