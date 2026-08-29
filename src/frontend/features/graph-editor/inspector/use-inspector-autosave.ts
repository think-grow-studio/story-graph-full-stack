"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "zustand";

import type { EditorCommand } from "../commands/editor-command";
import type { GraphEditorStore } from "../store/graph-editor-store";
import { createInspectorAutosaveController } from "./inspector-autosave-controller";
import type {
  InspectorDraftState,
  InspectorDraftStore,
} from "./inspector-draft-store";

export function useInspectorAutosave({
  draftStore,
  graphStore,
  boardId,
  workspaceId,
  dispatch,
}: {
  draftStore: InspectorDraftStore;
  graphStore: GraphEditorStore;
  boardId: string;
  workspaceId: string | undefined;
  dispatch(command: EditorCommand): string | null;
}) {
  const controller = useMemo(() => {
    if (!workspaceId) return null;

    return createInspectorAutosaveController({
      draftStore,
      graphStore,
      boardId,
      workspaceId,
      dispatch,
    });
  }, [boardId, dispatch, draftStore, graphStore, workspaceId]);

  useEffect(() => {
    if (!controller) return;

    controller.start();
    return () => controller.dispose();
  }, [controller]);
}

export function useInspectorDraftState(
  draftStore: InspectorDraftStore,
): InspectorDraftState {
  return useStore(draftStore);
}
