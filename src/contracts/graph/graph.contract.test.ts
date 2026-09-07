import { describe, expect, it } from "vitest";

import {
  boardResponseSchema,
  boardSnapshotResponseSchema,
  createEdgeRequestSchema,
  createNodeRequestSchema,
  graphEdgeResponseSchema,
  graphNodeResponseSchema,
  updateEdgeRequestSchema,
  updateNodeRequestSchema,
} from "./graph.contract";

const boardId = "11111111-1111-4111-8111-111111111111";
const storyId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const otherNodeId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-06T00:00:00.000Z";

const graphSettings = {
  defaultEdgeRouting: "orthogonal" as const,
  snapToGrid: false,
  layoutMode: "free" as const,
};

const nodePresentation = {
  shape: "rounded-rect" as const,
  fillColor: null,
  borderColor: null,
  borderWidth: null,
  textColor: null,
};

const edgePresentation = {
  strokeColor: null,
  strokeWidth: null,
  strokeStyle: "solid" as const,
  labelColor: null,
};

const edgeRouting = {
  type: "orthogonal" as const,
  sourcePort: "auto" as const,
  targetPort: "auto" as const,
  waypoints: [],
};

function createNodeResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: nodeId,
    boardId,
    name: "Alice",
    description: "",
    kind: "person",
    iconKey: null,
    properties: {},
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    presentation: nodePresentation,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createEdgeResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: edgeId,
    boardId,
    sourceNodeId: nodeId,
    targetNodeId: otherNodeId,
    direction: "DIRECTED",
    name: "친구라고 생각함",
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: {},
    presentation: edgePresentation,
    routing: edgeRouting,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Graph Editor V2 contracts", () => {
  it("exposes Board graph settings with tags", () => {
    const board = boardResponseSchema.parse({
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: ["인물", "전체"],
      graphSettings,
      createdAt: now,
      updatedAt: now,
    });

    expect(board.graphSettings).toEqual(graphSettings);
    expect(board.tags).toEqual(["인물", "전체"]);
  });

  it("accepts recursive properties only when every scalar leaf is a string", () => {
    const validProperties = {
      직업: "마법사",
      수입: "월 200만원",
      "사는 곳": {
        나라: "A 나라",
        도시: "B 도시",
      },
      별명: ["붉은 마법사", "북부의 현자"],
      기록: [{ 날짜: "2026-09-07", 내용: "왕국에 도착" }],
    };

    expect(
      createNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: nodeId,
        name: "Alice",
        properties: validProperties,
        x: 10,
        y: 20,
        kind: "person",
        presentation: nodePresentation,
      }).properties,
    ).toEqual(validProperties);

    for (const invalidProperties of [
      { 나이: 37 },
      { 생존: true },
      { 별명: null },
      { 중첩: { 값: 10 } },
      { 목록: ["문자열", 1] },
    ]) {
      expect(() =>
        createNodeRequestSchema.parse({
          workspaceId: "workspace-1",
          id: nodeId,
          name: "Alice",
          properties: invalidProperties,
          x: 10,
          y: 20,
          kind: "person",
          presentation: nodePresentation,
        }),
      ).toThrow();
    }
  });

  it("bounds recursive property depth, entry count, key length and scalar length", () => {
    const tooDeep = {
      a: { b: { c: { d: { e: { f: { g: "too deep" } } } } } },
    };
    const tooMany = Object.fromEntries(
      Array.from({ length: 201 }, (_, index) => [`key-${index}`, `${index}`]),
    );
    const tooLongKey = { ["k".repeat(101)]: "value" };
    const tooLongValue = { note: "v".repeat(10_001) };

    for (const properties of [tooDeep, tooMany, tooLongKey, tooLongValue]) {
      expect(() =>
        createNodeRequestSchema.parse({
          workspaceId: "workspace-1",
          id: nodeId,
          name: "Alice",
          properties,
          x: 10,
          y: 20,
          kind: "person",
          presentation: nodePresentation,
        }),
      ).toThrow();
    }
  });

  it("uses explicit Node kind and presentation instead of the legacy style field", () => {
    expect(graphNodeResponseSchema.parse(createNodeResponse())).toMatchObject({
      boardId,
      kind: "person",
      presentation: nodePresentation,
      x: 10,
      y: 20,
    });

    expect(() =>
      createNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: nodeId,
        name: "Alice",
        x: 10,
        y: 20,
        style: {},
      }),
    ).toThrow();
  });

  it("uses one directed or undirected semantic statement per Edge", () => {
    expect(graphEdgeResponseSchema.parse(createEdgeResponse())).toMatchObject({
      direction: "DIRECTED",
      kind: "relationship",
      presentation: edgePresentation,
      routing: edgeRouting,
    });

    expect(
      createEdgeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: edgeId,
        sourceNodeId: nodeId,
        targetNodeId: otherNodeId,
        direction: "UNDIRECTED",
        name: "형제",
        kind: "relationship",
        presentation: edgePresentation,
        routing: edgeRouting,
      }).direction,
    ).toBe("UNDIRECTED");

    expect(() =>
      createEdgeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: edgeId,
        sourceNodeId: nodeId,
        targetNodeId: otherNodeId,
        direction: "BIDIRECTIONAL",
        name: "잘못된 양방향",
        kind: "relationship",
        presentation: edgePresentation,
        routing: edgeRouting,
      }),
    ).toThrow();
  });

  it("removes legacy Edge style and labelPresentation fields", () => {
    expect(() =>
      createEdgeRequestSchema.parse({
        workspaceId: "workspace-1",
        id: edgeId,
        sourceNodeId: nodeId,
        targetNodeId: otherNodeId,
        name: "친구",
        style: {},
        labelPresentation: {},
      }),
    ).toThrow();
  });

  it("keeps expectedVersion CAS for semantic, presentation and routing updates", () => {
    expect(
      updateNodeRequestSchema.parse({
        workspaceId: "workspace-1",
        expectedVersion: 1,
        kind: "event",
        presentation: { ...nodePresentation, shape: "diamond" },
      }),
    ).toMatchObject({ expectedVersion: 1, kind: "event" });

    expect(
      updateEdgeRequestSchema.parse({
        workspaceId: "workspace-1",
        expectedVersion: 2,
        direction: "UNDIRECTED",
        routing: { ...edgeRouting, type: "straight" },
      }),
    ).toMatchObject({ expectedVersion: 2, direction: "UNDIRECTED" });

    expect(() =>
      updateEdgeRequestSchema.parse({
        workspaceId: "workspace-1",
        version: 2,
        direction: "UNDIRECTED",
      }),
    ).toThrow();
  });

  it("parses a direct V2 Board snapshot", () => {
    const story = { id: storyId, name: "Novel" };
    const board = boardResponseSchema.parse({
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      graphSettings,
      createdAt: now,
      updatedAt: now,
    });
    const node = graphNodeResponseSchema.parse(createNodeResponse());
    const otherNode = graphNodeResponseSchema.parse(
      createNodeResponse({ id: otherNodeId, name: "Bob", x: 300 }),
    );
    const edge = graphEdgeResponseSchema.parse(createEdgeResponse());

    expect(
      boardSnapshotResponseSchema.parse({
        story,
        board,
        nodes: [node, otherNode],
        edges: [edge],
      }),
    ).toEqual({ story, board, nodes: [node, otherNode], edges: [edge] });
  });
});
