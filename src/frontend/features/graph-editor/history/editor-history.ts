import type { EditorCommand } from "../commands/editor-command";
import type {
  EditorHistoryEntry,
  UndoableEditorCommand,
} from "./editor-history-entry";

export type EditorHistorySnapshot = {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
};

export type EditorHistory = {
  record(entry: EditorHistoryEntry): void;
  noteNormalCommand(command: EditorCommand): void;
  boundary(): void;
  undo(replay: (command: UndoableEditorCommand) => boolean): boolean;
  redo(replay: (command: UndoableEditorCommand) => boolean): boolean;
  getSnapshot(): EditorHistorySnapshot;
  subscribe(listener: () => void): () => void;
};

type StoredHistoryEntry = {
  entry: EditorHistoryEntry;
  boundaryGeneration: number;
};

export function createEditorHistory({
  capacity = 100,
  coalesceWindowMs = 2_000,
}: {
  capacity?: number;
  coalesceWindowMs?: number;
} = {}): EditorHistory {
  const undoEntries: StoredHistoryEntry[] = [];
  const redoEntries: StoredHistoryEntry[] = [];
  const listeners = new Set<() => void>();
  let boundaryGeneration = 0;
  let snapshot = buildSnapshot(undoEntries, redoEntries);

  function publish() {
    snapshot = buildSnapshot(undoEntries, redoEntries);
    for (const listener of listeners) listener();
  }

  function clearRedo() {
    if (redoEntries.length === 0) return false;
    redoEntries.length = 0;
    return true;
  }

  function record(entry: EditorHistoryEntry) {
    clearRedo();

    const previous = undoEntries.at(-1);
    if (
      previous &&
      entry.coalescingKey !== null &&
      previous.entry.coalescingKey === entry.coalescingKey &&
      previous.boundaryGeneration === boundaryGeneration &&
      entry.updatedAtMs - previous.entry.updatedAtMs <= coalesceWindowMs
    ) {
      previous.entry = {
        ...entry,
        inverse: previous.entry.inverse,
        createdAtMs: previous.entry.createdAtMs,
      };
      publish();
      return;
    }

    undoEntries.push({ entry, boundaryGeneration });
    if (undoEntries.length > capacity) {
      undoEntries.splice(0, undoEntries.length - capacity);
    }
    publish();
  }

  function noteNormalCommand(_command: EditorCommand) {
    const redoChanged = clearRedo();
    boundaryGeneration += 1;
    if (redoChanged) publish();
  }

  function boundary() {
    boundaryGeneration += 1;
  }

  function undo(replay: (command: UndoableEditorCommand) => boolean) {
    const stored = undoEntries.at(-1);
    if (!stored || !replay(stored.entry.inverse)) return false;

    undoEntries.pop();
    redoEntries.push(stored);
    boundaryGeneration += 1;
    publish();
    return true;
  }

  function redo(replay: (command: UndoableEditorCommand) => boolean) {
    const stored = redoEntries.at(-1);
    if (!stored || !replay(stored.entry.forward)) return false;

    redoEntries.pop();
    undoEntries.push({ ...stored, boundaryGeneration: boundaryGeneration + 1 });
    boundaryGeneration += 1;
    publish();
    return true;
  }

  return {
    record,
    noteNormalCommand,
    boundary,
    undo,
    redo,
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function buildSnapshot(
  undoEntries: readonly StoredHistoryEntry[],
  redoEntries: readonly StoredHistoryEntry[],
): EditorHistorySnapshot {
  return {
    canUndo: undoEntries.length > 0,
    canRedo: redoEntries.length > 0,
    undoCount: undoEntries.length,
    redoCount: redoEntries.length,
  };
}
