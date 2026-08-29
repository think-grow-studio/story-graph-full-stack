"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

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

export type EditorHistoryShortcut = "undo" | "redo";

export function getEditorHistoryShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "metaKey" | "ctrlKey" | "shiftKey" | "target"
  >,
): EditorHistoryShortcut | null {
  if (isEditableHistoryTarget(event.target)) return null;

  const key = event.key.toLowerCase();
  const hasCommandModifier = event.metaKey || event.ctrlKey;
  if (key === "z" && hasCommandModifier) {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey) return "redo";
  return null;
}

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
  const historyScope = useMemo(
    () => ({ boardId, history: createEditorHistory() }),
    [boardId],
  );
  const history = historyScope.history;
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = getEditorHistoryShortcut(event);
      if (!shortcut) return;

      const handled = shortcut === "undo" ? undo() : redo();
      if (handled) event.preventDefault();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  const boundary = useCallback(() => history.boundary(), [history]);

  return { dispatch, undo, redo, boundary, snapshot };
}

function isEditableHistoryTarget(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
    ),
  );
}
