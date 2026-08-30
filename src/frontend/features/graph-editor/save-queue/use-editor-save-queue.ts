"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { EditorCommand } from "../commands/editor-command";
import { applyEditorCommand } from "../commands/editor-command-runtime";
import type { EditorPersistence } from "../persistence/editor-persistence";
import type { GraphEditorStore } from "../store/graph-editor-store";
import { createEditorPersistenceRuntime } from "./editor-persistence-runtime";
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
  const persistenceRuntime = useMemo(
    () => createEditorPersistenceRuntime(store),
    [store],
  );

  useEffect(() => {
    persistenceRuntime.setPersistence(persistence);
  }, [persistence, persistenceRuntime]);

  const queue = useMemo(
    () =>
      createEditorSaveQueue({
        execute: persistenceRuntime.execute,
        createOperationId: () => `${boardId}:${crypto.randomUUID()}`,
      }),
    [boardId, persistenceRuntime],
  );

  useEffect(() => {
    queue.activate();
    return () => queue.dispose();
  }, [queue]);

  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    queue.getSnapshot,
  );

  const dispatch = useCallback(
    (command: EditorCommand) => {
      const waitForLaneKeys =
        command.type === "remove-board-node"
          ? incidentEdgeLaneKeys(store, command.nodeId)
          : [];
      if (!applyEditorCommand(store, command)) return null;
      return queue.enqueue(command, { waitForLaneKeys });
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

function incidentEdgeLaneKeys(store: GraphEditorStore, nodeId: string): string[] {
  return store
    .getState()
    .edges.filter(
      (edge) => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId,
    )
    .map((edge) => `edge:${edge.id}`);
}
