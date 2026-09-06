import { describe, expect, it } from "vitest";

import type {
  BoardSnapshotResponse,
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { createGraphEditorStore } from "./graph-editor-store";

const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-06T00:00:00.000Z";

function nodeFixture(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: aliceId,
    boardId,
    name: "Alice",
    description: "Protagonist",
    iconKey: null,
    properties: { role: "lead" },
    x: 120,
    y: 80,
    width: null,
    height: null,
    zIndex: 0,
    style: { accent: true },
    version: 1,
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
    name: "knows",
    description: "",
    iconKey: null,
    properties: {},
    style: { dashed: true },
    labelPresentation: { placement: "center" },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const alice = nodeFixture();
const bob = nodeFixture({ id: bobId, name: "Bob", x: 360, y: 180, style: {} });
const knows = edgeFixture();

const snapshot: BoardSnapshotResponse = {
  story: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Novel",
  },
  board: {
    id: boardId,
    storyId: "11111111-1111-4111-8111-111111111111",
    name: "Characters",
    description: "",
    tags: ["인물"],
    createdAt: now,
    updatedAt: now,
  },
  nodes: [alice, bob],
  edges: [knows],
};

// Keeps the current legacy store executable during RED so failures are about
// direct Board ownership rather than an unrelated missing-array exception.
const legacyCompatibleSnapshot = {
  ...snapshot,
  scope: null,
  nodeStates: [],
  edgeStates: [],
  boardNodes: snapshot.nodes.map((node) => ({
    boardId: node.boardId,
    nodeId: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    style: node.style,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  })),
  boardEdges: snapshot.edges.map((edge) => ({
    boardId: edge.boardId,
    edgeId: edge.id,
    style: edge.style,
    labelPresentation: edge.labelPresentation,
    createdAt: edge.createdAt,
    updatedAt: edge.updatedAt,
  })),
};

describe("graph editor store direct Board-owned state", () => {
  it("hydrates only direct Node and Edge rows", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(legacyCompatibleSnapshot as never);

    const state = store.getState() as unknown as Record<string, unknown>;
    expect(state.nodes).toEqual(snapshot.nodes);
    expect(state.edges).toEqual(snapshot.edges);
    expect(state).not.toHaveProperty("scope");
    expect(state).not.toHaveProperty("nodeStates");
    expect(state).not.toHaveProperty("edgeStates");
    expect(state).not.toHaveProperty("boardNodes");
    expect(state).not.toHaveProperty("boardEdges");
  });

  it("moves the direct Node row", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(legacyCompatibleSnapshot as never);

    store.getState().setNodePosition(aliceId, { x: 240, y: 160 });

    expect(store.getState().nodes.find((node) => node.id === aliceId)).toMatchObject({
      x: 240,
      y: 160,
      name: "Alice",
      version: 1,
    });
  });

  it("adds and replaces one direct optimistic Node without a presentation pair", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(legacyCompatibleSnapshot as never);
    const state = store.getState() as never as {
      addOptimisticNode: (node: GraphNodeResponse) => void;
      replaceNode: (node: GraphNodeResponse) => void;
    };
    const charlie = nodeFixture({
      id: "66666666-6666-4666-8666-666666666666",
      name: "Charlie",
      x: 40,
      y: 50,
    });

    expect(() => state.addOptimisticNode(charlie)).not.toThrow();
    state.replaceNode({ ...charlie, name: "Charles", version: 2 });

    expect(
      store.getState().nodes.filter((node) => node.id === charlie.id),
    ).toEqual([expect.objectContaining({ name: "Charles", version: 2, x: 40, y: 50 })]);
  });

  it("deletes a Node with incident Edges and restores the captured Undo snapshot", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(legacyCompatibleSnapshot as never);
    const state = store.getState() as never as {
      deleteNode?: (nodeId: string) => { node: GraphNodeResponse; edges: GraphEdgeResponse[] } | null;
      restoreNode?: (snapshot: { node: GraphNodeResponse; edges: GraphEdgeResponse[] }) => void;
    };

    expect(state.deleteNode).toBeTypeOf("function");
    expect(state.restoreNode).toBeTypeOf("function");

    const deleted = state.deleteNode!(aliceId);
    expect(deleted).toEqual({ node: alice, edges: [knows] });
    expect(store.getState().nodes.some((node) => node.id === aliceId)).toBe(false);
    expect(store.getState().edges.some((edge) => edge.id === edgeId)).toBe(false);

    state.restoreNode!(deleted!);
    expect(store.getState().nodes.find((node) => node.id === aliceId)).toEqual(alice);
    expect(store.getState().edges.find((edge) => edge.id === edgeId)).toEqual(knows);
  });

  it("deletes and restores one direct Edge row", () => {
    const store = createGraphEditorStore();
    store.getState().hydrate(legacyCompatibleSnapshot as never);
    const state = store.getState() as never as {
      deleteEdge?: (edgeId: string) => GraphEdgeResponse | null;
      restoreEdge?: (edge: GraphEdgeResponse) => void;
    };

    expect(state.deleteEdge).toBeTypeOf("function");
    expect(state.restoreEdge).toBeTypeOf("function");

    const deleted = state.deleteEdge!(edgeId);
    expect(deleted).toEqual(knows);
    expect(store.getState().edges).toHaveLength(0);

    state.restoreEdge!(deleted!);
    expect(store.getState().edges).toEqual([knows]);
  });
});
