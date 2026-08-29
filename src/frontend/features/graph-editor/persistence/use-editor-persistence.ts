import {
  useCreateEdgeOnBoardMutation,
  useCreateNodeOnBoardMutation,
  useRemoveEdgeFromBoardMutation,
  useRemoveNodeFromBoardMutation,
  useUpdateBoardNodeMutation,
  useUpdateEdgeMutation,
  useUpdateNodeMutation,
} from "@/frontend/api/graph/graph.queries";

import type { EditorPersistence } from "./editor-persistence";

export function useEditorPersistence(
  workspaceId: string | undefined,
  boardId: string,
) {
  const createNode = useCreateNodeOnBoardMutation();
  const createEdge = useCreateEdgeOnBoardMutation();
  const updateNode = useUpdateNodeMutation(workspaceId, boardId);
  const updateEdge = useUpdateEdgeMutation(workspaceId, boardId);
  const moveNode = useUpdateBoardNodeMutation();
  const removeNode = useRemoveNodeFromBoardMutation(workspaceId, boardId);
  const removeEdge = useRemoveEdgeFromBoardMutation(workspaceId, boardId);

  const persistence: EditorPersistence = {
    createNode: (command) =>
      createNode.mutateAsync({
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        id: command.nodeId,
        name: command.name,
        position: command.position,
      }),
    moveNode: (command) =>
      moveNode.mutateAsync({
        boardId: command.boardId,
        nodeId: command.nodeId,
        workspaceId: command.workspaceId,
        x: command.position.x,
        y: command.position.y,
      }),
    createEdge: (command) =>
      createEdge.mutateAsync({
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        id: command.edgeId,
        sourceNodeId: command.sourceNodeId,
        targetNodeId: command.targetNodeId,
        name: command.name,
      }),
    updateNode: (command) =>
      updateNode.mutateAsync({
        nodeId: command.nodeId,
        workspaceId: command.workspaceId,
        version: command.version,
        name: command.name,
        description: command.description,
        properties: command.properties,
      }),
    updateEdge: (command) =>
      updateEdge.mutateAsync({
        edgeId: command.edgeId,
        workspaceId: command.workspaceId,
        version: command.version,
        name: command.name,
        description: command.description,
        properties: command.properties,
      }),
    removeBoardNode: (command) =>
      removeNode.mutateAsync({
        boardId: command.boardId,
        nodeId: command.nodeId,
        workspaceId: command.workspaceId,
      }),
    removeBoardEdge: (command) =>
      removeEdge.mutateAsync({
        boardId: command.boardId,
        edgeId: command.edgeId,
        workspaceId: command.workspaceId,
      }),
  };

  return { persistence };
}
