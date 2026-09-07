import { describe, expect, it } from "vitest";

import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";
import { buildRelationshipBundles } from "./relationship-bundle";

const boardId = "22222222-2222-4222-8222-222222222222";
const a = "33333333-3333-4333-8333-333333333333";
const b = "44444444-4444-4444-8444-444444444444";
const now = "2026-09-07T00:00:00.000Z";

function edge(id: string, sourceNodeId: string, targetNodeId: string, direction: "DIRECTED" | "UNDIRECTED"): GraphEdgeResponse {
  return {
    id,
    boardId,
    sourceNodeId,
    targetNodeId,
    direction,
    name: id,
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: {},
    presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
    routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] },
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe("buildRelationshipBundles", () => {
  it("groups by unordered Node pair and sorts lanes deterministically", () => {
    const ab2 = edge("77777777-7777-4777-8777-777777777777", a, b, "DIRECTED");
    const ba = edge("66666666-6666-4666-8666-666666666666", b, a, "DIRECTED");
    const undirected = edge("55555555-5555-4555-8555-555555555555", b, a, "UNDIRECTED");
    const ab1 = edge("11111111-1111-4111-8111-111111111119", a, b, "DIRECTED");

    const [bundle] = buildRelationshipBundles([ba, ab2, undirected, ab1]);

    expect(bundle.key).toBe(`${a}:${b}`);
    expect(bundle.nodeIds).toEqual([a, b]);
    expect(bundle.edges.map((item) => item.id)).toEqual([
      undirected.id,
      ab1.id,
      ab2.id,
      ba.id,
    ]);
  });

  it("keeps lane ordering stable when reload input order changes", () => {
    const edges = [
      edge("77777777-7777-4777-8777-777777777777", a, b, "DIRECTED"),
      edge("55555555-5555-4555-8555-555555555555", a, b, "UNDIRECTED"),
      edge("66666666-6666-4666-8666-666666666666", b, a, "DIRECTED"),
    ];

    const first = buildRelationshipBundles(edges)[0].edges.map((item) => item.id);
    const second = buildRelationshipBundles([...edges].reverse())[0].edges.map((item) => item.id);

    expect(second).toEqual(first);
  });
});
