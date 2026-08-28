"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardSnapshotQuery,
  useCreateNodeOnBoardMutation,
  useUpdateBoardNodeMutation,
} from "@/frontend/api/graph/graph.queries";
import {
  GraphEditorStoreProvider,
  useGraphEditorStore,
  useGraphEditorStoreApi,
} from "@/frontend/features/graph-editor/store/graph-editor-store-provider";
import { GraphCanvas } from "@/frontend/widgets/graph-editor/graph-canvas";

export function GraphEditorPage({
  storyId,
  boardId,
}: {
  storyId: string;
  boardId: string;
}) {
  return (
    <GraphEditorStoreProvider>
      <GraphEditorContent storyId={storyId} boardId={boardId} />
    </GraphEditorStoreProvider>
  );
}

function GraphEditorContent({
  storyId,
  boardId,
}: {
  storyId: string;
  boardId: string;
}) {
  const [createError, setCreateError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const snapshot = useBoardSnapshotQuery(workspaceId, boardId);
  const createNode = useCreateNodeOnBoardMutation();
  const updatePlacement = useUpdateBoardNodeMutation();
  const store = useGraphEditorStoreApi();
  const state = useGraphEditorStore((current) => current);

  useEffect(() => {
    if (snapshot.data) {
      store.getState().hydrate(snapshot.data);
    }
  }, [snapshot.data, store]);

  async function handleCreateNode() {
    if (!workspaceId || !snapshot.data) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const position = { x: 40, y: 40 };
    const optimistic = {
      node: {
        id,
        storyId: snapshot.data.story.id,
        name: "New Node",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      boardNode: {
        boardId,
        nodeId: id,
        x: position.x,
        y: position.y,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    };

    setCreateError(null);
    store.getState().addOptimisticNode(optimistic);

    try {
      const persisted = await createNode.mutateAsync({
        boardId,
        workspaceId,
        id,
        name: "New Node",
        position,
      });
      store.getState().reconcileNode(persisted);
    } catch {
      store.getState().removeNode(id);
      setCreateError("Unable to create Node.");
    }
  }

  function handleNodePositionChange(
    nodeId: string,
    position: { x: number; y: number },
  ) {
    setPositionError(null);
    store.getState().setNodePosition(nodeId, position);
  }

  async function handleNodeDragStop(nodeId: string) {
    if (!workspaceId) return;
    const boardNode = store
      .getState()
      .boardNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!boardNode) return;

    setPositionError(null);
    try {
      const persisted = await updatePlacement.mutateAsync({
        boardId,
        nodeId,
        workspaceId,
        x: boardNode.x,
        y: boardNode.y,
      });
      store.getState().replaceBoardNode(persisted);
    } catch {
      setPositionError("Unable to save Node position.");
    }
  }

  if (bootstrap.isPending || snapshot.isPending) {
    return <main className="p-8">Loading Board...</main>;
  }

  if (bootstrap.isError || snapshot.isError || !snapshot.data) {
    return <main className="p-8">Unable to load Board.</main>;
  }

  const placementByNodeId = new Map(
    state.boardNodes.map((boardNode) => [boardNode.nodeId, boardNode]),
  );
  const canvasNodes = state.nodes.flatMap((node) => {
    const placement = placementByNodeId.get(node.id);
    if (!placement) return [];
    return [
      {
        id: node.id,
        name: node.name,
        position: { x: placement.x, y: placement.y },
      },
    ];
  });
  const canvasEdges = state.edges.map((edge) => ({
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
  }));

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            className="text-sm text-neutral-500"
            href={`/stories/${storyId}`}
          >
            ← Boards
          </Link>
          <h1 className="text-2xl font-semibold">{snapshot.data.board.name}</h1>
          <p className="text-sm text-neutral-500">{snapshot.data.story.name}</p>
        </div>
        <button
          className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={createNode.isPending}
          onClick={handleCreateNode}
          type="button"
        >
          + Node
        </button>
      </header>

      {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
      {positionError ? (
        <p className="text-sm text-red-600">{positionError}</p>
      ) : null}

      <GraphCanvas
        edges={canvasEdges}
        nodes={canvasNodes}
        onNodeDragStop={handleNodeDragStop}
        onNodePositionChange={handleNodePositionChange}
      />
    </main>
  );
}
