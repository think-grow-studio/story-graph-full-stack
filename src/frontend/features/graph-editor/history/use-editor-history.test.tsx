import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { EditorCommand } from "../commands/editor-command";
import { applyEditorCommand } from "../commands/editor-command-runtime";
import { createGraphEditorStore } from "../store/graph-editor-store";
import type { UndoableEditorCommand } from "./editor-history-entry";
import { useEditorHistory } from "./use-editor-history";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "workspace-1";
const now = "2026-08-30T00:00:00.000Z";

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
    nodes: [
      {
        id: nodeId,
        storyId,
        name: "Alice",
        description: "Original",
        iconKey: null,
        properties: { role: "lead" },
        version: 3,
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

function applyingDispatch(store: ReturnType<typeof createStore>) {
  let operation = 0;
  return vi.fn((command: EditorCommand) => {
    if (!applyEditorCommand(store, command)) return null;
    operation += 1;
    return `operation-${operation}`;
  });
}

describe("useEditorHistory", () => {
  it("derives history before forward application and replays inverse/forward without recursive recording", () => {
    const store = createStore();
    const dispatchToSaveQueue = applyingDispatch(store);
    const onReplayCommand = vi.fn((command: UndoableEditorCommand) => {
      void command;
    });
    const { result } = renderHook(() =>
      useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue,
        blocked: false,
        onReplayCommand,
      }),
    );

    act(() => {
      expect(result.current.dispatch(updateNode("Alicia"))).toBe("operation-1");
    });
    expect(store.getState().nodes[0]?.name).toBe("Alicia");
    expect(result.current.snapshot).toMatchObject({ undoCount: 1, redoCount: 0 });

    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(store.getState().nodes[0]?.name).toBe("Alice");
    expect(result.current.snapshot).toMatchObject({ undoCount: 0, redoCount: 1 });
    expect(onReplayCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "update-node", nodeId, name: "Alice" }),
    );

    act(() => {
      expect(result.current.redo()).toBe(true);
    });
    expect(store.getState().nodes[0]?.name).toBe("Alicia");
    expect(result.current.snapshot).toMatchObject({ undoCount: 1, redoCount: 0 });
    expect(dispatchToSaveQueue).toHaveBeenCalledTimes(3);
    expect(onReplayCommand).toHaveBeenCalledTimes(2);
  });

  it("does not mutate history when the Save Queue dispatch rejects a normal command", () => {
    const store = createStore();
    const dispatchToSaveQueue = vi.fn((command: EditorCommand) => {
      void command;
      return null;
    });
    const { result } = renderHook(() =>
      useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue,
        blocked: false,
      }),
    );

    act(() => {
      expect(result.current.dispatch(updateNode("Alicia"))).toBeNull();
    });
    expect(result.current.snapshot).toMatchObject({ undoCount: 0, redoCount: 0 });
  });

  it("passes unsupported normal commands through while clearing the Redo branch", () => {
    const store = createStore();
    const dispatchToSaveQueue = applyingDispatch(store);
    const { result } = renderHook(() =>
      useEditorHistory({
        store,
        boardId,
        dispatchToSaveQueue,
        blocked: false,
      }),
    );

    act(() => {
      result.current.dispatch(updateNode("Alicia"));
      result.current.undo();
    });
    expect(result.current.snapshot.canRedo).toBe(true);

    act(() => {
      result.current.dispatch({
        type: "create-node",
        boardId,
        workspaceId,
        storyId,
        nodeId: "44444444-4444-4444-8444-444444444444",
        name: "Bob",
        position: { x: 0, y: 0 },
        createdAt: now,
      });
    });
    expect(result.current.snapshot).toMatchObject({ undoCount: 0, redoCount: 0 });
  });

  it("blocks Undo and Redo without blocking normal dispatch", () => {
    const store = createStore();
    const dispatchToSaveQueue = applyingDispatch(store);
    const { result, rerender } = renderHook(
      ({ blocked }: { blocked: boolean }) =>
        useEditorHistory({
          store,
          boardId,
          dispatchToSaveQueue,
          blocked,
        }),
      { initialProps: { blocked: false } },
    );

    act(() => {
      result.current.dispatch(updateNode("Alicia"));
    });
    rerender({ blocked: true });

    act(() => {
      expect(result.current.undo()).toBe(false);
      expect(result.current.redo()).toBe(false);
    });
    expect(dispatchToSaveQueue).toHaveBeenCalledTimes(1);
  });

  it("resets history when Board identity changes but retains it across same-Board rerenders", () => {
    const store = createStore();
    const dispatchToSaveQueue = applyingDispatch(store);
    const { result, rerender } = renderHook(
      ({ currentBoardId }: { currentBoardId: string }) =>
        useEditorHistory({
          store,
          boardId: currentBoardId,
          dispatchToSaveQueue,
          blocked: false,
        }),
      { initialProps: { currentBoardId: boardId } },
    );

    act(() => {
      result.current.dispatch(updateNode("Alicia"));
    });
    rerender({ currentBoardId: boardId });
    expect(result.current.snapshot.canUndo).toBe(true);

    rerender({ currentBoardId: "other-board" });
    expect(result.current.snapshot).toMatchObject({ undoCount: 0, redoCount: 0 });
  });

  it("replays exactly once through React StrictMode", () => {
    const store = createStore();
    const dispatchToSaveQueue = applyingDispatch(store);
    const { result } = renderHook(
      () =>
        useEditorHistory({
          store,
          boardId,
          dispatchToSaveQueue,
          blocked: false,
        }),
      { wrapper: StrictMode },
    );

    act(() => {
      result.current.dispatch(updateNode("Alicia"));
      result.current.undo();
    });

    expect(dispatchToSaveQueue).toHaveBeenCalledTimes(2);
    expect(store.getState().nodes[0]?.name).toBe("Alice");
  });
});
