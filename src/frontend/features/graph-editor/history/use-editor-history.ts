"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { EditorCommand } from "../commands/editor-command";
import type { GraphEditorStore } from "../store/graph-editor-store";
import { createEditorHistory, type EditorHistorySnapshot } from "./editor-history";
import {
  createEditorHistoryEntry,
  type UndoableEditorCommand,
} from "./editor-history-entry";

export type UseEditorHistoryResult = {
  dispatch(
    command: EditorCommand,
    options?: { moveStartPosition?: { x: number; y: number } },
  ): string | null;
  undo(): boolean;
  redo(): boolean;
  boundary(): void;
  snapshot: EditorHistorySnapshot;
};

export function useEditorHistory({
  store,
  boardId,
  dispatchToSaveQueue,
  blocked,
  onReplayCommand,
}: {
  store: GraphEditorStore;
  boardId: string;
  dispatchToSaveQueue(command: EditorCommand): string | null;
  blocked: boolean;
  onReplayCommand?(command: UndoableEditorCommand): void;
}): UseEditorHistoryResult {
  const history = useMemo(() => createEditorHistory(), [boardId]);
  const snapshot = useSyncExternalStore(
    history.subscribe,
    history.getSnapshot,
    history.getSnapshot,
  );

  const dispatch = useCallback(
    (
      command: EditorCommand,
      options?: { moveStartPosition?: { x: number; y: number } },
    ) => {
      const entry = createEditorHistoryEntry({
        store,
        command,
        nowMs: Date.now(),
        moveStartPosition: options?.moveStartPosition,
      });
      const operationId = dispatchToSaveQueue(command);
      if (!operationId) return null;

      if (entry) history.record(entry);
      else history.noteNormalCommand(command);
      return operationId;
    },
    [dispatchToSaveQueue, history, store],
  );

  const undo = useCallback(() => {
    if (blocked) return false;
    return history.undo((command) => {
      const operationId = dispatchToSaveQueue(command);
      if (!operationId) return false;
      onReplayCommand?.(command);
      return true;
    });
  }, [blocked, dispatchToSaveQueue, history, onReplayCommand]);

  const redo = useCallback(() => {
    if (blocked) return false;
    return history.redo((command) => {
      const operationId = dispatchToSaveQueue(command);
      if (!operationId) return false;
      onReplayCommand?.(command);
      return true;
    });
  }, [blocked, dispatchToSaveQueue, history, onReplayCommand]);

  const boundary = useCallback(() => history.boundary(), [history]);

  return { dispatch, undo, redo, boundary, snapshot };
}
