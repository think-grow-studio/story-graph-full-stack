import { describe, expect, it } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { applyEditorCommand } from "./editor-command-runtime";

const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-07T00:00:00.000Z";

const nodePresentation = {
  shape: "ellipse" as const,
  fillColor: "#fff",
  borderColor: "#111",
  borderWidth: 2,
  textColor: "#222",
};

const edgePresentation = {
  strokeColor: "#333",
  strokeWidth: 2,
  strokeStyle: "dashed" as const,
  labelColor: "#111",
};

const edgeRouting = {
  type: "curved" as const,
  sourcePort: "right" as const,
  targetPort: "left" as const,
  waypoints: [{ x: 100, y: 80 }],
};

function nodeFixture(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: aliceId,
    boardId,
    name: "Alice",
    description: "Lead",
    kind: "person",
    iconKey: null,
    properties: { role: "lead" },
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    presentation: nodePresentation,
    version: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function edgeFixture(overrides: Partial<GraphEdgeResponse> = {}): GraphEdgeResponse {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    direction: "DIRECTED",
    name: "knows",
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: { since: "2024" },
    presentation: edgePresentation,
    routing: edgeRouting,
    version: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function hydrate() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: "11111111-1111-4111-8111-111111111111", name: "Novel" },
    board: {
      id: boardId,
      storyId: "11111111-1111-4111-8111-111111111111",
      name: "Characters",
      description: "",
      tags: [],
      graphSettings: {
        defaultEdgeRouting: "orthogonal",
        snapToGrid: false,
        layoutMode: "free",
      },
      createdAt: now,
      updatedAt: now,
    },
    nodes: [nodeFixture(), nodeFixture({ id: bobId, name: "Bob", x: 200 })],
    edges: [edgeFixture()],
  });
  return store;
}

describe("Graph Editor V2 optimistic command runtime", () => {
  it("creates a Node with complete V2 semantic and presentation state", () => {
    const store = hydrate();
    const createdId = "66666666-6666-4666-8666-666666666666";

    expect(
      applyEditorCommand(store, {
        type: "create-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: createdId,
        name: "Charlie",
        description: "Support",
        kind: "person",
        iconKey: "person",
        properties: { age: "30" },
        position: { x: 50, y: 60 },
        width: null,
        height: null,
        zIndex: 2,
        presentation: nodePresentation,
        createdAt: now,
      } as never),
    ).toBe(true);

    expect(store.getState().nodes.find((node) => node.id === createdId)).toMatchObject({
      name: "Charlie",
      description: "Support",
      kind: "person",
      iconKey: "person",
      properties: { age: "30" },
      x: 50,
      y: 60,
      zIndex: 2,
      presentation: nodePresentation,
    });
  });

  it("updates all Inspector-editable Node V2 fields optimistically", () => {
    const store = hydrate();
    const nextPresentation = {
      shape: "diamond" as const,
      fillColor: null,
      borderColor: null,
      borderWidth: 3,
      textColor: null,
    };

    expect(
      applyEditorCommand(store, {
        type: "update-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: aliceId,
        expectedVersion: 3,
        name: "Alicia",
        description: "Updated",
        kind: "character",
        iconKey: "star",
        properties: { role: "hero" },
        presentation: nextPresentation,
      } as never),
    ).toBe(true);

    expect(store.getState().nodes.find((node) => node.id === aliceId)).toMatchObject({
      name: "Alicia",
      description: "Updated",
      kind: "character",
      iconKey: "star",
      properties: { role: "hero" },
      presentation: nextPresentation,
    });
  });

  it("creates an Edge with concrete direction, presentation, and routing", () => {
    const store = hydrate();
    const createdId = "77777777-7777-4777-8777-777777777777";

    expect(
      applyEditorCommand(store, {
        type: "create-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId: createdId,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        direction: "UNDIRECTED",
        name: "siblings",
        description: "Family",
        kind: "family",
        iconKey: null,
        properties: { since: "birth" },
        presentation: edgePresentation,
        routing: edgeRouting,
        createdAt: now,
      } as never),
    ).toBe(true);

    expect(store.getState().edges.find((edge) => edge.id === createdId)).toMatchObject({
      direction: "UNDIRECTED",
      name: "siblings",
      description: "Family",
      kind: "family",
      properties: { since: "birth" },
      presentation: edgePresentation,
      routing: edgeRouting,
    });
  });

  it("updates all Inspector-editable Edge V2 fields optimistically", () => {
    const store = hydrate();
    const nextPresentation = {
      strokeColor: null,
      strokeWidth: 3,
      strokeStyle: "dotted" as const,
      labelColor: null,
    };
    const nextRouting = {
      type: "straight" as const,
      sourcePort: "bottom" as const,
      targetPort: "top" as const,
      waypoints: [],
    };

    expect(
      applyEditorCommand(store, {
        type: "update-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
        expectedVersion: 4,
        direction: "UNDIRECTED",
        name: "bond",
        description: "Updated",
        kind: "family",
        iconKey: "link",
        properties: { state: "active" },
        presentation: nextPresentation,
        routing: nextRouting,
      } as never),
    ).toBe(true);

    expect(store.getState().edges[0]).toMatchObject({
      direction: "UNDIRECTED",
      name: "bond",
      description: "Updated",
      kind: "family",
      iconKey: "link",
      properties: { state: "active" },
      presentation: nextPresentation,
      routing: nextRouting,
    });
  });
});
