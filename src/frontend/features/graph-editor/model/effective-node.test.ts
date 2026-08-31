import { describe, expect, it } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";
import {
  normalizeNodeStateOverrides,
  resolveEffectiveNode,
} from "./effective-node";

const canonical: GraphNodeResponse = {
  id: "33333333-3333-4333-8333-333333333333",
  storyId: "11111111-1111-4111-8111-111111111111",
  name: "Alice",
  description: "Knight",
  iconKey: null,
  properties: { age: 24, faction: "Guard" },
  version: 3,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

describe("effective scoped Node", () => {
  it("falls back field-by-field and replaces properties as one object", () => {
    const effective = resolveEffectiveNode(canonical, {
      scopeId: "44444444-4444-4444-8444-444444444444",
      nodeId: canonical.id,
      name: "Queen Alice",
      description: null,
      properties: { age: 31 },
      version: 1,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    });

    expect(effective).toMatchObject({
      name: "Queen Alice",
      description: "Knight",
      properties: { age: 31 },
    });
    expect(effective.properties).not.toHaveProperty("faction");
  });

  it("normalizes effective values equal to canonical values back to null overrides", () => {
    expect(
      normalizeNodeStateOverrides(canonical, {
        name: "Alice",
        description: "Changed",
        properties: { faction: "Guard", age: 24 },
      }),
    ).toEqual({
      name: null,
      description: "Changed",
      properties: null,
    });
  });
});
