import { describe, expect, it } from "vitest";

import { applyEditorCommand } from "../commands/editor-command-runtime";
import { getEditorCommandLaneKey } from "../save-queue/editor-save-queue";
import { createGraphEditorStore } from "../store/graph-editor-store";
import {
  createEditorHistoryEntry,
  isUndoableEditorCommand,
} from "./editor-history-entry";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-08-30T00:00:00.000Z";

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
        x: 0,
        y: 0,
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
        x: 200,
        y: 0,
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
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
        createdAt: now,
        updatedAt: now,
      },
    ],
  });
  return store;
}

function removeCommand() {
  return {
    type: "remove-board-edge" as const,
    boardId,
    workspaceId,
    edgeId,
  };
}

describe("relationship Board removal history", () => {
  it("captures the exact BoardEdge presentation as a restore inverse", () => {
    const store = hydratedStore();
    const forward = removeCommand();

    expect(isUndoableEditorCommand(forward)).toBe(true);
    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 1_000 }),
    ).toEqual({
      forward,
      inverse: {
        type: "restore-board-edge",
        boardId,
        workspaceId,
        edgeId,
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
        createdAt: now,
        updatedAt: now,
      },
      coalescingKey: null,
      createdAtMs: 1_000,
      updatedAtMs: 1_000,
    });
  });

  it("applies remove and restore locally without touching the canonical Edge", () => {
    const store = hydratedStore();
    const entry = createEditorHistoryEntry({
      store,
      command: removeCommand(),
      nowMs: 1_000,
    });
    expect(entry).not.toBeNull();

    expect(applyEditorCommand(store, removeCommand())).toBe(true);
    expect(store.getState().edges.some((edge) => edge.id === edgeId)).toBe(true);
    expect(store.getState().boardEdges.some((edge) => edge.edgeId === edgeId)).toBe(false);

    expect(applyEditorCommand(store, entry!.inverse)).toBe(true);
    expect(store.getState().edges.some((edge) => edge.id === edgeId)).toBe(true);
    expect(store.getState().boardEdges).toContainEqual(
      expect.objectContaining({
        boardId,
        edgeId,
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
      }),
    );
    expect(getEditorCommandLaneKey(entry!.inverse)).toBe(`edge:${edgeId}`);
  });
});
