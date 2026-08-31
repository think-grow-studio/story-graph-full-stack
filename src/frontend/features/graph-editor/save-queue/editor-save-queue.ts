import type { EditorCommand } from "../commands/editor-command";
import type { SaveState } from "./save-state";

export type FailedEditorOperation = {
  operationId: string;
  attempt: number;
  laneKey: string;
  command: EditorCommand;
  error: unknown;
};

export type EditorSaveQueueSnapshot = {
  saveState: SaveState;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  failedOperations: readonly FailedEditorOperation[];
  laneStates: Readonly<Record<string, "pending" | "saving" | "error">>;
};

export type EditorSaveQueue = {
  activate(): void;
  enqueue(
    command: EditorCommand,
    options?: { waitForLaneKeys?: readonly string[] },
  ): string;
  retryFailed(): void;
  getSnapshot(): EditorSaveQueueSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

type EditorOperation = {
  operationId: string;
  attempt: number;
  laneKey: string;
  command: EditorCommand;
  dependencyOperationIds: readonly string[];
};

type FailedOperation = {
  operation: EditorOperation;
  error: unknown;
};

type Lane = {
  running: EditorOperation | null;
  pending: EditorOperation[];
  failed: FailedOperation | null;
};

type CreateEditorSaveQueueOptions = {
  execute: (command: EditorCommand) => Promise<void>;
  createOperationId?: () => string;
};

export function getEditorCommandLaneKey(command: EditorCommand): string {
  switch (command.type) {
    case "create-node":
    case "move-node":
    case "update-node":
    case "update-node-state":
    case "remove-board-node":
    case "restore-board-node":
      return `node:${command.nodeId}`;
    case "place-board-node":
      return `node:${command.node.id}`;
    case "create-edge":
    case "update-edge":
    case "update-edge-state":
    case "remove-board-edge":
    case "restore-board-edge":
      return `edge:${command.edgeId}`;
  }
}

export function createEditorSaveQueue({
  execute,
  createOperationId = () => crypto.randomUUID(),
}: CreateEditorSaveQueueOptions): EditorSaveQueue {
  const lanes = new Map<string, Lane>();
  const listeners = new Set<() => void>();
  const scheduledLaneKeys = new Set<string>();
  const activeNodeCreateOperationIds = new Map<string, string>();
  const succeededOperationIds = new Set<string>();
  let disposed = false;
  let snapshot: EditorSaveQueueSnapshot = buildSnapshot(lanes);

  function getLane(key: string) {
    const existing = lanes.get(key);
    if (existing) return existing;

    const lane: Lane = { running: null, pending: [], failed: null };
    lanes.set(key, lane);
    return lane;
  }

  function publish() {
    if (disposed) return;
    snapshot = buildSnapshot(lanes);
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
    if (!next || !dependenciesSucceeded(next)) return;

    lane.pending.shift();
    next.attempt += 1;
    lane.running = next;
    publish();

    Promise.resolve()
      .then(() => execute(next.command))
      .then(
        () => {
          if (disposed) return;
          lane.running = null;
          succeededOperationIds.add(next.operationId);
          if (next.command.type === "create-node") {
            const activeId = activeNodeCreateOperationIds.get(next.command.nodeId);
            if (activeId === next.operationId) {
              activeNodeCreateOperationIds.delete(next.command.nodeId);
            }
          }
          publish();
          scheduleLane(key);
          scheduleAllLanes();
        },
        (error: unknown) => {
          if (disposed) return;
          lane.running = null;
          lane.failed = { operation: next, error };
          publish();
          scheduleAllLanes();
        },
      );
  }

  function dependenciesSucceeded(operation: EditorOperation) {
    return operation.dependencyOperationIds.every((operationId) =>
      succeededOperationIds.has(operationId),
    );
  }

  function dependencyIdsFor(
    command: EditorCommand,
    waitForLaneKeys: readonly string[],
  ) {
    const dependencyOperationIds = new Set<string>();

    if (command.type === "create-edge") {
      for (const operationId of [
        activeNodeCreateOperationIds.get(command.sourceNodeId),
        activeNodeCreateOperationIds.get(command.targetNodeId),
      ]) {
        if (operationId) dependencyOperationIds.add(operationId);
      }
    }

    for (const laneKey of waitForLaneKeys) {
      const lane = lanes.get(laneKey);
      if (!lane) continue;

      if (lane.running) dependencyOperationIds.add(lane.running.operationId);
      for (const pending of lane.pending) {
        dependencyOperationIds.add(pending.operationId);
      }
      if (lane.failed) {
        dependencyOperationIds.add(lane.failed.operation.operationId);
      }
    }

    return [...dependencyOperationIds];
  }

  function enqueue(
    command: EditorCommand,
    options: { waitForLaneKeys?: readonly string[] } = {},
  ) {
    const laneKey = getEditorCommandLaneKey(command);
    const operation: EditorOperation = {
      operationId: createOperationId(),
      attempt: 0,
      laneKey,
      command,
      dependencyOperationIds: dependencyIdsFor(
        command,
        options.waitForLaneKeys ?? [],
      ),
    };
    const lane = getLane(laneKey);

    if (command.type === "create-node") {
      activeNodeCreateOperationIds.set(command.nodeId, operation.operationId);
    }

    if (command.type === "move-node") {
      const lastPending = lane.pending.at(-1);
      if (lastPending?.command.type === "move-node") {
        lane.pending[lane.pending.length - 1] = operation;
        publish();
        scheduleLane(laneKey);
        return operation.operationId;
      }
    }

    lane.pending.push(operation);
    publish();
    scheduleLane(laneKey);
    return operation.operationId;
  }

  function retryFailed() {
    let changed = false;
    for (const lane of lanes.values()) {
      if (!lane.failed) continue;
      lane.pending.unshift(lane.failed.operation);
      lane.failed = null;
      changed = true;
    }
    if (!changed) return;
    publish();
    scheduleAllLanes();
  }

  return {
    activate() {
      if (!disposed) return;
      disposed = false;
      snapshot = buildSnapshot(lanes);
      scheduleAllLanes();
    },
    enqueue,
    retryFailed,
    getSnapshot() {
      return snapshot;
    },
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

function buildSnapshot(lanes: ReadonlyMap<string, Lane>): EditorSaveQueueSnapshot {
  const failedOperations: FailedEditorOperation[] = [];
  const laneStates: Record<string, "pending" | "saving" | "error"> = {};
  let pendingCount = 0;
  let runningCount = 0;

  for (const [key, lane] of lanes) {
    pendingCount += lane.pending.length;
    if (lane.running) runningCount += 1;
    if (lane.failed) {
      failedOperations.push({
        operationId: lane.failed.operation.operationId,
        attempt: lane.failed.operation.attempt,
        laneKey: lane.failed.operation.laneKey,
        command: lane.failed.operation.command,
        error: lane.failed.error,
      });
    }

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
