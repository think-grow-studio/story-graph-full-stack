import type {
  DeleteEdgeCommand,
  DeleteNodeCommand,
  EditorCommand,
  MoveNodeCommand,
  RestoreEdgeCommand,
  RestoreNodeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
} from "../commands/editor-command";
import type { GraphEditorStore } from "../store/graph-editor-store";

export type UndoableEditorCommand =
  | MoveNodeCommand
  | UpdateNodeCommand
  | DeleteNodeCommand
  | RestoreNodeCommand
  | UpdateEdgeCommand
  | DeleteEdgeCommand
  | RestoreEdgeCommand;

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
    command.type === "delete-node" ||
    command.type === "restore-node" ||
    command.type === "update-edge" ||
    command.type === "delete-edge" ||
    command.type === "restore-edge"
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

    return entry(command, { ...command, position: moveStartPosition }, null, nowMs);
  }

  if (command.type === "update-node") {
    const current = store
      .getState()
      .nodes.find((node) => node.id === command.nodeId);
    if (!current) return null;

    return entry(
      command,
      {
        ...command,
        expectedVersion: current.version,
        name: current.name,
        description: current.description,
        kind: current.kind,
        iconKey: current.iconKey,
        properties: current.properties,
        presentation: current.presentation,
      },
      `update-node:${command.nodeId}`,
      nowMs,
    );
  }

  if (command.type === "delete-node") {
    const state = store.getState();
    const current = state.nodes.find((node) => node.id === command.nodeId);
    if (!current) return null;

    const incidentEdges = state.edges.filter(
      (edge) =>
        edge.sourceNodeId === command.nodeId ||
        edge.targetNodeId === command.nodeId,
    );

    return entry(
      command,
      {
        type: "restore-node",
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        nodeId: command.nodeId,
        node: current,
        edges: incidentEdges,
      },
      null,
      nowMs,
    );
  }

  if (command.type === "restore-node") {
    return entry(
      command,
      {
        type: "delete-node",
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        nodeId: command.nodeId,
      },
      null,
      nowMs,
    );
  }

  if (command.type === "update-edge") {
    const current = store
      .getState()
      .edges.find((edge) => edge.id === command.edgeId);
    if (!current) return null;

    return entry(
      command,
      {
        ...command,
        expectedVersion: current.version,
        direction: current.direction,
        name: current.name,
        description: current.description,
        kind: current.kind,
        iconKey: current.iconKey,
        properties: current.properties,
        presentation: current.presentation,
        routing: current.routing,
      },
      `update-edge:${command.edgeId}`,
      nowMs,
    );
  }

  if (command.type === "delete-edge") {
    const current = store
      .getState()
      .edges.find((edge) => edge.id === command.edgeId);
    if (!current) return null;

    return entry(
      command,
      {
        type: "restore-edge",
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        edgeId: command.edgeId,
        edge: current,
      },
      null,
      nowMs,
    );
  }

  return entry(
    command,
    {
      type: "delete-edge",
      boardId: command.boardId,
      workspaceId: command.workspaceId,
      edgeId: command.edgeId,
    },
    null,
    nowMs,
  );
}

function entry(
  forward: UndoableEditorCommand,
  inverse: UndoableEditorCommand,
  coalescingKey: string | null,
  nowMs: number,
): EditorHistoryEntry {
  return {
    forward,
    inverse,
    coalescingKey,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}
