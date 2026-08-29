import { describe, expect, it } from "vitest";

import { createGraphEditorStore } from "./graph-editor-store";

const snapshot = {
  story: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Novel",
  },
  board: {
    id: "22222222-2222-4222-8222-222222222222",
    storyId: "11111111-1111-4111-8111-111111111111",
    name: "Characters",
    description: "",
    revision: 1,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  },
  nodes: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      storyId: "11111111-1111-4111-8111-111111111111",
      name: "Alice",
      description: "Protagonist",
      iconKey: null,
      properties: { role: "lead" },
      version: 1,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  ],
  edges: [],
  boardNodes: [
    {
      boardId: "22222222-2222-4222-8222-222222222222",
      nodeId: "33333333-3333-4333-8333-333333333333",
      x: 120,
      y: 80,
      width: null,
      height: null,
      zIndex: 0,
      style: { accent: true },
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  ],
  boardEdges: [],
};

const optimisticNode = {
  id: "44444444-4444-4444-8444-444444444444",
  storyId: "11111111-1111-4111-8111-111111111111",
  name: "New Node",
  description: "",
  iconKey: null,
  properties: {},
  version: 1,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const optimisticBoardNode = {
  boardId: "22222222-2222-4222-8222-222222222222",
  nodeId: optimisticNode.id,
  x: 40,
  y: 40,
  width: null,
  height: null,
  zIndex: 0,
  style: {},
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const optimisticEdge = {
  id: "55555555-5555-4555-8555-555555555555",
  storyId: "11111111-1111-4111-8111-111111111111",
  sourceNodeId: "33333333-3333-4333-8333-333333333333",
  targetNodeId: optimisticNode.id,
  name: "knows",
  description: "",
  iconKey: null,
  properties: {},
  version: 1,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

const optimisticBoardEdge = {
  boardId: "22222222-2222-4222-8222-222222222222",
  edgeId: optimisticEdge.id,
  style: {},
  labelPresentation: {},
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
};

describe("graph editor store", () => {
  it("hydrates canonical graph data separately from Board presentation", () => {
    const store = createGraphEditorStore();

    store.getState().hydrate(snapshot);

    const state = store.getState();
    expect(state.nodes[0]).toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Alice",
      properties: { role: "lead" },
      version: 1,
    });
    expect(state.nodes[0]).not.toHaveProperty("x");
    expect(state.boardNodes[0]).toMatchObject({
      nodeId: "33333333-3333-4333-8333-333333333333",
      x: 120,
      y: 80,
      style: { accent: true },
    });
    expect(state.boardNodes[0]).not.toHaveProperty("name");
    expect(state.boardNodes[0]).not.toHaveProperty("properties");
  });

  it("updates working position without mutating the canonical Node", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);

    store
      .getState()
      .setNodePosition("33333333-3333-4333-8333-333333333333", { x: 240, y: 160 });

    expect(store.getState().boardNodes[0]).toMatchObject({ x: 240, y: 160 });
    expect(store.getState().nodes[0]).toMatchObject({
      name: "Alice",
      properties: { role: "lead" },
      version: 1,
    });
  });

  it("adds, reconciles, and removes one optimistic Node without duplicating truth", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);

    store.getState().addOptimisticNode({
      node: optimisticNode,
      boardNode: optimisticBoardNode,
    });

    expect(store.getState().nodes).toHaveLength(2);
    expect(store.getState().boardNodes).toHaveLength(2);

    store.getState().reconcileNode({
      node: { ...optimisticNode, name: "Bob", version: 2 },
      boardNode: { ...optimisticBoardNode, x: 60, y: 70 },
    });

    expect(store.getState().nodes.filter((node) => node.id === optimisticNode.id)).toEqual([
      expect.objectContaining({ name: "Bob", version: 2 }),
    ]);
    expect(
      store.getState().boardNodes.filter((boardNode) => boardNode.nodeId === optimisticNode.id),
    ).toEqual([expect.objectContaining({ x: 60, y: 70 })]);

    store.getState().removeNode(optimisticNode.id);

    expect(store.getState().nodes.some((node) => node.id === optimisticNode.id)).toBe(false);
    expect(
      store.getState().boardNodes.some((boardNode) => boardNode.nodeId === optimisticNode.id),
    ).toBe(false);
  });

  it("replaces one persisted BoardNode without changing canonical data", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);

    store.getState().replaceBoardNode({
      ...snapshot.boardNodes[0],
      x: 320,
      y: 220,
    });

    expect(store.getState().boardNodes[0]).toMatchObject({ x: 320, y: 220 });
    expect(store.getState().nodes[0]).toMatchObject({ name: "Alice", version: 1 });
  });

  it("adds, reconciles, and removes one optimistic Edge without mixing Board presentation", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);

    store.getState().addOptimisticEdge({
      edge: optimisticEdge,
      boardEdge: optimisticBoardEdge,
    });

    expect(store.getState().edges).toEqual([optimisticEdge]);
    expect(store.getState().boardEdges).toEqual([optimisticBoardEdge]);
    expect(store.getState().edges[0]).not.toHaveProperty("style");
    expect(store.getState().boardEdges[0]).not.toHaveProperty("name");

    store.getState().reconcileEdge({
      edge: { ...optimisticEdge, name: "sister", version: 2 },
      boardEdge: {
        ...optimisticBoardEdge,
        labelPresentation: { placement: "center" },
      },
    });

    expect(store.getState().edges).toEqual([
      expect.objectContaining({ id: optimisticEdge.id, name: "sister", version: 2 }),
    ]);
    expect(store.getState().boardEdges).toEqual([
      expect.objectContaining({
        edgeId: optimisticEdge.id,
        labelPresentation: { placement: "center" },
      }),
    ]);

    store.getState().removeEdge(optimisticEdge.id);

    expect(store.getState().edges).toHaveLength(0);
    expect(store.getState().boardEdges).toHaveLength(0);
  });

  it("replaces canonical entities in place without changing editor presentation order", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(snapshot);
    store.getState().addOptimisticNode({
      node: optimisticNode,
      boardNode: optimisticBoardNode,
    });

    const secondEdge = {
      ...optimisticEdge,
      id: "66666666-6666-4666-8666-666666666666",
      name: "second",
    };
    const secondBoardEdge = {
      ...optimisticBoardEdge,
      edgeId: secondEdge.id,
    };
    store.getState().addOptimisticEdge({
      edge: optimisticEdge,
      boardEdge: optimisticBoardEdge,
    });
    store.getState().addOptimisticEdge({
      edge: secondEdge,
      boardEdge: secondBoardEdge,
    });

    const boardNodesBefore = store.getState().boardNodes;
    const boardEdgesBefore = store.getState().boardEdges;

    store.getState().replaceNode({
      ...snapshot.nodes[0],
      name: "Alicia",
      version: 2,
    });
    store.getState().replaceEdge({
      ...optimisticEdge,
      name: "best friend",
      version: 2,
    });

    expect(store.getState().nodes.map((node) => node.id)).toEqual([
      snapshot.nodes[0].id,
      optimisticNode.id,
    ]);
    expect(store.getState().edges.map((edge) => edge.id)).toEqual([
      optimisticEdge.id,
      secondEdge.id,
    ]);
    expect(store.getState().boardNodes).toEqual(boardNodesBefore);
    expect(store.getState().boardEdges).toEqual(boardEdgesBefore);
  });
});
