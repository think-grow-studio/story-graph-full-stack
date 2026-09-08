import { describe, expect, it } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

import {
  combineEditorSaveState,
  createInspectorDraftFromEntity,
  evaluateInspectorDraft,
  toInspectorEntityKey,
} from "./inspector-draft-model";

const now = "2026-08-29T00:00:00.000Z";

function alice(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    boardId: "22222222-2222-4222-8222-222222222222",
    name: "Alice",
    description: "Protagonist",
    kind: "entity",
    iconKey: null,
    properties: { role: "lead", meta: { age: "31" } },
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    presentation: {
      shape: "rounded-rect",
      fillColor: null,
      borderColor: null,
      borderWidth: null,
      textColor: null,
    },
    version: 3,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function relationship(
  overrides: Partial<GraphEdgeResponse> = {},
): GraphEdgeResponse {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    boardId: "22222222-2222-4222-8222-222222222222",
    sourceNodeId: "33333333-3333-4333-8333-333333333333",
    targetNodeId: "44444444-4444-4444-8444-444444444444",
    direction: "DIRECTED",
    name: "knows",
    description: "Old friends",
    kind: "relationship",
    iconKey: null,
    properties: { since: "2020" },
    presentation: {
      strokeColor: null,
      strokeWidth: null,
      strokeStyle: "solid",
      labelColor: null,
    },
    routing: {
      type: "orthogonal",
      sourcePort: "auto",
      targetPort: "auto",
      waypoints: [],
    },
    version: 4,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("inspector draft model", () => {
  it("builds a stable entity key", () => {
    expect(toInspectorEntityKey("node", alice().id)).toBe(`node:${alice().id}`);
    expect(toInspectorEntityKey("edge", "edge-1")).toBe("edge:edge-1");
  });

  it("initializes a structured Node draft from direct entity values", () => {
    expect(createInspectorDraftFromEntity(alice())).toEqual({
      name: "Alice",
      description: "Protagonist",
      kind: "entity",
      properties: { role: "lead", meta: { age: "31" } },
      direction: null,
      routingType: null,
      revision: 0,
    });
  });

  it("initializes Edge direction and routing controls", () => {
    expect(createInspectorDraftFromEntity(relationship())).toMatchObject({
      kind: "relationship",
      direction: "DIRECTED",
      routingType: "orthogonal",
      properties: { since: "2020" },
    });
  });

  it("rejects invalid structured properties before autosave dispatch", () => {
    const draft = {
      ...createInspectorDraftFromEntity(alice()),
      properties: { profile: { age: 21 as never } },
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, alice())).toEqual({
      status: "invalid",
      dirty: true,
      message: "Properties do not match the Graph property rules.",
    });
  });

  it("preserves whitespace-only name as draft but marks it unsaveable", () => {
    const draft = {
      ...createInspectorDraftFromEntity(alice()),
      name: "   ",
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, alice())).toEqual({
      status: "invalid",
      dirty: true,
      message: "Name is required.",
    });
  });

  it("normalizes saveable name and kind while keeping structured properties", () => {
    const draft = {
      ...createInspectorDraftFromEntity(alice()),
      name: "  Alicia  ",
      description: "Main protagonist",
      kind: "  person  ",
      properties: {
        role: "lead",
        meta: { age: "31" },
        job: "writer",
      },
      revision: 4,
    };

    expect(evaluateInspectorDraft(draft, alice())).toEqual({
      status: "saveable",
      dirty: true,
      input: {
        name: "Alicia",
        description: "Main protagonist",
        kind: "person",
        properties: {
          role: "lead",
          meta: { age: "31" },
          job: "writer",
        },
      },
    });
    expect(draft.name).toBe("  Alicia  ");
    expect(draft.kind).toBe("  person  ");
  });

  it("treats object key order as semantically unchanged", () => {
    const draft = {
      ...createInspectorDraftFromEntity(alice()),
      properties: { meta: { age: "31" }, role: "lead" },
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, alice())).toMatchObject({
      status: "saveable",
      dirty: false,
    });
  });

  it("keeps array order significant", () => {
    const entity = alice({ properties: { beats: ["a", "b"] } });
    const draft = {
      ...createInspectorDraftFromEntity(entity),
      properties: { beats: ["b", "a"] },
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, entity)).toMatchObject({
      status: "saveable",
      dirty: true,
    });
  });

  it("marks Edge direction and routing changes dirty", () => {
    const edge = relationship();
    const draft = {
      ...createInspectorDraftFromEntity(edge),
      direction: "UNDIRECTED" as const,
      routingType: "curved" as const,
      revision: 2,
    };

    expect(evaluateInspectorDraft(draft, edge)).toMatchObject({
      status: "saveable",
      dirty: true,
    });
  });
});

describe("combineEditorSaveState", () => {
  it.each([
    ["saved", false, "saved"],
    ["saved", true, "unsaved"],
    ["unsaved", true, "unsaved"],
    ["saving", true, "saving"],
    ["error", true, "error"],
  ] as const)(
    "combines queue %s with dirty=%s as %s",
    (queueState, hasDirtyInspectorDraft, expected) => {
      expect(
        combineEditorSaveState(queueState, hasDirtyInspectorDraft),
      ).toBe(expected);
    },
  );
});
