import type { EditorCommand } from "../commands/editor-command";
import { persistAndReconcileEditorCommand } from "../commands/editor-command-runtime";
import type { EditorPersistence } from "../persistence/editor-persistence";
import type { GraphEditorStore } from "../store/graph-editor-store";

export type EditorPersistenceRuntime = {
  setPersistence(persistence: EditorPersistence): void;
  execute(command: EditorCommand): Promise<void>;
};

export function createEditorPersistenceRuntime(
  store: GraphEditorStore,
): EditorPersistenceRuntime {
  let currentPersistence: EditorPersistence | null = null;

  return {
    setPersistence(persistence) {
      currentPersistence = persistence;
    },
    async execute(command) {
      if (!currentPersistence) {
        throw new Error("Editor persistence is not ready.");
      }

      await persistAndReconcileEditorCommand(
        store,
        currentPersistence,
        command,
      );
    },
  };
}
