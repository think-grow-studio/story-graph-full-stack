"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import { useBoardSnapshotQuery } from "@/frontend/api/graph/graph.queries";
import { executeEditorCommand } from "@/frontend/features/graph-editor/commands/editor-command-executor";
import {
  GraphInspector,
  type GraphInspectorSaveInput,
  type GraphInspectorSelection,
} from "@/frontend/features/graph-editor/inspector/graph-inspector";
import { useEditorPersistence } from "@/frontend/features/graph-editor/persistence/use-editor-persistence";
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

type SelectedGraphEntity =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string };

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
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SelectedGraphEntity | null>(null);
  const [isNodeFormOpen, setNodeFormOpen] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [pendingConnection, setPendingConnection] = useState<{
    sourceNodeId: string;
    targetNodeId: string;
  } | null>(null);
  const [relationshipName, setRelationshipName] = useState("");
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const hydratedBoardIdRef = useRef<string | null>(null);
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const snapshot = useBoardSnapshotQuery(workspaceId, boardId);
  const { persistence, pending } = useEditorPersistence(workspaceId, boardId);
  const store = useGraphEditorStoreApi();
  const state = useGraphEditorStore((current) => current);

  useEffect(() => {
    if (!snapshot.data || snapshot.data.board.id !== boardId) return;
    if (hydratedBoardIdRef.current === boardId) return;

    store.getState().hydrate(snapshot.data);
    hydratedBoardIdRef.current = boardId;
  }, [boardId, snapshot.data, store]);

  async function handleCreateNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !snapshot.data) return;

    const name = nodeName.trim();
    if (!name) return;

    const position = canvasRef.current?.getCenterPosition() ?? { x: 0, y: 0 };
    setCreateError(null);

    try {
      await executeEditorCommand(store, persistence, {
        type: "create-node",
        boardId,
        workspaceId,
        storyId: snapshot.data.story.id,
        nodeId: crypto.randomUUID(),
        name,
        position,
        createdAt: new Date().toISOString(),
      });
      setNodeName("");
      setNodeFormOpen(false);
    } catch {
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

    setRelationshipError(null);
    try {
      await executeEditorCommand(store, persistence, {
        type: "create-edge",
        boardId,
        workspaceId,
        storyId: snapshot.data.story.id,
        edgeId: crypto.randomUUID(),
        sourceNodeId: pendingConnection.sourceNodeId,
        targetNodeId: pendingConnection.targetNodeId,
        name,
        createdAt: new Date().toISOString(),
      });
      setRelationshipName("");
      setPendingConnection(null);
    } catch {
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
      await executeEditorCommand(store, persistence, {
        type: "move-node",
        boardId,
        nodeId,
        workspaceId,
        position: { x: boardNode.x, y: boardNode.y },
      });
    } catch {
      setPositionError("Unable to save Node position.");
    }
  }

  async function handleSaveInspector(input: GraphInspectorSaveInput) {
    if (!workspaceId || !selectedEntity) return;
    setInspectorError(null);

    if (selectedEntity.kind === "node") {
      const node = store
        .getState()
        .nodes.find((candidate) => candidate.id === selectedEntity.id);
      if (!node) return;

      try {
        await executeEditorCommand(store, persistence, {
          type: "update-node",
          boardId,
          nodeId: node.id,
          workspaceId,
          version: node.version,
          ...input,
        });
      } catch (error) {
        setInspectorError(
          isAxiosError(error) && error.response?.status === 409
            ? "This Node changed elsewhere. Reload before saving again."
            : "Unable to save Node.",
        );
      }
      return;
    }

    const edge = store
      .getState()
      .edges.find((candidate) => candidate.id === selectedEntity.id);
    if (!edge) return;

    try {
      await executeEditorCommand(store, persistence, {
        type: "update-edge",
        boardId,
        edgeId: edge.id,
        workspaceId,
        version: edge.version,
        ...input,
      });
    } catch (error) {
      setInspectorError(
        isAxiosError(error) && error.response?.status === 409
          ? "This Relationship changed elsewhere. Reload before saving again."
          : "Unable to save Relationship.",
      );
    }
  }

  async function handleRemoveFromBoard() {
    if (!workspaceId || !selectedEntity) return;
    setInspectorError(null);

    if (selectedEntity.kind === "node") {
      const isRepresented = store
        .getState()
        .boardNodes.some((candidate) => candidate.nodeId === selectedEntity.id);
      if (!isRepresented) return;

      try {
        await executeEditorCommand(store, persistence, {
          type: "remove-board-node",
          boardId,
          nodeId: selectedEntity.id,
          workspaceId,
        });
        setSelectedEntity(null);
      } catch {
        setInspectorError("Unable to remove Node from Board.");
      }
      return;
    }

    const isRepresented = store
      .getState()
      .boardEdges.some((candidate) => candidate.edgeId === selectedEntity.id);
    if (!isRepresented) return;

    try {
      await executeEditorCommand(store, persistence, {
        type: "remove-board-edge",
        boardId,
        edgeId: selectedEntity.id,
        workspaceId,
      });
      setSelectedEntity(null);
    } catch {
      setInspectorError("Unable to remove Relationship from Board.");
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
  const representedEdgeIds = new Set(
    state.boardEdges.map((boardEdge) => boardEdge.edgeId),
  );
  const canvasEdges = state.edges
    .filter((edge) => representedEdgeIds.has(edge.id))
    .map((edge) => ({
      id: edge.id,
      name: edge.name,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
    }));

  let inspectorSelection: GraphInspectorSelection | null = null;
  if (selectedEntity?.kind === "node") {
    const node = state.nodes.find((candidate) => candidate.id === selectedEntity.id);
    if (node) inspectorSelection = { kind: "node", entity: node };
  } else if (selectedEntity?.kind === "edge") {
    const edge = state.edges.find((candidate) => candidate.id === selectedEntity.id);
    if (edge) inspectorSelection = { kind: "edge", entity: edge };
  }

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
          disabled={pending.createNode}
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
              disabled={pending.createNode || !nodeName.trim()}
              type="submit"
            >
              {pending.createNode ? "Creating..." : "Create Node"}
            </button>
            <button
              className="rounded-md border border-neutral-300 px-3 py-2"
              disabled={pending.createNode}
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
              disabled={pending.createEdge || !relationshipName.trim()}
              type="submit"
            >
              {pending.createEdge ? "Creating..." : "Create Relationship"}
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

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <GraphCanvas
          edges={canvasEdges}
          nodes={canvasNodes}
          onConnectNodes={handleConnectNodes}
          onNodeDragStop={handleNodeDragStop}
          onNodePositionChange={handleNodePositionChange}
          onSelectEdge={(edgeId) => {
            setInspectorError(null);
            setSelectedEntity({ kind: "edge", id: edgeId });
          }}
          onSelectNode={(nodeId) => {
            setInspectorError(null);
            setSelectedEntity({ kind: "node", id: nodeId });
          }}
          ref={canvasRef}
        />
        {inspectorSelection ? (
          <GraphInspector
            error={inspectorError}
            isRemoving={pending.removeBoardNode || pending.removeBoardEdge}
            isSaving={pending.updateNode || pending.updateEdge}
            key={`${inspectorSelection.kind}:${inspectorSelection.entity.id}:${inspectorSelection.entity.version}`}
            onRemoveFromBoard={handleRemoveFromBoard}
            onSave={handleSaveInspector}
            selection={inspectorSelection}
          />
        ) : null}
      </div>
    </main>
  );
}
