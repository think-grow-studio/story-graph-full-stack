import { describe, expect, it } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
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
const now = "2026-09-06T00:00:00.000Z";

function node(id: string, name: string, x: number): GraphNodeResponse {
  return {
    id,
    boardId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    x,
    y: 0,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function relationship(): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    description: "",
    iconKey: null,
    properties: {},
    style: { stroke: "dashed" },
    labelPresentation: { hidden: false },
    version: 4,
    createdAt: now,
    updatedAt: now,
  };
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
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    nodes: [node(aliceId, "Alice", 0), node(bobId, "Bob", 200)],
    edges: [relationship()],
  });
  return store;
}

function deleteCommand() {
  return {
    type: "delete-edge" as const,
    boardId,
    workspaceId,
    edgeId,
  };
}

describe("Relationship delete history", () => {
  it("captures the exact direct Edge row as a restore inverse", () => {
    const store = hydratedStore();
    const forward = deleteCommand();

    expect(isUndoableEditorCommand(forward)).toBe(true);
    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 1_000 }),
    ).toEqual({
      forward,
      inverse: {
        type: "restore-edge",
        boardId,
        workspaceId,
        edgeId,
        edge: relationship(),
      },
      coalescingKey: null,
      createdAtMs: 1_000,
      updatedAtMs: 1_000,
    });
  });

  it("deletes and restores the same Board-owned Edge locally", () => {
    const store = hydratedStore();
    const entry = createEditorHistoryEntry({
      store,
      command: deleteCommand(),
      nowMs: 1_000,
    });
    expect(entry).not.toBeNull();

    expect(applyEditorCommand(store, deleteCommand())).toBe(true);
    expect(store.getState().edges.some((edge) => edge.id === edgeId)).toBe(false);

    expect(applyEditorCommand(store, entry!.inverse)).toBe(true);
    expect(store.getState().edges).toContainEqual(relationship());
    expect(getEditorCommandLaneKey(entry!.inverse)).toBe(`edge:${edgeId}`);
  });
});