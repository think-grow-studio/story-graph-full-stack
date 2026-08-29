import { describe, expect, it } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";

import {
  createInspectorDraftFromEntity,
  evaluateInspectorDraft,
  toInspectorEntityKey,
} from "./inspector-draft-model";

const now = "2026-08-29T00:00:00.000Z";

function alice(overrides: Partial<GraphNodeResponse> = {}): GraphNodeResponse {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    storyId: "11111111-1111-4111-8111-111111111111",
    name: "Alice",
    description: "Protagonist",
    iconKey: null,
    properties: { role: "lead", meta: { age: 31 } },
    version: 3,
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

  it("initializes raw draft text from canonical entity values", () => {
    expect(createInspectorDraftFromEntity(alice())).toEqual({
      name: "Alice",
      description: "Protagonist",
      propertiesText: JSON.stringify(
        { role: "lead", meta: { age: 31 } },
        null,
        2,
      ),
      revision: 0,
    });
  });

  it("keeps incomplete JSON invalid and dirty without producing canonical input", () => {
    const draft = {
      ...createInspectorDraftFromEntity(alice()),
      propertiesText: '{"role":"lead","job":',
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, alice())).toEqual({
      status: "invalid",
      dirty: true,
      message: "Properties must be valid JSON.",
    });
  });

  it("rejects non-object JSON values", () => {
    for (const propertiesText of ["null", "[1,2,3]"]) {
      expect(
        evaluateInspectorDraft(
          {
            ...createInspectorDraftFromEntity(alice()),
            propertiesText,
            revision: 1,
          },
          alice(),
        ),
      ).toEqual({
        status: "invalid",
        dirty: true,
        message: "Properties must be a JSON object.",
      });
    }
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

  it("normalizes saveable values without rewriting the raw draft", () => {
    const draft = {
      name: "  Alicia  ",
      description: "Main protagonist",
      propertiesText: '{"role":"lead","meta":{"age":31},"job":"writer"}',
      revision: 4,
    };

    expect(evaluateInspectorDraft(draft, alice())).toEqual({
      status: "saveable",
      dirty: true,
      input: {
        name: "Alicia",
        description: "Main protagonist",
        properties: {
          role: "lead",
          meta: { age: 31 },
          job: "writer",
        },
      },
    });
    expect(draft.name).toBe("  Alicia  ");
  });

  it("treats object key order and JSON whitespace as semantically unchanged", () => {
    const draft = {
      ...createInspectorDraftFromEntity(alice()),
      propertiesText: '{ "meta": { "age": 31 }, "role": "lead" }',
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, alice())).toEqual({
      status: "saveable",
      dirty: false,
      input: {
        name: "Alice",
        description: "Protagonist",
        properties: { meta: { age: 31 }, role: "lead" },
      },
    });
  });

  it("keeps array order significant inside JSON objects", () => {
    const entity = alice({ properties: { beats: ["a", "b"] } });
    const draft = {
      ...createInspectorDraftFromEntity(entity),
      propertiesText: '{"beats":["b","a"]}',
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, entity)).toMatchObject({
      status: "saveable",
      dirty: true,
    });
  });
});
