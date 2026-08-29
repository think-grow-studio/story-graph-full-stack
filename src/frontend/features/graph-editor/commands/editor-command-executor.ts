import type { EditorPersistence } from "../persistence/editor-persistence";
import type { GraphEditorStore } from "../store/graph-editor-store";
import type { EditorCommand } from "./editor-command";
import {
  applyEditorCommand,
  persistAndReconcileEditorCommand,
} from "./editor-command-runtime";

export async function executeEditorCommand(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  command: EditorCommand,
): Promise<void> {
  if (!applyEditorCommand(store, command)) return;
  await persistAndReconcileEditorCommand(store, persistence, command);
}
