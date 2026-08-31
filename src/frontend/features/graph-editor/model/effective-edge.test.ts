import { describe, expect, it } from "vitest";

import type { GraphEdgeResponse } from "@/contracts/graph/graph.contract";
import {
  findEdgeState,
  normalizeEdgeStateOverrides,
  resolveEffectiveEdge,
} from "./effective-edge";

const now = "2026-08-31T00:00:00.000Z";

function canonicalEdge(): GraphEdgeResponse {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    storyId: "11111111-1111-4111-8111-111111111111",
    sourceNodeId: "44444444-4444-4444-8444-444444444444",
    targetNodeId: "55555555-5555-4555-8555-555555555555",
    name: "trusts",
    description: "old relationship",
    iconKey: "bond",
    properties: { strength: 2, nested: { canonical: true } },
    version: 4,
    createdAt: now,
    updatedAt: now,
  };
}

describe("effective Edge resolution", () => {
  it("finds EdgeState only by matching scope and edge identity", () => {
    const canonical = canonicalEdge();
    const target = {
      scopeId: "66666666-6666-4666-8666-666666666666",
      edgeId: canonical.id,
      name: "betrays",
      description: null,
      properties: null,
      version: 2,
      createdAt: now,
      updatedAt: now,
    };

    expect(
      findEdgeState(target.scopeId, canonical.id, [
        { ...target, scopeId: "77777777-7777-4777-8777-777777777777" },
        { ...target, edgeId: "88888888-8888-4888-8888-888888888888" },
        target,
      ]),
    ).toEqual(target);
  });

  it("applies sparse scoped fields without changing canonical topology or icon", () => {
    const canonical = canonicalEdge();

    const effective = resolveEffectiveEdge(canonical, {
      scopeId: "66666666-6666-4666-8666-666666666666",
      edgeId: canonical.id,
      name: "betrays",
      description: null,
      properties: { strength: 9 },
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    expect(effective).toMatchObject({
      name: "betrays",
      description: "old relationship",
      properties: { strength: 9 },
      sourceNodeId: canonical.sourceNodeId,
      targetNodeId: canonical.targetNodeId,
      iconKey: "bond",
      version: 4,
    });
  });

  it("normalizes canonical-equal fields to null and keeps properties as a whole-object override", () => {
    const canonical = canonicalEdge();

    expect(
      normalizeEdgeStateOverrides(canonical, {
        name: canonical.name,
        description: "scoped relationship",
        properties: {},
      }),
    ).toEqual({
      name: null,
      description: "scoped relationship",
      properties: {},
    });

    expect(
      normalizeEdgeStateOverrides(canonical, {
        name: canonical.name,
        description: canonical.description,
        properties: { nested: { canonical: true }, strength: 2 },
      }),
    ).toEqual({
      name: null,
      description: null,
      properties: null,
    });
  });
});
