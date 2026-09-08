import { describe, expect, it } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";
import {
  createInspectorDraftFromEntity,
  evaluateInspectorDraft,
} from "./inspector-draft-model";

const node: GraphNodeResponse = {
  id: "33333333-3333-4333-8333-333333333333",
  boardId: "22222222-2222-4222-8222-222222222222",
  name: "Alice",
  description: "Lead",
  kind: "person",
  iconKey: null,
  properties: { profile: { age: "20", aliases: ["A", "Leader"] } },
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
  version: 1,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

describe("Graph Editor V2 Inspector property validation", () => {
  it("accepts nested string-valued Graph properties", () => {
    const draft = {
      ...createInspectorDraftFromEntity(node),
      properties: {
        profile: { age: "21", aliases: ["A", "Hero"] },
      },
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, node)).toMatchObject({
      status: "saveable",
      dirty: true,
      input: {
        kind: "person",
        properties: { profile: { age: "21", aliases: ["A", "Hero"] } },
      },
    });
  });

  it("rejects non-string scalar values before autosave dispatch", () => {
    const draft = {
      ...createInspectorDraftFromEntity(node),
      properties: { profile: { age: 21 as never } },
      revision: 1,
    };

    expect(evaluateInspectorDraft(draft, node)).toEqual({
      status: "invalid",
      dirty: true,
      message: "Properties do not match the Graph property rules.",
    });
  });
});
