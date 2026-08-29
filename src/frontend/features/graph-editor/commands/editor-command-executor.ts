import type { GraphEditorStore } from "../store/graph-editor-store";
import type { EditorPersistence } from "../persistence/editor-persistence";
import type {
  CreateEdgeCommand,
  CreateNodeCommand,
  EditorCommand,
} from "./editor-command";

export async function executeEditorCommand(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  command: EditorCommand,
): Promise<void> {
  switch (command.type) {
    case "create-node": {
      store.getState().addOptimisticNode(toOptimisticNodePair(command));
      try {
        const persisted = await persistence.createNode(command);
        store.getState().reconcileNode(persisted);
      } catch (error) {
        store.getState().removeNode(command.nodeId);
        throw error;
      }
      return;
    }
    case "move-node": {
      store.getState().setNodePosition(command.nodeId, command.position);
      const persisted = await persistence.moveNode(command);
      store.getState().replaceBoardNode(persisted);
      return;
    }
    case "create-edge": {
      store.getState().addOptimisticEdge(toOptimisticEdgePair(command));
      try {
        const persisted = await persistence.createEdge(command);
        store.getState().reconcileEdge(persisted);
      } catch (error) {
        store.getState().removeEdge(command.edgeId);
        throw error;
      }
      return;
    }
    case "update-node": {
      const persisted = await persistence.updateNode(command);
      store.getState().replaceNode(persisted);
      return;
    }
    case "update-edge": {
      const persisted = await persistence.updateEdge(command);
      store.getState().replaceEdge(persisted);
      return;
    }
    case "remove-board-node": {
      const detached = store.getState().detachNodeFromBoard(command.nodeId);
      if (!detached.boardNode) return;
      try {
        await persistence.removeBoardNode(command);
      } catch (error) {
        store.getState().restoreNodeToBoard(detached);
        throw error;
      }
      return;
    }
    case "remove-board-edge": {
      const detached = store.getState().detachEdgeFromBoard(command.edgeId);
      if (!detached) return;
      try {
        await persistence.removeBoardEdge(command);
      } catch (error) {
        store.getState().restoreEdgeToBoard(detached);
        throw error;
      }
    }
  }
}

function toOptimisticNodePair(command: CreateNodeCommand) {
  return {
    node: {
      id: command.nodeId,
      storyId: command.storyId,
      name: command.name,
      description: "",
      iconKey: null,
      properties: {},
      version: 1,
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    },
    boardNode: {
      boardId: command.boardId,
      nodeId: command.nodeId,
      x: command.position.x,
      y: command.position.y,
      width: null,
      height: null,
      zIndex: 0,
      style: {},
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    },
  };
}

function toOptimisticEdgePair(command: CreateEdgeCommand) {
  return {
    edge: {
      id: command.edgeId,
      storyId: command.storyId,
      sourceNodeId: command.sourceNodeId,
      targetNodeId: command.targetNodeId,
      name: command.name,
      description: "",
      iconKey: null,
      properties: {},
      version: 1,
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    },
    boardEdge: {
      boardId: command.boardId,
      edgeId: command.edgeId,
      style: {},
      labelPresentation: {},
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    },
  };
}
