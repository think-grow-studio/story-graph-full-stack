import type { EditorPersistence } from "../persistence/editor-persistence";
import type { GraphEditorStore } from "../store/graph-editor-store";
import type {
  CreateEdgeCommand,
  CreateNodeCommand,
  EditorCommand,
  PlaceBoardNodeCommand,
} from "./editor-command";

export function applyEditorCommand(
  store: GraphEditorStore,
  command: EditorCommand,
): boolean {
  switch (command.type) {
    case "create-node":
      store.getState().addOptimisticNode(toOptimisticNodePair(command));
      return true;
    case "place-board-node": {
      const state = store.getState();
      if (state.boardNodes.some((boardNode) => boardNode.nodeId === command.node.id)) {
        return false;
      }
      state.addOptimisticNode(toPlacedNodePair(command));
      return true;
    }
    case "move-node":
      store.getState().setNodePosition(command.nodeId, command.position);
      return true;
    case "create-edge":
      store.getState().addOptimisticEdge(toOptimisticEdgePair(command));
      return true;
    case "update-node": {
      const current = store
        .getState()
        .nodes.find((node) => node.id === command.nodeId);
      if (!current) return false;
      store.getState().replaceNode({
        ...current,
        name: command.name,
        description: command.description,
        properties: command.properties,
      });
      return true;
    }
    case "update-edge": {
      const current = store
        .getState()
        .edges.find((edge) => edge.id === command.edgeId);
      if (!current) return false;
      store.getState().replaceEdge({
        ...current,
        name: command.name,
        description: command.description,
        properties: command.properties,
      });
      return true;
    }
    case "remove-board-node":
      return store.getState().detachNodeFromBoard(command.nodeId).boardNode !== null;
    case "restore-board-node": {
      const state = store.getState();
      const node = state.nodes.find((candidate) => candidate.id === command.nodeId);
      if (!node) return false;

      const representedNodeIds = new Set(
        state.boardNodes.map((boardNode) => boardNode.nodeId),
      );
      for (const boardEdge of command.boardEdges) {
        const edge = state.edges.find((candidate) => candidate.id === boardEdge.edgeId);
        if (!edge) return false;
        if (
          edge.sourceNodeId !== command.nodeId &&
          edge.targetNodeId !== command.nodeId
        ) {
          return false;
        }
        if (
          edge.sourceNodeId !== command.nodeId &&
          !representedNodeIds.has(edge.sourceNodeId)
        ) {
          return false;
        }
        if (
          edge.targetNodeId !== command.nodeId &&
          !representedNodeIds.has(edge.targetNodeId)
        ) {
          return false;
        }
      }

      state.restoreNodeToBoard({
        boardNode: command.boardNode,
        boardEdges: command.boardEdges,
      });
      return true;
    }
    case "remove-board-edge":
      return store.getState().detachEdgeFromBoard(command.edgeId) !== null;
    case "restore-board-edge": {
      const state = store.getState();
      const edge = state.edges.find((candidate) => candidate.id === command.edgeId);
      if (!edge) return false;
      const representedNodeIds = new Set(
        state.boardNodes.map((boardNode) => boardNode.nodeId),
      );
      if (
        !representedNodeIds.has(edge.sourceNodeId) ||
        !representedNodeIds.has(edge.targetNodeId)
      ) {
        return false;
      }
      state.restoreEdgeToBoard({
        boardId: command.boardId,
        edgeId: command.edgeId,
        style: command.style,
        labelPresentation: command.labelPresentation,
        createdAt: command.createdAt,
        updatedAt: command.updatedAt,
      });
      return true;
    }
  }
}

export async function persistAndReconcileEditorCommand(
  store: GraphEditorStore,
  persistence: EditorPersistence,
  command: EditorCommand,
): Promise<void> {
  const prepared = prepareEditorCommandForPersistence(store, command);

  switch (prepared.type) {
    case "create-node": {
      const persisted = await persistence.createNode(prepared);
      const currentNode = store
        .getState()
        .nodes.find((node) => node.id === prepared.nodeId);
      const currentBoardNode = store
        .getState()
        .boardNodes.find((node) => node.nodeId === prepared.nodeId);

      store.getState().replaceNode(
        currentNode
          ? {
              ...persisted.node,
              name: currentNode.name,
              description: currentNode.description,
              iconKey: currentNode.iconKey,
              properties: currentNode.properties,
            }
          : persisted.node,
      );

      if (currentBoardNode) {
        store.getState().replaceBoardNode({
          ...persisted.boardNode,
          x: currentBoardNode.x,
          y: currentBoardNode.y,
          width: currentBoardNode.width,
          height: currentBoardNode.height,
          zIndex: currentBoardNode.zIndex,
          style: currentBoardNode.style,
        });
      }
      return;
    }
    case "place-board-node": {
      const persisted = await persistence.placeBoardNode(prepared);
      const currentNode = store
        .getState()
        .nodes.find((node) => node.id === prepared.node.id);
      const currentBoardNode = store
        .getState()
        .boardNodes.find((node) => node.nodeId === prepared.node.id);

      store.getState().replaceNode(
        currentNode
          ? {
              ...persisted.node,
              name: currentNode.name,
              description: currentNode.description,
              iconKey: currentNode.iconKey,
              properties: currentNode.properties,
            }
          : persisted.node,
      );

      if (currentBoardNode) {
        store.getState().replaceBoardNode({
          ...persisted.boardNode,
          x: currentBoardNode.x,
          y: currentBoardNode.y,
          width: currentBoardNode.width,
          height: currentBoardNode.height,
          zIndex: currentBoardNode.zIndex,
          style: currentBoardNode.style,
        });
      }
      return;
    }
    case "move-node": {
      const persisted = await persistence.moveNode(prepared);
      const current = store
        .getState()
        .boardNodes.find((node) => node.nodeId === prepared.nodeId);
      if (!current) return;

      store.getState().replaceBoardNode({
        ...persisted,
        x: current.x,
        y: current.y,
        width: current.width,
        height: current.height,
        zIndex: current.zIndex,
        style: current.style,
      });
      return;
    }
    case "create-edge": {
      const persisted = await persistence.createEdge(prepared);
      const currentEdge = store
        .getState()
        .edges.find((edge) => edge.id === prepared.edgeId);
      const currentBoardEdge = store
        .getState()
        .boardEdges.find((edge) => edge.edgeId === prepared.edgeId);

      store.getState().replaceEdge(
        currentEdge
          ? {
              ...persisted.edge,
              name: currentEdge.name,
              description: currentEdge.description,
              iconKey: currentEdge.iconKey,
              properties: currentEdge.properties,
            }
          : persisted.edge,
      );

      if (currentBoardEdge) {
        store.getState().restoreEdgeToBoard({
          ...persisted.boardEdge,
          style: currentBoardEdge.style,
          labelPresentation: currentBoardEdge.labelPresentation,
        });
      }
      return;
    }
    case "update-node": {
      const persisted = await persistence.updateNode(prepared);
      const current = store
        .getState()
        .nodes.find((node) => node.id === prepared.nodeId);
      store.getState().replaceNode(
        current
          ? {
              ...persisted,
              name: current.name,
              description: current.description,
              iconKey: current.iconKey,
              properties: current.properties,
            }
          : persisted,
      );
      return;
    }
    case "update-edge": {
      const persisted = await persistence.updateEdge(prepared);
      const current = store
        .getState()
        .edges.find((edge) => edge.id === prepared.edgeId);
      store.getState().replaceEdge(
        current
          ? {
              ...persisted,
              name: current.name,
              description: current.description,
              iconKey: current.iconKey,
              properties: current.properties,
            }
          : persisted,
      );
      return;
    }
    case "remove-board-node":
      await persistence.removeBoardNode(prepared);
      return;
    case "restore-board-node": {
      const persisted = await persistence.restoreBoardNode(prepared);
      const state = store.getState();
      const currentBoardNode = state.boardNodes.find(
        (boardNode) => boardNode.nodeId === prepared.nodeId,
      );
      if (!currentBoardNode) return;

      const currentBoardEdges = new Map(
        state.boardEdges.map((boardEdge) => [boardEdge.edgeId, boardEdge]),
      );
      store.getState().restoreNodeToBoard({
        boardNode: {
          ...persisted.boardNode,
          x: currentBoardNode.x,
          y: currentBoardNode.y,
          width: currentBoardNode.width,
          height: currentBoardNode.height,
          zIndex: currentBoardNode.zIndex,
          style: currentBoardNode.style,
        },
        boardEdges: persisted.boardEdges.flatMap((boardEdge) => {
          const current = currentBoardEdges.get(boardEdge.edgeId);
          return current
            ? [
                {
                  ...boardEdge,
                  style: current.style,
                  labelPresentation: current.labelPresentation,
                },
              ]
            : [];
        }),
      });
      return;
    }
    case "remove-board-edge":
      await persistence.removeBoardEdge(prepared);
      return;
    case "restore-board-edge": {
      const persisted = await persistence.restoreBoardEdge(prepared);
      const current = store
        .getState()
        .boardEdges.find((boardEdge) => boardEdge.edgeId === prepared.edgeId);
      if (!current) return;

      store.getState().restoreEdgeToBoard({
        ...persisted.boardEdge,
        style: current.style,
        labelPresentation: current.labelPresentation,
      });
      return;
    }
  }
}

function prepareEditorCommandForPersistence(
  store: GraphEditorStore,
  command: EditorCommand,
): EditorCommand {
  if (command.type === "update-node") {
    const current = store
      .getState()
      .nodes.find((node) => node.id === command.nodeId);
    return current ? { ...command, version: current.version } : command;
  }
  if (command.type === "update-edge") {
    const current = store
      .getState()
      .edges.find((edge) => edge.id === command.edgeId);
    return current ? { ...command, version: current.version } : command;
  }
  return command;
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

function toPlacedNodePair(command: PlaceBoardNodeCommand) {
  return {
    node: command.node,
    boardNode: {
      boardId: command.boardId,
      nodeId: command.node.id,
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
