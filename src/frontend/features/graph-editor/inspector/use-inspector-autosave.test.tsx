import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GraphNodeResponse } from "@/contracts/graph/graph.contract";
import type { EditorCommand } from "../commands/editor-command";
import { createGraphEditorStore } from "../store/graph-editor-store";
import { createInspectorDraftStore } from "./inspector-draft-store";
import { toInspectorEntityKey } from "./inspector-draft-model";
import {
  useInspectorAutosave,
  useInspectorDraftState,
} from "./use-inspector-autosave";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "workspace-1";
const now = "2026-08-29T00:00:00.000Z";

function alice(): GraphNodeResponse {
  return {
    id: nodeId,
    storyId,
    name: "Alice",
    description: "",
    iconKey: null,
    properties: {},
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
}

function stores() {
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
    nodes: [alice()],
    edges: [],
    boardNodes: [
      {
        boardId,
        nodeId,
        x: 100,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardEdges: [],
  });

  const draftStore = createInspectorDraftStore();
  draftStore
    .getState()
    .ensureDraft(toInspectorEntityKey("node", nodeId), alice());
  return { graphStore, draftStore };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useInspectorAutosave", () => {
  it("keeps autosave live exactly once through StrictMode effect replay", async () => {
    const { graphStore, draftStore } = stores();
    const dispatch = vi.fn((_: EditorCommand) => "operation-1");

    renderHook(
      () =>
        useInspectorAutosave({
          draftStore,
          graphStore,
          boardId,
          workspaceId,
          dispatch,
        }),
      { wrapper: StrictMode },
    );

    act(() => {
      draftStore
        .getState()
        .updateDraft(toInspectorEntityKey("node", nodeId), { name: "Alicia" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update-node",
        nodeId,
        name: "Alicia",
      }),
    );
  });

  it("does not start autosave before workspace identity exists", async () => {
    const { graphStore, draftStore } = stores();
    const dispatch = vi.fn((_: EditorCommand) => "operation-1");

    renderHook(() =>
      useInspectorAutosave({
        draftStore,
        graphStore,
        boardId,
        workspaceId: undefined,
        dispatch,
      }),
    );

    act(() => {
      draftStore
        .getState()
        .updateDraft(toInspectorEntityKey("node", nodeId), { name: "Alicia" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("subscribes React to draft-store updates", () => {
    const { draftStore } = stores();
    const key = toInspectorEntityKey("node", nodeId);
    const { result } = renderHook(() => useInspectorDraftState(draftStore));

    expect(result.current.drafts[key]?.name).toBe("Alice");
    act(() => {
      draftStore.getState().updateDraft(key, { name: "Alicia" });
    });
    expect(result.current.drafts[key]?.name).toBe("Alicia");
  });
});
