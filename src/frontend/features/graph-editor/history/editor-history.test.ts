import { describe, expect, it, vi } from "vitest";

import type { EditorHistoryEntry } from "./editor-history-entry";
import { createEditorHistory } from "./editor-history";

const boardId = "board-1";
const workspaceId = "workspace-1";

function nodeUpdateEntry({
  nodeId,
  from,
  to,
  at,
}: {
  nodeId: string;
  from: string;
  to: string;
  at: number;
}): EditorHistoryEntry {
  return {
    forward: {
      type: "update-node",
      boardId,
      workspaceId,
      nodeId,
      version: 1,
      name: to,
      description: "",
      properties: {},
    },
    inverse: {
      type: "update-node",
      boardId,
      workspaceId,
      nodeId,
      version: 1,
      name: from,
      description: "",
      properties: {},
    },
    coalescingKey: `update-node:${nodeId}`,
    createdAtMs: at,
    updatedAtMs: at,
  };
}

function edgeUpdateEntry({
  edgeId,
  from,
  to,
  at,
}: {
  edgeId: string;
  from: string;
  to: string;
  at: number;
}): EditorHistoryEntry {
  return {
    forward: {
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      version: 1,
      name: to,
      description: "",
      properties: {},
    },
    inverse: {
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      version: 1,
      name: from,
      description: "",
      properties: {},
    },
    coalescingKey: `update-edge:${edgeId}`,
    createdAtMs: at,
    updatedAtMs: at,
  };
}

function moveEntry(nodeId: string, at: number): EditorHistoryEntry {
  return {
    forward: {
      type: "move-node",
      boardId,
      workspaceId,
      nodeId,
      position: { x: 20, y: 30 },
    },
    inverse: {
      type: "move-node",
      boardId,
      workspaceId,
      nodeId,
      position: { x: 10, y: 10 },
    },
    coalescingKey: null,
    createdAtMs: at,
    updatedAtMs: at,
  };
}

describe("editor history", () => {
  it("moves entries between undo and redo stacks only when replay succeeds", () => {
    const history = createEditorHistory();
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1 }));
    history.record(nodeUpdateEntry({ nodeId: "b", from: "B", to: "B1", at: 2 }));
    const replay = vi.fn(() => true);

    expect(history.getSnapshot()).toEqual({
      canUndo: true,
      canRedo: false,
      undoCount: 2,
      redoCount: 0,
    });

    expect(history.undo(replay)).toBe(true);
    expect(replay).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "update-node", nodeId: "b", name: "B" }),
    );
    expect(history.getSnapshot()).toMatchObject({ undoCount: 1, redoCount: 1 });

    expect(history.redo(replay)).toBe(true);
    expect(replay).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "update-node", nodeId: "b", name: "B1" }),
    );
    expect(history.getSnapshot()).toMatchObject({ undoCount: 2, redoCount: 0 });
  });

  it("keeps stacks unchanged when Undo or Redo replay is rejected", () => {
    const history = createEditorHistory();
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1 }));

    expect(history.undo(() => false)).toBe(false);
    expect(history.getSnapshot()).toMatchObject({ undoCount: 1, redoCount: 0 });

    expect(history.undo(() => true)).toBe(true);
    expect(history.redo(() => false)).toBe(false);
    expect(history.getSnapshot()).toMatchObject({ undoCount: 0, redoCount: 1 });
  });

  it("clears Redo on a new supported or unsupported normal command", () => {
    const history = createEditorHistory();
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1 }));
    history.undo(() => true);
    expect(history.getSnapshot().canRedo).toBe(true);

    history.record(nodeUpdateEntry({ nodeId: "b", from: "B", to: "B1", at: 2 }));
    expect(history.getSnapshot().canRedo).toBe(false);

    history.undo(() => true);
    expect(history.getSnapshot().canRedo).toBe(true);
    history.noteNormalCommand({
      type: "create-node",
      boardId,
      workspaceId,
      storyId: "story-1",
      nodeId: "new-node",
      name: "New",
      position: { x: 0, y: 0 },
      createdAt: "2026-08-30T00:00:00.000Z",
    });
    expect(history.getSnapshot().canRedo).toBe(false);
  });

  it("caps Undo history at the configured capacity", () => {
    const history = createEditorHistory({ capacity: 3 });
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1 }));
    history.record(nodeUpdateEntry({ nodeId: "b", from: "B", to: "B1", at: 2 }));
    history.record(nodeUpdateEntry({ nodeId: "c", from: "C", to: "C1", at: 3 }));
    history.record(nodeUpdateEntry({ nodeId: "d", from: "D", to: "D1", at: 4 }));

    expect(history.getSnapshot().undoCount).toBe(3);

    const replayed: string[] = [];
    history.undo((command) => {
      if (command.type === "update-node") replayed.push(command.nodeId);
      return true;
    });
    history.undo((command) => {
      if (command.type === "update-node") replayed.push(command.nodeId);
      return true;
    });
    history.undo((command) => {
      if (command.type === "update-node") replayed.push(command.nodeId);
      return true;
    });

    expect(replayed).toEqual(["d", "c", "b"]);
  });

  it("coalesces same-entity text updates inside the inclusive 2000 ms window", () => {
    const history = createEditorHistory({ coalesceWindowMs: 2_000 });
    history.record(nodeUpdateEntry({ nodeId: "a", from: "Alice", to: "Alic", at: 1_000 }));
    history.record(nodeUpdateEntry({ nodeId: "a", from: "Alic", to: "Alicia", at: 2_999 }));
    history.record(nodeUpdateEntry({ nodeId: "a", from: "Alicia", to: "Alicia V.", at: 4_999 }));

    expect(history.getSnapshot().undoCount).toBe(1);

    const replay = vi.fn(() => true);
    history.undo(replay);
    expect(replay).toHaveBeenCalledWith(
      expect.objectContaining({ type: "update-node", nodeId: "a", name: "Alice" }),
    );
    history.redo(replay);
    expect(replay).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "update-node", nodeId: "a", name: "Alicia V." }),
    );
  });

  it("does not coalesce after 2000 ms, across entities or command kinds", () => {
    const history = createEditorHistory({ coalesceWindowMs: 2_000 });
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1_000 }));
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A1", to: "A2", at: 3_001 }));
    history.record(nodeUpdateEntry({ nodeId: "b", from: "B", to: "B1", at: 3_100 }));
    history.record(edgeUpdateEntry({ edgeId: "e", from: "knows", to: "trusts", at: 3_200 }));

    expect(history.getSnapshot().undoCount).toBe(4);
  });

  it("uses explicit and Move boundaries to stop later text coalescing", () => {
    const history = createEditorHistory();
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1_000 }));
    history.boundary();
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A1", to: "A2", at: 1_100 }));
    history.record(moveEntry("a", 1_200));
    history.record(nodeUpdateEntry({ nodeId: "a", from: "A2", to: "A3", at: 1_300 }));

    expect(history.getSnapshot().undoCount).toBe(4);
  });

  it("notifies subscribers when stack state changes", () => {
    const history = createEditorHistory();
    const listener = vi.fn();
    const unsubscribe = history.subscribe(listener);

    history.record(nodeUpdateEntry({ nodeId: "a", from: "A", to: "A1", at: 1 }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    history.undo(() => true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
