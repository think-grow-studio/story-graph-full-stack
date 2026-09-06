import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import type { EditorPersistence } from "../persistence/editor-persistence";
import type { GraphEditorStore } from "../store/graph-editor-store";
import type {
  CreateEdgeCommand,
  CreateNodeCommand,
  EditorCommand,
} from "./editor-command";

export function applyEditorCommand(
  store: GraphEditorStore,
  command: EditorCommand,
): boolean {
  switch (command.type) {
    case "create-node":
      store.getState().addOptimisticNode(toOptimisticNode(command));
      return true;
    case "move-node": {
      if (!findNode(store, command.nodeId)) return false;
      store.getState().setNodePosition(command.nodeId, command.position);
      return true;
    }
    case "update-node": {
      const current = findNode(store, command.nodeId);
      if (!current) return false;
      store.getState().replaceNode({
        ...current,
        name: command.name,
        description: command.description,
        properties: command.properties,
      });
      return true;
    }
    case "delete-node":
      return store.getState().deleteNode(command.nodeId) !== null;
    case "restore-node":
      return applyRestoreNode(store, command);
    case "create-edge": {
      const state = store.getState();
      if (
        !state.nodes.some((node) => node.id === command.sourceNodeId) ||
        !state.nodes.some((node) => node.id === command.targetNodeId)
      ) {
        return false;
      }
      state.addOptimisticEdge(toOptimisticEdge(command));
      return true;
    }
    case "update-edge": {
      const current = findEdge(store, command.edgeId);
      if (!current) return false;
      store.getState().replaceEdge({
        ...current,
        name: command.name,
        description: command.description,
        properties: command.properties,
      });
      return true;
    }
    case "delete-edge":
      return store.getState().deleteEdge(command.edgeId) !== null;
    case "restore-edge": {
      if (
        command.edgeId !== command.edge.id ||
        command.edge.boardId !== command.boardId
      ) {
        return false;
      }
      const state = store.getState();
      if (
        !state.nodes.some((node) => node.id === command.edge.sourceNodeId) ||
        !state.nodes.some((node) => node.id === command.edge.targetNodeId)
      ) {
        return false;
      }
      state.restoreEdge(command.edge);
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
      reconcileNodeIfPresent(store, prepared.nodeId, persisted);
      return;
    }
    case "move-node": {
      const persisted = await persistence.moveNode(prepared);
      reconcileNodeIfPresent(store, prepared.nodeId, persisted);
      return;
    }
    case "update-node": {
      const persisted = await persistence.updateNode(prepared);
      reconcileNodeIfPresent(store, prepared.nodeId, persisted);
      return;
    }
    case "delete-node":
      await persistence.deleteNode(prepared);
      return;
    case "restore-node": {
      const persisted = await persistence.restoreNode(prepared);
      const currentNode = findNode(store, prepared.nodeId);
      if (!currentNode) return;

      store.getState().replaceNode(mergePersistedNode(persisted.node, currentNode));
      for (const persistedEdge of persisted.edges) {
        const currentEdge = findEdge(store, persistedEdge.id);
        if (!currentEdge) continue;
        store.getState().replaceEdge(mergePersistedEdge(persistedEdge, currentEdge));
      }
      return;
    }
    case "create-edge": {
      const persisted = await persistence.createEdge(prepared);
      reconcileEdgeIfPresent(store, prepared.edgeId, persisted);
      return;
    }
    case "update-edge": {
      const persisted = await persistence.updateEdge(prepared);
      reconcileEdgeIfPresent(store, prepared.edgeId, persisted);
      return;
    }
    case "delete-edge":
      await persistence.deleteEdge(prepared);
      return;
    case "restore-edge": {
      const persisted = await persistence.restoreEdge(prepared);
      reconcileEdgeIfPresent(store, prepared.edgeId, persisted);
      return;
    }
  }
}

export function prepareEditorCommandForPersistence(
  store: GraphEditorStore,
  command: EditorCommand,
): EditorCommand {
  if (command.type === "move-node" || command.type === "update-node") {
    const current = findNode(store, command.nodeId);
    return current
      ? { ...command, expectedVersion: current.version }
      : command;
  }
  if (command.type === "update-edge") {
    const current = findEdge(store, command.edgeId);
    return current
      ? { ...command, expectedVersion: current.version }
      : command;
  }
  return command;
}

function applyRestoreNode(
  store: GraphEditorStore,
  command: Extract<EditorCommand, { type: "restore-node" }>,
): boolean {
  if (
    command.nodeId !== command.node.id ||
    command.node.boardId !== command.boardId
  ) {
    return false;
  }

  const representedNodeIds = new Set(store.getState().nodes.map((node) => node.id));
  representedNodeIds.add(command.nodeId);

  for (const edge of command.edges) {
    if (edge.boardId !== command.boardId) return false;
    if (edge.sourceNodeId !== command.nodeId && edge.targetNodeId !== command.nodeId) {
      return false;
    }
    if (
      !representedNodeIds.has(edge.sourceNodeId) ||
      !representedNodeIds.has(edge.targetNodeId)
    ) {
      return false;
    }
  }

  store.getState().restoreNode({ node: command.node, edges: command.edges });
  return true;
}

function toOptimisticNode(command: CreateNodeCommand): GraphNodeResponse {
  return {
    id: command.nodeId,
    boardId: command.boardId,
    name: command.name,
    description: "",
    iconKey: null,
    properties: {},
    x: command.position.x,
    y: command.position.y,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 1,
    createdAt: command.createdAt,
    updatedAt: command.createdAt,
  };
}

function toOptimisticEdge(command: CreateEdgeCommand): GraphEdgeResponse {
  return {
    id: command.edgeId,
    boardId: command.boardId,
    sourceNodeId: command.sourceNodeId,
    targetNodeId: command.targetNodeId,
    name: command.name,
    description: "",
    iconKey: null,
    properties: {},
    style: {},
    labelPresentation: {},
    version: 1,
    createdAt: command.createdAt,
    updatedAt: command.createdAt,
  };
}

function findNode(store: GraphEditorStore, nodeId: string) {
  return store.getState().nodes.find((node) => node.id === nodeId);
}

function findEdge(store: GraphEditorStore, edgeId: string) {
  return store.getState().edges.find((edge) => edge.id === edgeId);
}

function reconcileNodeIfPresent(
  store: GraphEditorStore,
  nodeId: string,
  persisted: GraphNodeResponse,
) {
  const current = findNode(store, nodeId);
  if (!current) return;
  store.getState().replaceNode(mergePersistedNode(persisted, current));
}

function reconcileEdgeIfPresent(
  store: GraphEditorStore,
  edgeId: string,
  persisted: GraphEdgeResponse,
) {
  const current = findEdge(store, edgeId);
  if (!current) return;
  store.getState().replaceEdge(mergePersistedEdge(persisted, current));
}

function mergePersistedNode(
  persisted: GraphNodeResponse,
  current: GraphNodeResponse,
): GraphNodeResponse {
  return {
    ...persisted,
    name: current.name,
    description: current.description,
    iconKey: current.iconKey,
    properties: current.properties,
    x: current.x,
    y: current.y,
    width: current.width,
    height: current.height,
    zIndex: current.zIndex,
    style: current.style,
  };
}

function mergePersistedEdge(
  persisted: GraphEdgeResponse,
  current: GraphEdgeResponse,
): GraphEdgeResponse {
  return {
    ...persisted,
    name: current.name,
    description: current.description,
    iconKey: current.iconKey,
    properties: current.properties,
    style: current.style,
    labelPresentation: current.labelPresentation,
  };
}