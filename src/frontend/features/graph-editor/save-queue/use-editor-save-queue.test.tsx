import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { EditorPersistence } from "../persistence/editor-persistence";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { useEditorSaveQueue } from "./use-editor-save-queue";

const boardId = "22222222-2222-4222-8222-222222222222";
const storyId = "11111111-1111-4111-8111-111111111111";
const nodeId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "workspace-1";
const now = "2026-08-29T00:00:00.000Z";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function store() {
  const result = createGraphEditorStore();
  result.getState().hydrate({
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
    nodes: [
      {
        id: nodeId,
        storyId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
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
  return result;
}

function persistence(moveNode: EditorPersistence["moveNode"]): EditorPersistence {
  return {
    createNode: vi.fn(),
    moveNode,
    createEdge: vi.fn(),
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    removeBoardNode: vi.fn(),
    removeBoardEdge: vi.fn(),
    restoreBoardEdge: vi.fn(),
  };
}

describe("useEditorSaveQueue", () => {
  it("applies working state synchronously and persists through queue state", async () => {
    const editorStore = store();
    const gate = deferred<ReturnType<typeof editorStore.getState>["boardNodes"][number]>();
    const durable = persistence(vi.fn(() => gate.promise));
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
        position: { x: 250, y: 300 },
      });
    });

    expect(operationId).not.toBeNull();
    expect(editorStore.getState().boardNodes[0]).toMatchObject({ x: 250, y: 300 });
    expect(result.current.snapshot.saveState).toBe("unsaved");

    await act(async () => {
      await flushMicrotasks();
    });
    expect(result.current.snapshot.saveState).toBe("saving");

    gate.resolve({
      ...editorStore.getState().boardNodes[0],
      updatedAt: "2026-08-29T00:01:00.000Z",
    });
    await act(async () => {
      await flushMicrotasks();
    });

    expect(result.current.snapshot.saveState).toBe("saved");
    expect(editorStore.getState().boardNodes[0]).toMatchObject({ x: 250, y: 300 });
  });

  it("keeps the queue live through React StrictMode effect replay", async () => {
    const editorStore = store();
    const moveNode = vi.fn(async (command) => ({
      ...editorStore.getState().boardNodes[0],
      x: command.position.x,
      y: command.position.y,
    }));
    const durable = persistence(moveNode);
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

  it("reports lane state and exposes manual retry", async () => {
    const editorStore = store();
    let attempts = 0;
    const durable = persistence(
      vi.fn(async (command) => {
        attempts += 1;
        if (attempts === 1) throw new Error("offline");
        return {
          ...editorStore.getState().boardNodes[0],
          x: command.position.x,
          y: command.position.y,
        };
      }),
    );
    const { result } = renderHook(() =>
      useEditorSaveQueue(editorStore, durable, boardId),
    );
    const command = {
      type: "move-node" as const,
      boardId,
      workspaceId,
      nodeId,
      position: { x: 400, y: 500 },
    };

    act(() => {
      result.current.dispatch(command);
    });
    await act(async () => {
      await flushMicrotasks();
    });

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
  });
});
