import { describe, expect, it } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";

import { createInspectorDraftStore } from "./inspector-draft-store";

const now = "2026-08-29T00:00:00.000Z";

function node(id: string, name: string): GraphNodeResponse {
  return {
    id,
    storyId: "11111111-1111-4111-8111-111111111111",
    name,
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe("inspector draft store", () => {
  it("preserves an existing entity draft across selection changes and version updates", () => {
    const store = createInspectorDraftStore();
    const alice = node("alice", "Alice");
    const bob = node("bob", "Bob");

    store.getState().ensureDraft("node:alice", alice);
    store.getState().updateDraft("node:alice", {
      propertiesText: '{"job":',
    });
    store.getState().ensureDraft("node:bob", bob);
    store.getState().ensureDraft("node:alice", { ...alice, version: 99 });

    expect(store.getState().drafts["node:alice"]).toMatchObject({
      name: "Alice",
      propertiesText: '{"job":',
      revision: 1,
    });
    expect(store.getState().drafts["node:bob"]).toMatchObject({
      name: "Bob",
      revision: 0,
    });
  });

  it("increments revision only when raw input actually changes", () => {
    const store = createInspectorDraftStore();
    const alice = node("alice", "Alice");
    store.getState().ensureDraft("node:alice", alice);

    store.getState().updateDraft("node:alice", { name: "Alice" });
    expect(store.getState().drafts["node:alice"]?.revision).toBe(0);

    store.getState().updateDraft("node:alice", { name: "Alicia" });
    expect(store.getState().drafts["node:alice"]).toMatchObject({
      name: "Alicia",
      revision: 1,
    });

    store.getState().updateDraft("node:alice", { description: "Lead" });
    expect(store.getState().drafts["node:alice"]).toMatchObject({
      description: "Lead",
      revision: 2,
    });
  });

  it("treats updates for unknown keys as a no-op", () => {
    const store = createInspectorDraftStore();

    store.getState().updateDraft("node:missing", { name: "Ghost" });

    expect(store.getState().drafts).toEqual({});
  });
});
