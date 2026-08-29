"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import type { EditorCommand } from "../commands/editor-command";
import {
  applyEditorCommand,
  persistAndReconcileEditorCommand,
} from "../commands/editor-command-runtime";
import type { EditorPersistence } from "../persistence/editor-persistence";
import type { GraphEditorStore } from "../store/graph-editor-store";
import {
  createEditorSaveQueue,
  getEditorCommandLaneKey,
  type EditorSaveQueueSnapshot,
} from "./editor-save-queue";

export type UseEditorSaveQueueResult = {
  dispatch(command: EditorCommand): string | null;
  retryFailed(): void;
  snapshot: EditorSaveQueueSnapshot;
  getLaneState(
    commandOrLaneKey: EditorCommand | string,
  ): "idle" | "pending" | "saving" | "error";
};

export function useEditorSaveQueue(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  boardId: string,
): UseEditorSaveQueueResult {
  const persistenceRef = useRef(persistence);

  useEffect(() => {
    persistenceRef.current = persistence;
  }, [persistence]);

  const execute = useCallback(
    (command: EditorCommand) =>
      persistAndReconcileEditorCommand(
        store,
        persistenceRef.current,
        command,
      ),
    [store],
  );

  const createOperationId = useCallback(
    () => `${boardId}:${crypto.randomUUID()}`,
    [boardId],
  );

  const queue = useMemo(
    () => createEditorSaveQueue({ execute, createOperationId }),
    [createOperationId, execute],
  );

  useEffect(() => () => queue.dispose(), [queue]);

  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    queue.getSnapshot,
  );

  const dispatch = useCallback(
    (command: EditorCommand) => {
      if (!applyEditorCommand(store, command)) return null;
      return queue.enqueue(command);
    },
    [queue, store],
  );

  const retryFailed = useCallback(() => queue.retryFailed(), [queue]);

  const getLaneState = useCallback(
    (commandOrLaneKey: EditorCommand | string) => {
      const laneKey =
        typeof commandOrLaneKey === "string"
          ? commandOrLaneKey
          : getEditorCommandLaneKey(commandOrLaneKey);
      return snapshot.laneStates[laneKey] ?? "idle";
    },
    [snapshot],
  );

  return { dispatch, retryFailed, snapshot, getLaneState };
}
