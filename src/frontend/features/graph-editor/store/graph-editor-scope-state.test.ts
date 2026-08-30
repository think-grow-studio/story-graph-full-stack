import { describe, expect, it } from "vitest";

import { findNodeState, resolveEffectiveNode } from "../model/effective-node";
import { createGraphEditorStore } from "./graph-editor-store";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const scopeId = "44444444-4444-4444-8444-444444444444";
const now = "2026-08-30T00:00:00.000Z";

function scopedSnapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      scopeId,
      name: "Chapter 10 Board",
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
      {
        id: nodeId,
        storyId,
        name: "Alice",
        description: "Knight",
        iconKey: null,
        properties: { faction: "Guard" },
        version: 2,
        createdAt: now,
        updatedAt: now,
      },
    ],
    nodeStates: [
      {
        scopeId,
        nodeId,
        name: "Queen Alice",
        description: null,
        properties: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    edges: [],
    boardNodes: [],
    boardEdges: [],
  };
}

describe("scoped graph editor state", () => {
  it("hydrates canonical Node and sparse NodeState separately", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(scopedSnapshot());

    const state = store.getState();
    expect(state.nodes[0]?.name).toBe("Alice");
    expect(state.nodeStates[0]?.name).toBe("Queen Alice");

    const nodeState = findNodeState(scopeId, nodeId, state.nodeStates);
    expect(resolveEffectiveNode(state.nodes[0]!, nodeState).name).toBe("Queen Alice");
  });

  it("replaces NodeState by scope and node identity without mutating canonical Node", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(scopedSnapshot());

    store.getState().replaceNodeState({
      scopeId,
      nodeId,
      name: "Empress Alice",
      description: null,
      properties: {},
      version: null,
      createdAt: null,
      updatedAt: null,
    });

    const state = store.getState();
    expect(state.nodes[0]?.name).toBe("Alice");
    expect(state.nodeStates).toEqual([
      expect.objectContaining({
        scopeId,
        nodeId,
        name: "Empress Alice",
        properties: {},
        version: null,
      }),
    ]);
  });
});
