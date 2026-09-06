import { describe, expect, it } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { applyEditorCommand } from "../commands/editor-command-runtime";
import { getEditorCommandLaneKey } from "../save-queue/editor-save-queue";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { createEditorHistoryEntry, isUndoableEditorCommand } from "./editor-history-entry";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-09-06T00:00:00.000Z";

function alice(): GraphNodeResponse {
  return {
    id: aliceId,
    boardId,
    name: "Alice",
    description: "Lead",
    iconKey: null,
    properties: { role: "lead" },
    x: 10,
    y: 20,
    width: 180,
    height: 90,
    zIndex: 3,
    style: { tint: "violet" },
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
}

function bob(): GraphNodeResponse {
  return {
    ...alice(),
    id: bobId,
    name: "Bob",
    x: 300,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 2,
  };
}

function relationship(): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    description: "Old friends",
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
    nodes: [alice(), bob()],
    edges: [relationship()],
  });
  return store;
}

function deleteCommand() {
  return {
    type: "delete-node" as const,
    boardId,
    workspaceId,
    nodeId: aliceId,
  };
}

describe("Node delete history", () => {
  it("captures the direct Node and every incident Edge as the restore inverse", () => {
    const store = hydratedStore();
    const forward = deleteCommand();

    expect(isUndoableEditorCommand(forward)).toBe(true);
    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 1_000 }),
    ).toEqual({
      forward,
      inverse: {
        type: "restore-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        node: alice(),
        edges: [relationship()],
      },
      coalescingKey: null,
      createdAtMs: 1_000,
      updatedAtMs: 1_000,
    });
  });

  it("deletes and restores the same Board-owned identities locally", () => {
    const store = hydratedStore();
    const entry = createEditorHistoryEntry({
      store,
      command: deleteCommand(),
      nowMs: 1_000,
    });
    expect(entry).not.toBeNull();

    expect(applyEditorCommand(store, deleteCommand())).toBe(true);
    expect(store.getState().nodes.some((node) => node.id === aliceId)).toBe(false);
    expect(store.getState().edges.some((edge) => edge.id === edgeId)).toBe(false);

    expect(applyEditorCommand(store, entry!.inverse)).toBe(true);
    expect(store.getState().nodes).toContainEqual(alice());
    expect(store.getState().edges).toContainEqual(relationship());
    expect(getEditorCommandLaneKey(entry!.inverse)).toBe(`node:${aliceId}`);
  });
});