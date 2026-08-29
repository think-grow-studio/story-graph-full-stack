import { describe, expect, it } from "vitest";

import { createGraphEditorStore } from "./graph-editor-store";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-08-29T00:00:00.000Z";

const snapshot = {
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
      x: 100,
      y: 100,
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
};

describe("graph editor Board detach state", () => {
  it("detaches a Node and incident Relationships from Board presentation without deleting canonical graph data", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);

    const detached = store.getState().detachNodeFromBoard(aliceId);

    expect(detached.boardNode?.nodeId).toBe(aliceId);
    expect(detached.boardEdges.map((item) => item.edgeId)).toEqual([edgeId]);
    expect(store.getState().nodes.map((item) => item.id)).toEqual([aliceId, bobId]);
    expect(store.getState().edges.map((item) => item.id)).toEqual([edgeId]);
    expect(store.getState().boardNodes.map((item) => item.nodeId)).toEqual([bobId]);
    expect(store.getState().boardEdges).toEqual([]);

    store.getState().restoreNodeToBoard(detached);
    expect(store.getState().boardNodes.map((item) => item.nodeId).sort()).toEqual(
      [aliceId, bobId].sort(),
    );
    expect(store.getState().boardEdges.map((item) => item.edgeId)).toEqual([edgeId]);
  });

  it("detaches and restores one Relationship presentation while preserving the canonical Edge", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);

    const detached = store.getState().detachEdgeFromBoard(edgeId);

    expect(detached?.edgeId).toBe(edgeId);
    expect(store.getState().edges.map((item) => item.id)).toEqual([edgeId]);
    expect(store.getState().boardEdges).toEqual([]);

    store.getState().restoreEdgeToBoard(detached!);
    expect(store.getState().boardEdges.map((item) => item.edgeId)).toEqual([edgeId]);
  });
});
