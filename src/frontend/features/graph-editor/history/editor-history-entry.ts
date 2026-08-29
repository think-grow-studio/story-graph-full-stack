import type {
  EditorCommand,
  MoveNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
} from "../commands/editor-command";
import type { GraphEditorStore } from "../store/graph-editor-store";

export type UndoableEditorCommand =
  | MoveNodeCommand
  | UpdateNodeCommand
  | UpdateEdgeCommand;

export type EditorHistoryEntry = {
  forward: UndoableEditorCommand;
  inverse: UndoableEditorCommand;
  coalescingKey: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export function isUndoableEditorCommand(
  command: EditorCommand,
): command is UndoableEditorCommand {
  return (
    command.type === "move-node" ||
    command.type === "update-node" ||
    command.type === "update-edge"
  );
}

export function createEditorHistoryEntry({
  store,
  command,
  nowMs,
  moveStartPosition,
}: {
  store: GraphEditorStore;
  command: EditorCommand;
  nowMs: number;
  moveStartPosition?: { x: number; y: number };
}): EditorHistoryEntry | null {
  if (!isUndoableEditorCommand(command)) return null;

  if (command.type === "move-node") {
    if (!moveStartPosition) return null;
    if (
      moveStartPosition.x === command.position.x &&
      moveStartPosition.y === command.position.y
    ) {
      return null;
    }

    return {
      forward: command,
      inverse: { ...command, position: moveStartPosition },
      coalescingKey: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
  }

  if (command.type === "update-node") {
    const current = store
      .getState()
      .nodes.find((node) => node.id === command.nodeId);
    if (!current) return null;

    return {
      forward: command,
      inverse: {
        ...command,
        version: current.version,
        name: current.name,
        description: current.description,
        properties: current.properties,
      },
      coalescingKey: `update-node:${command.nodeId}`,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    };
  }

  const current = store
    .getState()
    .edges.find((edge) => edge.id === command.edgeId);
  if (!current) return null;

  return {
    forward: command,
    inverse: {
      ...command,
      version: current.version,
      name: current.name,
      description: current.description,
      properties: current.properties,
    },
    coalescingKey: `update-edge:${command.edgeId}`,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}
