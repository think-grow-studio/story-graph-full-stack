import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import {
  useCreateEdgeMutation,
  useCreateNodeMutation,
  useDeleteEdgeMutation,
  useDeleteNodeMutation,
  useRestoreEdgeMutation,
  useRestoreNodeMutation,
  useUpdateEdgeMutation,
  useUpdateNodeMutation,
} from "@/frontend/api/graph/graph.queries";

import type { EditorPersistence } from "./editor-persistence";

export function useEditorPersistence(
  workspaceId: string | undefined,
  boardId: string,
) {
  const createNode = useCreateNodeMutation(workspaceId, boardId);
  const updateNode = useUpdateNodeMutation(workspaceId, boardId);
  const deleteNode = useDeleteNodeMutation(workspaceId, boardId);
  const restoreNode = useRestoreNodeMutation(workspaceId, boardId);
  const createEdge = useCreateEdgeMutation(workspaceId, boardId);
  const updateEdge = useUpdateEdgeMutation(workspaceId, boardId);
  const deleteEdge = useDeleteEdgeMutation(workspaceId, boardId);
  const restoreEdge = useRestoreEdgeMutation(workspaceId, boardId);

  const persistence: EditorPersistence = {
    createNode: (command) =>
      createNode.mutateAsync({
        id: command.nodeId,
        name: command.name,
        x: command.position.x,
        y: command.position.y,
      }),
    moveNode: (command) =>
      updateNode.mutateAsync({
        nodeId: command.nodeId,
        expectedVersion: command.expectedVersion,
        x: command.position.x,
        y: command.position.y,
      }),
    updateNode: (command) =>
      updateNode.mutateAsync({
        nodeId: command.nodeId,
        expectedVersion: command.expectedVersion,
        name: command.name,
        description: command.description,
        properties: command.properties,
      }),
    deleteNode: (command) =>
      deleteNode.mutateAsync({
        nodeId: command.nodeId,
      }),
    restoreNode: (command) =>
      restoreNode.mutateAsync({
        nodeId: command.nodeId,
        node: toRestorableNode(command.node),
        edges: command.edges.map(toRestorableEdge),
      }),
    createEdge: (command) =>
      createEdge.mutateAsync({
        id: command.edgeId,
        sourceNodeId: command.sourceNodeId,
        targetNodeId: command.targetNodeId,
        name: command.name,
      }),
    updateEdge: (command) =>
      updateEdge.mutateAsync({
        edgeId: command.edgeId,
        expectedVersion: command.expectedVersion,
        name: command.name,
        description: command.description,
        properties: command.properties,
      }),
    deleteEdge: (command) =>
      deleteEdge.mutateAsync({
        edgeId: command.edgeId,
      }),
    restoreEdge: (command) =>
      restoreEdge.mutateAsync({
        edgeId: command.edgeId,
        edge: toRestorableEdge(command.edge),
      }),
  };

  return { persistence };
}

function toRestorableNode(node: GraphNodeResponse) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...restorable } = node;
  return restorable;
}

function toRestorableEdge(edge: GraphEdgeResponse) {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...restorable } = edge;
  return restorable;
}
