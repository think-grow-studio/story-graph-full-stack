import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { createInspectorAutosaveController } from "./inspector-autosave-controller";
import { createInspectorDraftStore } from "./inspector-draft-store";
import { toInspectorEntityKey } from "./inspector-draft-model";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const workspaceId = "workspace-1";
const now = "2026-08-29T00:00:00.000Z";

function alice(): GraphNodeResponse {
  return {
    id: aliceId,
    storyId,
    name: "Alice",
    description: "Protagonist",
    iconKey: null,
    properties: { role: "lead" },
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
}

function bob(): GraphNodeResponse {
  return {
    id: bobId,
    storyId,
    name: "Bob",
    description: "Friend",
    iconKey: null,
    properties: {},
    version: 7,
    createdAt: now,
    updatedAt: now,
  };
}

function relationship(): GraphEdgeResponse {
  return {
    id: edgeId,
    storyId,
    sourceNodeId: aliceId,
    targetNodeId: bobId,
    name: "knows",
    description: "Old friends",
    iconKey: null,
    properties: { since: 2020 },
    version: 4,
    createdAt: now,
    updatedAt: now,
  };
}

function setup() {
  const graphStore = createGraphEditorStore();
  graphStore.getState().hydrate({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
    nodes: [alice(), bob()],
    edges: [relationship()],
    boardNodes: [
      {
        boardId,
        nodeId: aliceId,
        x: 100,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        boardId,
        nodeId: bobId,
        x: 400,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardEdges: [
      {
        boardId,
        edgeId,
        style: {},
        labelPresentation: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  const draftStore = createInspectorDraftStore();
  draftStore.getState().ensureDraft(toInspectorEntityKey("node", aliceId), alice());
  draftStore.getState().ensureDraft(toInspectorEntityKey("node", bobId), bob());
  draftStore
    .getState()
    .ensureDraft(toInspectorEntityKey("edge", edgeId), relationship());

  const dispatch = vi.fn(() => "operation-1");
  const controller = createInspectorAutosaveController({
    draftStore,
    graphStore,
    boardId,
    workspaceId,
    dispatch,
  });
  controller.start();

  return { graphStore, draftStore, dispatch, controller };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("inspector autosave controller", () => {
  it("dispatches only after 500 ms and collapses rapid edits to the latest draft", async () => {
    const { draftStore, dispatch, controller } = setup();
    const key = toInspectorEntityKey("node", aliceId);

    draftStore.getState().updateDraft(key, { name: "Alic" });
    await vi.advanceTimersByTimeAsync(300);
    draftStore.getState().updateDraft(key, { name: "Alici" });
    await vi.advanceTimersByTimeAsync(199);
    expect(dispatch).not.toHaveBeenCalled();

    draftStore.getState().updateDraft(key, { name: "Alicia" });
    await vi.advanceTimersByTimeAsync(499);
    expect(dispatch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "update-node",
      boardId,
      workspaceId,
      nodeId: aliceId,
      version: 3,
      name: "Alicia",
      description: "Protagonist",
      properties: { role: "lead" },
    });

    controller.dispose();
  });

  it("keeps debounce timers independent per entity", async () => {
    const { draftStore, dispatch, controller } = setup();

    draftStore
      .getState()
      .updateDraft(toInspectorEntityKey("node", aliceId), { name: "Alicia" });
    await vi.advanceTimersByTimeAsync(250);
    draftStore
      .getState()
      .updateDraft(toInspectorEntityKey("node", bobId), { name: "Robert" });

    await vi.advanceTimersByTimeAsync(250);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: "update-node",
      nodeId: aliceId,
      name: "Alicia",
    });

    await vi.advanceTimersByTimeAsync(250);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1]?.[0]).toMatchObject({
      type: "update-node",
      nodeId: bobId,
      version: 7,
      name: "Robert",
    });

    controller.dispose();
  });

  it("does not dispatch invalid or semantically unchanged drafts", async () => {
    const { draftStore, dispatch, controller } = setup();
    const key = toInspectorEntityKey("node", aliceId);

    draftStore.getState().updateDraft(key, { propertiesText: '{"role":' });
    await vi.advanceTimersByTimeAsync(500);
    expect(dispatch).not.toHaveBeenCalled();

    draftStore.getState().updateDraft(key, { propertiesText: "[1,2,3]" });
    await vi.advanceTimersByTimeAsync(500);
    expect(dispatch).not.toHaveBeenCalled();

    draftStore.getState().updateDraft(key, { name: "   " });
    await vi.advanceTimersByTimeAsync(500);
    expect(dispatch).not.toHaveBeenCalled();

    draftStore.getState().updateDraft(key, {
      name: "Alice",
      propertiesText: '{ "role": "lead" }',
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(dispatch).not.toHaveBeenCalled();

    controller.dispose();
  });

  it("builds Relationship updates from the latest canonical version", async () => {
    const { graphStore, draftStore, dispatch, controller } = setup();
    const key = toInspectorEntityKey("edge", edgeId);

    graphStore.getState().replaceEdge({ ...relationship(), version: 9 });
    draftStore.getState().updateDraft(key, {
      name: "best friend",
      description: "Childhood friends",
      propertiesText: '{"since":2012}',
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      version: 9,
      name: "best friend",
      description: "Childhood friends",
      properties: { since: 2012 },
    });

    controller.dispose();
  });

  it("starts only once and dispose cancels scheduled dispatches", async () => {
    const { draftStore, dispatch, controller } = setup();
    controller.start();

    draftStore
      .getState()
      .updateDraft(toInspectorEntityKey("node", aliceId), { name: "Alicia" });
    controller.dispose();

    await vi.advanceTimersByTimeAsync(500);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
