import type {
  EditorCommand,
  MoveNodeCommand,
  RemoveBoardEdgeCommand,
  RestoreBoardEdgeCommand,
  UpdateEdgeCommand,
  UpdateNodeCommand,
} from "../commands/editor-command";
import type { GraphEditorStore } from "../store/graph-editor-store";

export type UndoableEditorCommand =
  | MoveNodeCommand
  | UpdateNodeCommand
  | UpdateEdgeCommand
  | RemoveBoardEdgeCommand
  | RestoreBoardEdgeCommand;

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
    command.type === "update-edge" ||
    command.type === "remove-board-edge" ||
    command.type === "restore-board-edge"
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
        version: current.version,
        name: current.name,
        description: current.description,
        properties: current.properties,
      },
      `update-node:${command.nodeId}`,
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
        version: current.version,
        name: current.name,
        description: current.description,
        properties: current.properties,
      },
      `update-edge:${command.edgeId}`,
      nowMs,
    );
  }

  if (command.type === "remove-board-edge") {
    const state = store.getState();
    const currentBoardEdge = state.boardEdges.find(
      (boardEdge) => boardEdge.edgeId === command.edgeId,
    );
    const currentEdge = state.edges.find((edge) => edge.id === command.edgeId);
    if (!currentBoardEdge || !currentEdge) return null;

    const representedNodeIds = new Set(
      state.boardNodes.map((boardNode) => boardNode.nodeId),
    );
    if (
      !representedNodeIds.has(currentEdge.sourceNodeId) ||
      !representedNodeIds.has(currentEdge.targetNodeId)
    ) {
      return null;
    }

    return entry(
      command,
      {
        type: "restore-board-edge",
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        edgeId: command.edgeId,
        style: currentBoardEdge.style,
        labelPresentation: currentBoardEdge.labelPresentation,
        createdAt: currentBoardEdge.createdAt,
        updatedAt: currentBoardEdge.updatedAt,
      },
      null,
      nowMs,
    );
  }

  return entry(
    command,
    {
      type: "remove-board-edge",
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
