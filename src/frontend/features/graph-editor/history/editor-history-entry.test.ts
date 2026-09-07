import { describe, expect, it } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import type { EditorCommand } from "../commands/editor-command";
import { createGraphEditorStore } from "../store/graph-editor-store";
import {
  createEditorHistoryEntry,
  isUndoableEditorCommand,
} from "./editor-history-entry";

const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-09-06T00:00:00.000Z";

function alice(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: aliceId,
    boardId,
    name: "Alice",
    description: "Lead",
    iconKey: null,
    properties: { role: "lead" },
    x: 100,
    y: 120,
    width: null,
    height: null,
    zIndex: 0,
    presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    version: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,

    kind: "entity",
  };
}

function bob(): GraphNodeResponse {
  return alice({ id: bobId, name: "Bob", x: 400, version: 2 });
}

function relationship(overrides: Partial<GraphEdgeResponse> = {}): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    description: "Old friends",
    iconKey: null,
    properties: { since: "2020" },
    presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
    routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    version: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,

    direction: "DIRECTED",
    kind: "relationship",
  };
}

function setup() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: "11111111-1111-4111-8111-111111111111", name: "Novel" },
    board: {
      id: boardId,
      storyId: "11111111-1111-4111-8111-111111111111",
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,

      graphSettings: { defaultEdgeRouting: "orthogonal", snapToGrid: false, layoutMode: "free" },
    },
    nodes: [alice(), bob()],
    edges: [relationship()],
  });
  return store;
}

function history(store = setup(), command: EditorCommand, moveStartPosition?: { x: number; y: number }) {
  return createEditorHistoryEntry({
    store,
    command,
    nowMs: 1000,
    ...(moveStartPosition ? { moveStartPosition } : {}),
  });
}

describe("Board-owned editor history entries", () => {
  it("treats direct move/update/delete/restore commands as undoable", () => {
    const commands: EditorCommand[] = [
      {
        type: "move-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        expectedVersion: 3,
        position: { x: 200, y: 220 },
      },
      {
        type: "update-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        expectedVersion: 3,
        name: "Alicia",
        description: "Lead",
        properties: { role: "lead" },

        kind: "entity",
        iconKey: null,
        presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
      },
      { type: "delete-node", boardId, workspaceId, nodeId: aliceId },
      {
        type: "restore-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        node: alice(),
        edges: [relationship()],
      },
      {
        type: "update-edge",
        boardId,
        workspaceId,
        edgeId,
        expectedVersion: 4,
        name: "protects",
        description: "",
        properties: {},

        direction: "DIRECTED",
        kind: "relationship",
        iconKey: null,
        presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
        routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
      },
      { type: "delete-edge", boardId, workspaceId, edgeId },
      {
        type: "restore-edge",
        boardId,
        workspaceId,
        edgeId,
        edge: relationship(),
      },
    ];

    for (const command of commands) expect(isUndoableEditorCommand(command)).toBe(true);
    expect(
      isUndoableEditorCommand({
        type: "create-node",
        boardId,
        workspaceId,
        nodeId: "66666666-6666-4666-8666-666666666666",
        name: "New",
        position: { x: 0, y: 0 },
        createdAt: now,

        description: "",
        kind: "entity",
        iconKey: null,
        properties: {},
        width: null,
        height: null,
        zIndex: 0,
        presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
      }),
    ).toBe(false);
  });

  it("captures the starting Node position for move Undo", () => {
    const command: EditorCommand = {
      type: "move-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
      expectedVersion: 3,
      position: { x: 200, y: 220 },
    };

    const entry = history(setup(), command, { x: 100, y: 120 });
    expect(entry?.inverse).toEqual({
      ...command,
      position: { x: 100, y: 120 },
    });
  });

  it("captures current direct Node and Edge semantic fields as update inverses", () => {
    const store = setup();
    const nodeEntry = history(store, {
      type: "update-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
      expectedVersion: 3,
      name: "Alicia",
      description: "New",
      properties: {},

      kind: "entity",
      iconKey: null,
      presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    });
    expect(nodeEntry?.inverse).toMatchObject({
      type: "update-node",
      nodeId: aliceId,
      expectedVersion: 3,
      name: "Alice",
      description: "Lead",
      properties: { role: "lead" },

      kind: "entity",
      iconKey: null,
      presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    });

    const edgeEntry = history(store, {
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      expectedVersion: 4,
      name: "protects",
      description: "New",
      properties: {},

      direction: "DIRECTED",
      kind: "relationship",
      iconKey: null,
      presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
      routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    });
    expect(edgeEntry?.inverse).toMatchObject({
      type: "update-edge",
      edgeId,
      expectedVersion: 4,
      name: "knows",
      description: "Old friends",
      properties: { since: "2020" },

      direction: "DIRECTED",
      kind: "relationship",
      iconKey: null,
      presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
      routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    });
  });

  it("captures a deleted Node plus every incident Edge for Undo", () => {
    const store = setup();
    const entry = history(store, {
      type: "delete-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
    });

    expect(entry?.inverse).toEqual({
      type: "restore-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
      node: alice(),
      edges: [relationship()],
    });
  });

  it("turns Node restore back into delete for Redo", () => {
    const entry = history(setup(), {
      type: "restore-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
      node: alice(),
      edges: [relationship()],
    });

    expect(entry?.inverse).toEqual({
      type: "delete-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
    });
  });

  it("captures the whole deleted Edge row and makes restore invert to delete", () => {
    const store = setup();
    const deleted = history(store, {
      type: "delete-edge",
      boardId,
      workspaceId,
      edgeId,
    });
    expect(deleted?.inverse).toEqual({
      type: "restore-edge",
      boardId,
      workspaceId,
      edgeId,
      edge: relationship(),
    });

    const restored = history(store, {
      type: "restore-edge",
      boardId,
      workspaceId,
      edgeId,
      edge: relationship(),
    });
    expect(restored?.inverse).toEqual({
      type: "delete-edge",
      boardId,
      workspaceId,
      edgeId,
    });
  });
});
