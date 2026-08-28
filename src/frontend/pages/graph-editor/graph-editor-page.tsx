"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardSnapshotQuery,
  useCreateEdgeOnBoardMutation,
  useCreateNodeOnBoardMutation,
  useUpdateBoardNodeMutation,
} from "@/frontend/api/graph/graph.queries";
import {
  GraphEditorStoreProvider,
  useGraphEditorStore,
  useGraphEditorStoreApi,
} from "@/frontend/features/graph-editor/store/graph-editor-store-provider";
import {
  GraphCanvas,
  type GraphCanvasHandle,
} from "@/frontend/widgets/graph-editor/graph-canvas";

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
  const [relationshipError, setRelationshipError] = useState<string | null>(null);
  const [isNodeFormOpen, setNodeFormOpen] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [pendingConnection, setPendingConnection] = useState<{
    sourceNodeId: string;
    targetNodeId: string;
  } | null>(null);
  const [relationshipName, setRelationshipName] = useState("");
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const snapshot = useBoardSnapshotQuery(workspaceId, boardId);
  const createNode = useCreateNodeOnBoardMutation();
  const createEdge = useCreateEdgeOnBoardMutation();
  const updatePlacement = useUpdateBoardNodeMutation();
  const store = useGraphEditorStoreApi();
  const state = useGraphEditorStore((current) => current);

  useEffect(() => {
    if (snapshot.data) {
      store.getState().hydrate(snapshot.data);
    }
  }, [snapshot.data, store]);

  async function handleCreateNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !snapshot.data) return;

    const name = nodeName.trim();
    if (!name) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const position = canvasRef.current?.getCenterPosition() ?? { x: 0, y: 0 };
    const optimistic = {
      node: {
        id,
        storyId: snapshot.data.story.id,
        name,
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
        name,
        position,
      });
      store.getState().reconcileNode(persisted);
      setNodeName("");
      setNodeFormOpen(false);
    } catch {
      store.getState().removeNode(id);
      setCreateError("Unable to create Node.");
    }
  }

  function handleConnectNodes(sourceNodeId: string, targetNodeId: string) {
    setPendingConnection({ sourceNodeId, targetNodeId });
    setRelationshipName("");
    setRelationshipError(null);
  }

  async function handleCreateRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !snapshot.data || !pendingConnection) return;

    const name = relationshipName.trim();
    if (!name) return;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const optimistic = {
      edge: {
        id,
        storyId: snapshot.data.story.id,
        sourceNodeId: pendingConnection.sourceNodeId,
        targetNodeId: pendingConnection.targetNodeId,
        name,
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      boardEdge: {
        boardId,
        edgeId: id,
        style: {},
        labelPresentation: {},
        createdAt: now,
        updatedAt: now,
      },
    };

    setRelationshipError(null);
    store.getState().addOptimisticEdge(optimistic);
    try {
      const persisted = await createEdge.mutateAsync({
        boardId,
        workspaceId,
        id,
        sourceNodeId: pendingConnection.sourceNodeId,
        targetNodeId: pendingConnection.targetNodeId,
        name,
      });
      store.getState().reconcileEdge(persisted);
      setRelationshipName("");
      setPendingConnection(null);
    } catch {
      store.getState().removeEdge(id);
      setRelationshipError("Unable to create Relationship.");
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
    name: edge.name,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
  }));

  return (
    <main className="grid min-h-screen grid-rows-[auto_auto_1fr] gap-4 p-6">
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
          onClick={() => {
            setCreateError(null);
            setNodeFormOpen(true);
          }}
          type="button"
        >
          + Node
        </button>
      </header>

      <div className="grid gap-2">
        {isNodeFormOpen ? (
          <form
            className="flex max-w-md gap-2 rounded-lg border border-neutral-200 bg-white p-3"
            onSubmit={handleCreateNode}
          >
            <label className="sr-only" htmlFor="node-name">
              Node name
            </label>
            <input
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2"
              id="node-name"
              onChange={(event) => setNodeName(event.target.value)}
              placeholder="Node name"
              value={nodeName}
            />
            <button
              className="rounded-md bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50"
              disabled={createNode.isPending || !nodeName.trim()}
              type="submit"
            >
              {createNode.isPending ? "Creating..." : "Create Node"}
            </button>
            <button
              className="rounded-md border border-neutral-300 px-3 py-2"
              disabled={createNode.isPending}
              onClick={() => {
                setNodeName("");
                setNodeFormOpen(false);
                setCreateError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </form>
        ) : null}
        {pendingConnection ? (
          <form
            className="flex max-w-md gap-2 rounded-lg border border-neutral-200 bg-white p-3"
            onSubmit={handleCreateRelationship}
          >
            <label className="sr-only" htmlFor="relationship-name">
              Relationship name
            </label>
            <input
              autoFocus
              className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2"
              id="relationship-name"
              onChange={(event) => setRelationshipName(event.target.value)}
              placeholder="Relationship name"
              value={relationshipName}
            />
            <button
              className="rounded-md bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50"
              disabled={createEdge.isPending || !relationshipName.trim()}
              type="submit"
            >
              {createEdge.isPending ? "Creating..." : "Create Relationship"}
            </button>
          </form>
        ) : null}
        {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
        {relationshipError ? (
          <p className="text-sm text-red-600">{relationshipError}</p>
        ) : null}
        {positionError ? (
          <p className="text-sm text-red-600">{positionError}</p>
        ) : null}
      </div>

      <GraphCanvas
        edges={canvasEdges}
        nodes={canvasNodes}
        onConnectNodes={handleConnectNodes}
        onNodeDragStop={handleNodeDragStop}
        onNodePositionChange={handleNodePositionChange}
        ref={canvasRef}
      />
    </main>
  );
}
