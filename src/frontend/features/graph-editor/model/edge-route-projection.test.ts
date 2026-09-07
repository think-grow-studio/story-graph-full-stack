import { describe, expect, it } from "vitest";

import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";
import { projectEdgeRoute } from "./edge-route-projection";

const boardId = "22222222-2222-4222-8222-222222222222";
const a = "33333333-3333-4333-8333-333333333333";
const b = "44444444-4444-4444-8444-444444444444";
const now = "2026-09-07T00:00:00.000Z";

function edge(overrides: Partial<GraphEdgeResponse> = {}): GraphEdgeResponse {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    boardId,
    sourceNodeId: a,
    targetNodeId: b,
    direction: "DIRECTED",
    name: "knows",
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: {},
    presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
    routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] },
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("projectEdgeRoute", () => {
  it.each(["straight", "orthogonal", "curved"] as const)("projects %s routing without mutating persistence", (type) => {
    const persisted = edge({ routing: { type, sourcePort: "auto", targetPort: "auto", waypoints: [] } });
    const before = structuredClone(persisted);

    const projection = projectEdgeRoute({
      edge: persisted,
      sourceNode: { x: 0, y: 0, width: 100, height: 80 },
      targetNode: { x: 200, y: 0, width: 100, height: 80 },
      laneIndex: 2,
      laneCount: 3,
    });

    expect(projection).toMatchObject({
      routingType: type,
      sourcePort: "right",
      targetPort: "left",
      laneIndex: 2,
      laneCount: 3,
      direction: "DIRECTED",
    });
    expect(persisted).toEqual(before);
  });

  it("keeps explicit ports and undirected semantics", () => {
    const projection = projectEdgeRoute({
      edge: edge({
        direction: "UNDIRECTED",
        routing: { type: "curved", sourcePort: "top", targetPort: "bottom", waypoints: [{ x: 50, y: 20 }] },
      }),
      sourceNode: { x: 0, y: 0, width: 100, height: 80 },
      targetNode: { x: 200, y: 0, width: 100, height: 80 },
      laneIndex: 0,
      laneCount: 1,
    });

    expect(projection).toMatchObject({
      routingType: "curved",
      sourcePort: "top",
      targetPort: "bottom",
      direction: "UNDIRECTED",
      waypoints: [{ x: 50, y: 20 }],
    });
  });
});
