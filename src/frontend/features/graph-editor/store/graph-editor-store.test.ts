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
});
