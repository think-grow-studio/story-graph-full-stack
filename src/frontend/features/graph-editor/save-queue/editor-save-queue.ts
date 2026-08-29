import type { EditorCommand } from "../commands/editor-command";
import type { SaveState } from "./save-state";

export type FailedEditorOperation = {
  id: string;
  command: EditorCommand;
  error: unknown;
};

export type EditorSaveQueueSnapshot = {
  saveState: SaveState;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  failedOperations: readonly FailedEditorOperation[];
  laneStates: Readonly<
    Record<string, "pending" | "saving" | "error">
  >;
};

export type EditorSaveQueue = {
  enqueue(command: EditorCommand): string;
  retryFailed(): void;
  getSnapshot(): EditorSaveQueueSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

type EditorOperation = {
  id: string;
  command: EditorCommand;
};

type Lane = {
  running: EditorOperation | null;
  pending: EditorOperation[];
  failed: FailedEditorOperation | null;
};

type CreateEditorSaveQueueOptions = {
  execute: (command: EditorCommand) => Promise<void>;
  createOperationId?: () => string;
};

export function createEditorSaveQueue({
  execute,
  createOperationId = () => crypto.randomUUID(),
}: CreateEditorSaveQueueOptions): EditorSaveQueue {
  const lanes = new Map<string, Lane>();
  const listeners = new Set<() => void>();
  const scheduledLaneKeys = new Set<string>();
  let disposed = false;

  function getLane(command: EditorCommand) {
    const key = laneKey(command);
    const existing = lanes.get(key);
    if (existing) return { key, lane: existing };

    const lane: Lane = { running: null, pending: [], failed: null };
    lanes.set(key, lane);
    return { key, lane };
  }

  function notify() {
    if (disposed) return;
    for (const listener of listeners) listener();
  }

  function scheduleLane(key: string) {
    if (disposed || scheduledLaneKeys.has(key)) return;
    scheduledLaneKeys.add(key);
    queueMicrotask(() => {
      scheduledLaneKeys.delete(key);
      processLane(key);
    });
  }

  function scheduleAllLanes() {
    for (const key of lanes.keys()) scheduleLane(key);
  }

  function processLane(key: string) {
    if (disposed) return;
    const lane = lanes.get(key);
    if (!lane || lane.running || lane.failed || lane.pending.length === 0) return;

    const next = lane.pending[0];
    if (!next || isBlockedByActiveNodeCreate(next.command)) return;

    lane.pending.shift();
    lane.running = next;
    notify();

    Promise.resolve()
      .then(() => execute(next.command))
      .then(
        () => {
          if (disposed) return;
          lane.running = null;
          notify();
          scheduleLane(key);
          scheduleAllLanes();
        },
        (error: unknown) => {
          if (disposed) return;
          lane.running = null;
          lane.failed = {
            id: next.id,
            command: next.command,
            error,
          };
          notify();
          scheduleAllLanes();
        },
      );
  }

  function isBlockedByActiveNodeCreate(command: EditorCommand) {
    if (command.type !== "create-edge") return false;
    return (
      hasActiveNodeCreate(command.sourceNodeId) ||
      hasActiveNodeCreate(command.targetNodeId)
    );
  }

  function hasActiveNodeCreate(nodeId: string) {
    const lane = lanes.get(`node:${nodeId}`);
    if (!lane) return false;
    return (
      lane.running?.command.type === "create-node" ||
      lane.failed?.command.type === "create-node" ||
      lane.pending.some((operation) => operation.command.type === "create-node")
    );
  }

  function enqueue(command: EditorCommand) {
    const operation: EditorOperation = {
      id: createOperationId(),
      command,
    };
    const { key, lane } = getLane(command);

    if (command.type === "move-node") {
      const lastPending = lane.pending.at(-1);
      if (lastPending?.command.type === "move-node") {
        lane.pending[lane.pending.length - 1] = operation;
        notify();
        scheduleLane(key);
        return operation.id;
      }
    }

    lane.pending.push(operation);
    notify();
    scheduleLane(key);
    return operation.id;
  }

  function retryFailed() {
    let changed = false;
    for (const lane of lanes.values()) {
      if (!lane.failed) continue;
      lane.pending.unshift({
        id: lane.failed.id,
        command: lane.failed.command,
      });
      lane.failed = null;
      changed = true;
    }
    if (!changed) return;
    notify();
    scheduleAllLanes();
  }

  function getSnapshot(): EditorSaveQueueSnapshot {
    const failedOperations: FailedEditorOperation[] = [];
    const laneStates: Record<string, "pending" | "saving" | "error"> = {};
    let pendingCount = 0;
    let runningCount = 0;

    for (const [key, lane] of lanes) {
      pendingCount += lane.pending.length;
      if (lane.running) runningCount += 1;
      if (lane.failed) failedOperations.push(lane.failed);

      if (lane.failed) laneStates[key] = "error";
      else if (lane.running) laneStates[key] = "saving";
      else if (lane.pending.length > 0) laneStates[key] = "pending";
    }

    return {
      saveState: deriveSaveState({
        failedCount: failedOperations.length,
        runningCount,
        pendingCount,
      }),
      pendingCount,
      runningCount,
      failedCount: failedOperations.length,
      failedOperations,
      laneStates,
    };
  }

  return {
    enqueue,
    retryFailed,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      scheduledLaneKeys.clear();
    },
  };
}

function laneKey(command: EditorCommand) {
  switch (command.type) {
    case "create-node":
    case "move-node":
    case "update-node":
    case "remove-board-node":
      return `node:${command.nodeId}`;
    case "create-edge":
    case "update-edge":
    case "remove-board-edge":
      return `edge:${command.edgeId}`;
  }
}

function deriveSaveState({
  failedCount,
  runningCount,
  pendingCount,
}: {
  failedCount: number;
  runningCount: number;
  pendingCount: number;
}): SaveState {
  if (failedCount > 0) return "error";
  if (runningCount > 0) return "saving";
  if (pendingCount > 0) return "unsaved";
  return "saved";
}
