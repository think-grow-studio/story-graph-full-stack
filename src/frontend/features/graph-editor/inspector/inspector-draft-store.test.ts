import { describe, expect, it } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";

import { createInspectorDraftStore } from "./inspector-draft-store";

const now = "2026-08-29T00:00:00.000Z";
const boardId = "22222222-2222-4222-8222-222222222222";

function node(id: string, name: string): GraphNodeResponse {
  return {
    id,
    boardId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    x: 0,
    y: 0,
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
    createdAt: now,
    updatedAt: now,
    kind: "entity",
  };
}

describe("inspector draft store", () => {
  it("preserves an existing structured draft across selection changes and version updates", () => {
    const store = createInspectorDraftStore();
    const alice = node("alice", "Alice");
    const bob = node("bob", "Bob");

    store.getState().ensureDraft("node:alice", alice);
    store.getState().updateDraft("node:alice", {
      properties: { job: "mage", profile: { level: "3" } },
    });
    store.getState().ensureDraft("node:bob", bob);
    store.getState().ensureDraft("node:alice", { ...alice, version: 99 });

    expect(store.getState().drafts["node:alice"]).toMatchObject({
      name: "Alice",
      properties: { job: "mage", profile: { level: "3" } },
      revision: 1,
    });
    expect(store.getState().drafts["node:bob"]).toMatchObject({
      name: "Bob",
      revision: 0,
    });
  });

  it("increments revision only when structured input actually changes", () => {
    const store = createInspectorDraftStore();
    const alice = node("alice", "Alice");
    store.getState().ensureDraft("node:alice", alice);

    store.getState().updateDraft("node:alice", { name: "Alice" });
    store.getState().updateDraft("node:alice", { properties: {} });
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

  it("replaces the exact structured draft for Undo/Redo replay and increments revision once", () => {
    const store = createInspectorDraftStore();
    const alice = node("alice", "Alice");
    store.getState().ensureDraft("node:alice", alice);
    store.getState().updateDraft("node:alice", {
      name: "Alicia",
      description: "Changed",
      kind: "person",
      properties: { role: "lead", aliases: ["A"] },
    });

    const beforeRevision = store.getState().drafts["node:alice"]?.revision;
    store.getState().replaceDraft("node:alice", {
      name: "Alice",
      description: "",
      kind: "entity",
      properties: {},
      direction: null,
      routingType: null,
    });

    expect(store.getState().drafts["node:alice"]).toEqual({
      name: "Alice",
      description: "",
      kind: "entity",
      properties: {},
      direction: null,
      routingType: null,
      revision: (beforeRevision ?? 0) + 1,
    });

    const afterReplay = store.getState();
    store.getState().replaceDraft("node:alice", {
      name: "Alice",
      description: "",
      kind: "entity",
      properties: {},
      direction: null,
      routingType: null,
    });
    expect(store.getState()).toBe(afterReplay);
  });

  it("treats updates and replay replacements for unknown keys as a no-op", () => {
    const store = createInspectorDraftStore();

    store.getState().updateDraft("node:missing", { name: "Ghost" });
    const beforeReplay = store.getState();
    store.getState().replaceDraft("node:missing", {
      name: "Ghost",
      description: "",
      kind: "entity",
      properties: {},
      direction: null,
      routingType: null,
    });

    expect(store.getState()).toBe(beforeReplay);
    expect(store.getState().drafts).toEqual({});
  });
});
