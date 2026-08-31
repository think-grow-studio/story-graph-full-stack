import { describe, expect, it } from "vitest";

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
const scopeId = "77777777-7777-4777-8777-777777777777";
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
        description: "Original",
        iconKey: null,
        properties: { role: "lead" },
        version: 7,
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
        version: 2,
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
        description: "Original relation",
        iconKey: null,
        properties: { strength: 1 },
        version: 4,
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardNodes: [
      {
        boardId,
        nodeId: aliceId,
        x: 500,
        y: 300,
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

describe("editor history entry", () => {
  it("derives a canonical Node inverse from the pre-command working state", () => {
    const store = hydratedStore();
    const forward = {
      type: "update-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
      version: 7,
      name: "Alicia",
      description: "Changed",
      properties: { role: "lead", age: 31 },
    };

    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 1_000 }),
    ).toEqual({
      forward,
      inverse: {
        type: "update-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        version: 7,
        name: "Alice",
        description: "Original",
        properties: { role: "lead" },
      },
      coalescingKey: `update-node:${aliceId}`,
      createdAtMs: 1_000,
      updatedAtMs: 1_000,
    });
  });

  it("derives a scoped NodeState inverse without touching the canonical Node", () => {
    const store = hydratedStore();
    store.getState().replaceNodeState({
      scopeId,
      nodeId: aliceId,
      name: "Queen Alice",
      description: null,
      properties: { role: "queen" },
      version: 2,
      createdAt: now,
      updatedAt: now,
    });
    const forward = {
      type: "update-node-state" as const,
      boardId,
      workspaceId,
      scopeId,
      nodeId: aliceId,
      version: 2,
      name: "Empress Alice",
      description: null,
      properties: { role: "queen" },
    };

    expect(isUndoableEditorCommand(forward)).toBe(true);
    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 1_500 }),
    ).toEqual({
      forward,
      inverse: {
        type: "update-node-state",
        boardId,
        workspaceId,
        scopeId,
        nodeId: aliceId,
        version: 2,
        name: "Queen Alice",
        description: null,
        properties: { role: "queen" },
      },
      coalescingKey: `update-node-state:${scopeId}:${aliceId}`,
      createdAtMs: 1_500,
      updatedAtMs: 1_500,
    });
    expect(store.getState().nodes.find((node) => node.id === aliceId)?.name).toBe(
      "Alice",
    );
  });

  it("uses all-null sparse state as the inverse for the first scoped edit", () => {
    const store = hydratedStore();
    const forward = {
      type: "update-node-state" as const,
      boardId,
      workspaceId,
      scopeId,
      nodeId: aliceId,
      version: null,
      name: "Queen Alice",
      description: null,
      properties: { role: "queen" },
    };

    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 1_750 }),
    ).toEqual({
      forward,
      inverse: {
        type: "update-node-state",
        boardId,
        workspaceId,
        scopeId,
        nodeId: aliceId,
        version: null,
        name: null,
        description: null,
        properties: null,
      },
      coalescingKey: `update-node-state:${scopeId}:${aliceId}`,
      createdAtMs: 1_750,
      updatedAtMs: 1_750,
    });
  });

  it("derives a canonical Edge inverse from the pre-command working state", () => {
    const store = hydratedStore();
    const forward = {
      type: "update-edge" as const,
      boardId,
      workspaceId,
      edgeId,
      version: 4,
      name: "trusts",
      description: "Changed relation",
      properties: { strength: 9 },
    };

    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 2_000 }),
    ).toMatchObject({
      forward,
      inverse: {
        type: "update-edge",
        edgeId,
        version: 4,
        name: "knows",
        description: "Original relation",
        properties: { strength: 1 },
      },
      coalescingKey: `update-edge:${edgeId}`,
    });
  });

  it("uses the explicit drag-start position for a Move inverse", () => {
    const store = hydratedStore();
    const forward = {
      type: "move-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
      position: { x: 500, y: 300 },
    };

    expect(
      createEditorHistoryEntry({
        store,
        command: forward,
        nowMs: 3_000,
        moveStartPosition: { x: 100, y: 200 },
      }),
    ).toEqual({
      forward,
      inverse: {
        ...forward,
        position: { x: 100, y: 200 },
      },
      coalescingKey: null,
      createdAtMs: 3_000,
      updatedAtMs: 3_000,
    });
  });

  it("does not create Move history without a start position or for a no-op move", () => {
    const store = hydratedStore();
    const forward = {
      type: "move-node" as const,
      boardId,
      workspaceId,
      nodeId: aliceId,
      position: { x: 500, y: 300 },
    };

    expect(
      createEditorHistoryEntry({ store, command: forward, nowMs: 4_000 }),
    ).toBeNull();
    expect(
      createEditorHistoryEntry({
        store,
        command: forward,
        nowMs: 4_000,
        moveStartPosition: { x: 500, y: 300 },
      }),
    ).toBeNull();
  });

  it("returns no entry when a supported canonical entity is missing", () => {
    const store = hydratedStore();

    expect(
      createEditorHistoryEntry({
        store,
        command: {
          type: "update-node",
          boardId,
          workspaceId,
          nodeId: "missing-node",
          version: 1,
          name: "Ghost",
          description: "",
          properties: {},
        },
        nowMs: 5_000,
      }),
    ).toBeNull();
  });

  it("marks Move, canonical updates, and Board Edge removal as undoable", () => {
    expect(
      isUndoableEditorCommand({
        type: "move-node",
        boardId,
        workspaceId,
        nodeId: aliceId,
        position: { x: 1, y: 2 },
      }),
    ).toBe(true);
    expect(
      isUndoableEditorCommand({
        type: "create-node",
        boardId,
        workspaceId,
        storyId,
        nodeId: "new-node",
        name: "New",
        position: { x: 0, y: 0 },
        createdAt: now,
      }),
    ).toBe(false);
    expect(
      isUndoableEditorCommand({
        type: "remove-board-edge",
        boardId,
        workspaceId,
        edgeId,
      }),
    ).toBe(true);
  });
});
