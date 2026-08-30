import {
  useCreateEdgeOnBoardMutation,
  useCreateNodeOnBoardMutation,
  usePlaceNodeOnBoardMutation,
  useRemoveEdgeFromBoardMutation,
  useRemoveNodeFromBoardMutation,
  useRestoreEdgeToBoardMutation,
  useRestoreNodeToBoardMutation,
  useUpdateBoardNodeMutation,
  useUpdateEdgeMutation,
  useUpdateNodeMutation,
  useUpdateNodeStateMutation,
} from "@/frontend/api/graph/graph.queries";

import type { EditorPersistence } from "./editor-persistence";

export function useEditorPersistence(
  workspaceId: string | undefined,
  boardId: string,
) {
  const createNode = useCreateNodeOnBoardMutation();
  const placeNode = usePlaceNodeOnBoardMutation(workspaceId, boardId);
  const createEdge = useCreateEdgeOnBoardMutation();
  const updateNode = useUpdateNodeMutation(workspaceId, boardId);
  const updateNodeState = useUpdateNodeStateMutation(workspaceId, boardId);
  const updateEdge = useUpdateEdgeMutation(workspaceId, boardId);
  const moveNode = useUpdateBoardNodeMutation();
  const removeNode = useRemoveNodeFromBoardMutation(workspaceId, boardId);
  const restoreNode = useRestoreNodeToBoardMutation(workspaceId, boardId);
  const removeEdge = useRemoveEdgeFromBoardMutation(workspaceId, boardId);
  const restoreEdge = useRestoreEdgeToBoardMutation(workspaceId, boardId);

  const persistence: EditorPersistence = {
    createNode: (command) =>
      createNode.mutateAsync({
        boardId: command.boardId,
        workspaceId: command.workspaceId,
        id: command.nodeId,
        name: command.name,
        position: command.position,
      }),
    placeBoardNode: (command) =>
      placeNode.mutateAsync({
        boardId: command.boardId,
        nodeId: command.node.id,
        workspaceId: command.workspaceId,
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
    updateNodeState: (command) =>
      updateNodeState.mutateAsync({
        scopeId: command.scopeId,
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
    restoreBoardNode: (command) =>
      restoreNode.mutateAsync({
        boardId: command.boardId,
        nodeId: command.nodeId,
        workspaceId: command.workspaceId,
        boardNode: command.boardNode,
        boardEdges: command.boardEdges,
      }),
    removeBoardEdge: (command) =>
      removeEdge.mutateAsync({
        boardId: command.boardId,
        edgeId: command.edgeId,
        workspaceId: command.workspaceId,
      }),
    restoreBoardEdge: (command) =>
      restoreEdge.mutateAsync({
        boardId: command.boardId,
        edgeId: command.edgeId,
        workspaceId: command.workspaceId,
        style: command.style,
        labelPresentation: command.labelPresentation,
      }),
  };

  return { persistence };
}
