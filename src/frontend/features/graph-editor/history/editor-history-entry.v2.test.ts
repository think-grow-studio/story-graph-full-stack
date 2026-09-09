import { describe, expect, it } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { createEditorHistoryEntry } from "./editor-history-entry";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-07T00:00:00.000Z";

const originalNodePresentation = {
  shape: "ellipse" as const,
  fillColor: "#fff",
  borderColor: "#111",
  borderWidth: 2,
  textColor: "#222",
};
const originalEdgePresentation = {
  strokeColor: "#333",
  strokeWidth: 2,
  strokeStyle: "dashed" as const,
  labelColor: "#111",
};
const originalEdgeRouting = {
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
    iconKey: "person",
    properties: { profile: { age: "20" } },
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    presentation: originalNodePresentation,
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
    name: "protects",
    description: "Original",
    kind: "protection",
    iconKey: "link",
    properties: { since: "2024" },
    presentation: originalEdgePresentation,
    routing: originalEdgeRouting,
    version: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function hydrate() {
  const store = createGraphEditorStore();
  store.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
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
    nodes: [nodeFixture(), nodeFixture({ id: bobId, name: "Bob" })],
    edges: [edgeFixture()],
  });
  return store;
}

describe("Graph Editor V2 history inverse snapshots", () => {
  it("captures the exact prior Node semantic and presentation values", () => {
    const store = hydrate();
    const entry = createEditorHistoryEntry({
      store,
      nowMs: 100,
      command: {
        type: "update-node",
        boardId,
        workspaceId: "workspace-1",
        nodeId: aliceId,
        expectedVersion: 3,
        name: "Alicia",
        description: "Changed",
        kind: "character",
        iconKey: "star",
        properties: { role: "hero" },
        presentation: {
          shape: "diamond",
          fillColor: null,
          borderColor: null,
          borderWidth: 3,
          textColor: null,
        },
      },
    });

    expect(entry?.inverse).toEqual({
      type: "update-node",
      boardId,
      workspaceId: "workspace-1",
      nodeId: aliceId,
      expectedVersion: 3,
      name: "Alice",
      description: "Lead",
      kind: "person",
      iconKey: "person",
      properties: { profile: { age: "20" } },
      presentation: originalNodePresentation,
    });
  });

  it("captures the exact prior Edge direction, semantics, presentation, and routing", () => {
    const store = hydrate();
    const entry = createEditorHistoryEntry({
      store,
      nowMs: 100,
      command: {
        type: "update-edge",
        boardId,
        workspaceId: "workspace-1",
        edgeId,
        expectedVersion: 4,
        direction: "UNDIRECTED",
        name: "bond",
        description: "Changed",
        kind: "family",
        iconKey: null,
        properties: { state: "active" },
        presentation: {
          strokeColor: null,
          strokeWidth: 3,
          strokeStyle: "dotted",
          labelColor: null,
        },
        routing: {
          type: "straight",
          sourcePort: "bottom",
          targetPort: "top",
          waypoints: [],
        },
      },
    });

    expect(entry?.inverse).toEqual({
      type: "update-edge",
      boardId,
      workspaceId: "workspace-1",
      edgeId,
      expectedVersion: 4,
      direction: "DIRECTED",
      name: "protects",
      description: "Original",
      kind: "protection",
      iconKey: "link",
      properties: { since: "2024" },
      presentation: originalEdgePresentation,
      routing: originalEdgeRouting,
    });
  });
});
