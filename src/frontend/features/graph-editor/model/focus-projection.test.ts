import { describe, expect, it } from "vitest";

import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";
import { projectGraphFocus } from "./focus-projection";

const boardId = "22222222-2222-4222-8222-222222222222";
const a = "33333333-3333-4333-8333-333333333333";
const b = "44444444-4444-4444-8444-444444444444";
const c = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-07T00:00:00.000Z";

function edge(id: string, sourceNodeId: string, targetNodeId: string): GraphEdgeResponse {
  return {
    id,
    boardId,
    sourceNodeId,
    targetNodeId,
    direction: "DIRECTED",
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

describe("projectGraphFocus", () => {
  const ab1 = edge("66666666-6666-4666-8666-666666666666", a, b);
  const ab2 = edge("77777777-7777-4777-8777-777777777777", b, a);
  const bc = edge("88888888-8888-4888-8888-888888888888", b, c);
  const edges = [ab1, ab2, bc];

  it("focuses a selected Node, incident Edges, and direct neighbors", () => {
    const projection = projectGraphFocus({ selectedNodeId: b, selectedEdgeId: null, edges });
    expect([...projection.focusedNodeIds].sort()).toEqual([a, b, c].sort());
    expect([...projection.focusedEdgeIds].sort()).toEqual(edges.map((item) => item.id).sort());
    expect(projection.secondaryEdgeIds.size).toBe(0);
  });

  it("focuses a selected Edge and endpoints while marking bundle siblings secondary", () => {
    const projection = projectGraphFocus({ selectedNodeId: null, selectedEdgeId: ab1.id, edges });
    expect([...projection.focusedNodeIds].sort()).toEqual([a, b].sort());
    expect([...projection.focusedEdgeIds]).toEqual([ab1.id]);
    expect([...projection.secondaryEdgeIds]).toEqual([ab2.id]);
  });

  it("returns empty focus sets when nothing is selected", () => {
    const projection = projectGraphFocus({ selectedNodeId: null, selectedEdgeId: null, edges });
    expect(projection.focusedNodeIds.size).toBe(0);
    expect(projection.focusedEdgeIds.size).toBe(0);
    expect(projection.secondaryEdgeIds.size).toBe(0);
  });
});
