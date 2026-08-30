"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardSnapshotQuery,
  useStoryNodesQuery,
} from "@/frontend/api/graph/graph.queries";
import type { EditorCommand } from "@/frontend/features/graph-editor/commands/editor-command";
import type { UndoableEditorCommand } from "@/frontend/features/graph-editor/history/editor-history-entry";
import { useEditorHistory } from "@/frontend/features/graph-editor/history/use-editor-history";
import { GraphInspector, type GraphInspectorSelection } from "@/frontend/features/graph-editor/inspector/graph-inspector";
import {
  combineEditorSaveState,
  evaluateInspectorDraft,
  toInspectorEntityKey,
} from "@/frontend/features/graph-editor/inspector/inspector-draft-model";
import { createInspectorDraftStore } from "@/frontend/features/graph-editor/inspector/inspector-draft-store";
import {
  useInspectorAutosave,
  useInspectorDraftState,
} from "@/frontend/features/graph-editor/inspector/use-inspector-autosave";
import { useEditorPersistence } from "@/frontend/features/graph-editor/persistence/use-editor-persistence";
import { useEditorSaveQueue } from "@/frontend/features/graph-editor/save-queue/use-editor-save-queue";
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
  const [selectedEntity, setSelectedEntity] =
    useState<SelectedGraphEntity | null>(null);
  const [isNodeFormOpen, setNodeFormOpen] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [selectedExistingNodeId, setSelectedExistingNodeId] = useState("");
  const [pendingConnection, setPendingConnection] = useState<{
    sourceNodeId: string;
    targetNodeId: string;
  } | null>(null);
  const [relationshipName, setRelationshipName] = useState("");
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const hydratedBoardIdRef = useRef<string | null>(null);
  const dragStartPositionsRef = useRef(
    new Map<string, { x: number; y: number }>(),
  );
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const snapshot = useBoardSnapshotQuery(workspaceId, boardId);
  const storyNodes = useStoryNodesQuery(workspaceId, storyId);
  const { persistence } = useEditorPersistence(workspaceId, boardId);
  const store = useGraphEditorStoreApi();
  const state = useGraphEditorStore((current) => current);
  const saveQueue = useEditorSaveQueue(store, persistence, boardId);
  const draftScope = useMemo(
    () => ({ boardId, store: createInspectorDraftStore() }),
    [boardId],
  );
  const draftStore = draftScope.store;
  const draftState = useInspectorDraftState(draftStore);

  useEffect(() => {
    if (!snapshot.data || snapshot.data.board.id !== boardId) return;
    if (hydratedBoardIdRef.current === boardId) return;

    store.getState().hydrate(snapshot.data);
    hydratedBoardIdRef.current = boardId;
  }, [boardId, snapshot.data, store]);

  let inspectorSelection: GraphInspectorSelection | null = null;
  if (selectedEntity?.kind === "node") {
    const node = state.nodes.find(
      (candidate) => candidate.id === selectedEntity.id,
    );
    if (node) inspectorSelection = { kind: "node", entity: node };
  } else if (selectedEntity?.kind === "edge") {
    const edge = state.edges.find(
      (candidate) => candidate.id === selectedEntity.id,
    );
    if (edge) inspectorSelection = { kind: "edge", entity: edge };
  }

  const selectedDraftKey = inspectorSelection
    ? toInspectorEntityKey(
        inspectorSelection.kind,
        inspectorSelection.entity.id,
      )
    : null;

  useEffect(() => {
    if (!selectedDraftKey || !inspectorSelection) return;
    draftStore
      .getState()
      .ensureDraft(selectedDraftKey, inspectorSelection.entity);
  }, [draftStore, inspectorSelection, selectedDraftKey]);

  const selectedDraft = selectedDraftKey
    ? draftState.drafts[selectedDraftKey]
    : undefined;
  const selectedDraftEvaluation =
    selectedDraft && inspectorSelection
      ? evaluateInspectorDraft(selectedDraft, inspectorSelection.entity)
      : null;
  const inspectorValidationError =
    selectedDraftEvaluation?.status === "invalid"
      ? selectedDraftEvaluation.message
      : null;

  const hasDirtyInspectorDraft = Object.entries(draftState.drafts).some(
    ([key, draft]) => {
      if (!draft) return false;

      if (key.startsWith("node:")) {
        const nodeId = key.slice("node:".length);
        const node = state.nodes.find((candidate) => candidate.id === nodeId);
        return !node || evaluateInspectorDraft(draft, node).dirty;
      }

      const edgeId = key.slice("edge:".length);
      const edge = state.edges.find((candidate) => candidate.id === edgeId);
      return !edge || evaluateInspectorDraft(draft, edge).dirty;
    },
  );
  const editorSaveState = combineEditorSaveState(
    saveQueue.snapshot.saveState,
    hasDirtyInspectorDraft,
  );
  const historyBlocked =
    hasDirtyInspectorDraft || saveQueue.snapshot.saveState === "error";

  const handleReplayCommand = useCallback(
    (command: UndoableEditorCommand) => {
      if (command.type === "update-node") {
        const node = store
          .getState()
          .nodes.find((candidate) => candidate.id === command.nodeId);
        if (node) {
          draftStore
            .getState()
            .replaceDraft(toInspectorEntityKey("node", command.nodeId), node);
        }
        return;
      }

      if (command.type === "update-edge") {
        const edge = store
          .getState()
          .edges.find((candidate) => candidate.id === command.edgeId);
        if (edge) {
          draftStore
            .getState()
            .replaceDraft(toInspectorEntityKey("edge", command.edgeId), edge);
        }
      }
    },
    [draftStore, store],
  );

  const history = useEditorHistory({
    store,
    boardId,
    dispatchToSaveQueue: saveQueue.dispatch,
    blocked: historyBlocked,
    onReplayCommand: handleReplayCommand,
  });

  useInspectorAutosave({
    draftStore,
    graphStore: store,
    boardId,
    workspaceId,
    dispatch: history.dispatch,
  });

  function selectEntity(next: SelectedGraphEntity) {
    if (
      selectedEntity?.kind !== next.kind ||
      selectedEntity?.id !== next.id
    ) {
      history.boundary();
    }
    setSelectedEntity(next);
  }

  function handleCreateNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !snapshot.data) return;

    const name = nodeName.trim();
    if (!name) return;

    const position = canvasRef.current?.getCenterPosition() ?? { x: 0, y: 0 };
    const operationId = history.dispatch({
      type: "create-node",
      boardId,
      workspaceId,
      storyId: snapshot.data.story.id,
      nodeId: crypto.randomUUID(),
      name,
      position,
      createdAt: new Date().toISOString(),
    });

    if (operationId) {
      setNodeName("");
      setNodeFormOpen(false);
    }
  }

  function handleAddExistingNode() {
    if (!workspaceId || !selectedExistingNodeId || !storyNodes.data) return;

    const node = storyNodes.data.find(
      (candidate) => candidate.id === selectedExistingNodeId,
    );
    if (!node) return;

    const isAlreadyRepresented = store
      .getState()
      .boardNodes.some((candidate) => candidate.nodeId === node.id);
    if (isAlreadyRepresented) return;

    const position = canvasRef.current?.getCenterPosition() ?? { x: 0, y: 0 };
    const operationId = history.dispatch({
      type: "place-board-node",
      boardId,
      workspaceId,
      node,
      position,
      createdAt: new Date().toISOString(),
    });
    if (operationId) setSelectedExistingNodeId("");
  }

  function handleConnectNodes(sourceNodeId: string, targetNodeId: string) {
    setPendingConnection({ sourceNodeId, targetNodeId });
    setRelationshipName("");
  }

  function handleCreateRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !snapshot.data || !pendingConnection) return;

    const name = relationshipName.trim();
    if (!name) return;

    const operationId = history.dispatch({
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

    if (operationId) {
      setRelationshipName("");
      setPendingConnection(null);
    }
  }

  function handleNodeDragStart(nodeId: string) {
    const boardNode = store
      .getState()
      .boardNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!boardNode) return;

    dragStartPositionsRef.current.set(nodeId, {
      x: boardNode.x,
      y: boardNode.y,
    });
    history.boundary();
  }

  function handleNodePositionChange(
    nodeId: string,
    position: { x: number; y: number },
  ) {
    store.getState().setNodePosition(nodeId, position);
  }

  function handleNodeDragStop(nodeId: string) {
    const moveStartPosition = dragStartPositionsRef.current.get(nodeId);
    dragStartPositionsRef.current.delete(nodeId);
    if (!workspaceId) return;

    const boardNode = store
      .getState()
      .boardNodes.find((candidate) => candidate.nodeId === nodeId);
    if (!boardNode) return;

    history.dispatch(
      {
        type: "move-node",
        boardId,
        nodeId,
        workspaceId,
        position: { x: boardNode.x, y: boardNode.y },
      },
      { moveStartPosition },
    );
  }

  function handleRemoveFromBoard() {
    if (!workspaceId || !selectedEntity) return;

    if (selectedEntity.kind === "node") {
      const isRepresented = store
        .getState()
        .boardNodes.some((candidate) => candidate.nodeId === selectedEntity.id);
      if (!isRepresented) return;

      const operationId = history.dispatch({
        type: "remove-board-node",
        boardId,
        nodeId: selectedEntity.id,
        workspaceId,
      });
      if (operationId) setSelectedEntity(null);
      return;
    }

    const isRepresented = store
      .getState()
      .boardEdges.some((candidate) => candidate.edgeId === selectedEntity.id);
    if (!isRepresented) return;

    const operationId = history.dispatch({
      type: "remove-board-edge",
      boardId,
      edgeId: selectedEntity.id,
      workspaceId,
    });
    if (operationId) setSelectedEntity(null);
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
  const representedNodeIds = new Set(state.boardNodes.map((boardNode) => boardNode.nodeId));
  const availableExistingNodes = (storyNodes.data ?? []).filter(
    (node) => !representedNodeIds.has(node.id),
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

  const selectedLaneKey = selectedDraftKey;
  const selectedLaneState = selectedLaneKey
    ? saveQueue.getLaneState(selectedLaneKey)
    : "idle";
  const selectedLaneBusy =
    selectedLaneState === "pending" || selectedLaneState === "saving";
  const selectedInspectorFailure = selectedLaneKey
    ? [...saveQueue.snapshot.failedOperations]
        .reverse()
        .find(
          (failure) =>
            failure.laneKey === selectedLaneKey &&
            (failure.command.type === "update-node" ||
              failure.command.type === "update-edge"),
        )
    : undefined;
  const inspectorError = selectedInspectorFailure
    ? getEditorFailureMessage(
        selectedInspectorFailure.command,
        selectedInspectorFailure.error,
      )
    : null;
  const actionFailures = saveQueue.snapshot.failedOperations.filter(
    (failure) => failure !== selectedInspectorFailure,
  );

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
          {state.scope ? (
            <p className="text-sm text-neutral-500">Scope: {state.scope.name}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <div aria-live="polite" className="text-sm text-neutral-500">
            {editorSaveState === "saved" ? <span>Saved</span> : null}
            {editorSaveState === "saving" ? <span>Saving…</span> : null}
            {editorSaveState === "unsaved" ? <span>Unsaved</span> : null}
            {editorSaveState === "error" ? (
              <span className="inline-flex items-center gap-2">
                <span>Error</span>
                <button
                  className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium"
                  onClick={saveQueue.retryFailed}
                  type="button"
                >
                  Retry
                </button>
              </span>
            ) : null}
          </div>
          <div className="inline-flex items-center gap-1">
            <button
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
              disabled={historyBlocked || !history.snapshot.canUndo}
              onClick={history.undo}
              type="button"
            >
              Undo
            </button>
            <button
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
              disabled={historyBlocked || !history.snapshot.canRedo}
              onClick={history.redo}
              type="button"
            >
              Redo
            </button>
          </div>
          <button
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white"
            onClick={() => setNodeFormOpen(true)}
            type="button"
          >
            + Node
          </button>
        </div>
      </header>

      <div className="grid gap-2">
        <div className="flex max-w-md gap-2 rounded-lg border border-neutral-200 bg-white p-3">
          <label className="sr-only" htmlFor="existing-node">
            Existing Node
          </label>
          <select
            className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-2"
            disabled={storyNodes.isPending || availableExistingNodes.length === 0}
            id="existing-node"
            onChange={(event) => setSelectedExistingNodeId(event.target.value)}
            value={selectedExistingNodeId}
          >
            <option value="">Select existing Node</option>
            {availableExistingNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-md border border-neutral-300 px-3 py-2 font-medium disabled:opacity-50"
            disabled={!selectedExistingNodeId}
            onClick={handleAddExistingNode}
            type="button"
          >
            Add Existing Node
          </button>
        </div>
        {storyNodes.isError ? (
          <p className="text-sm text-red-600">Unable to load Story Nodes.</p>
        ) : null}
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
              disabled={!nodeName.trim()}
              type="submit"
            >
              Create Node
            </button>
            <button
              className="rounded-md border border-neutral-300 px-3 py-2"
              onClick={() => {
                setNodeName("");
                setNodeFormOpen(false);
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
              disabled={!relationshipName.trim()}
              type="submit"
            >
              Create Relationship
            </button>
          </form>
        ) : null}
        {actionFailures.map((failure) => (
          <p
            className="text-sm text-red-600"
            key={`${failure.operationId}:${failure.attempt}`}
          >
            {getEditorFailureMessage(failure.command, failure.error)}
          </p>
        ))}
      </div>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <GraphCanvas
          edges={canvasEdges}
          nodes={canvasNodes}
          onConnectNodes={handleConnectNodes}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          onNodePositionChange={handleNodePositionChange}
          onSelectEdge={(edgeId) => selectEntity({ kind: "edge", id: edgeId })}
          onSelectNode={(nodeId) => selectEntity({ kind: "node", id: nodeId })}
          ref={canvasRef}
        />
        {inspectorSelection && selectedDraft && selectedDraftKey ? (
          <GraphInspector
            draft={selectedDraft}
            error={inspectorError}
            isLaneBusy={selectedLaneBusy}
            isRemoving={false}
            key={selectedDraftKey}
            onDraftChange={(patch) =>
              draftStore.getState().updateDraft(selectedDraftKey, patch)
            }
            onRemoveFromBoard={handleRemoveFromBoard}
            selection={inspectorSelection}
            validationError={inspectorValidationError}
          />
        ) : null}
      </div>
    </main>
  );
}

function getEditorFailureMessage(command: EditorCommand, error: unknown): string {
  switch (command.type) {
    case "create-node":
      return "Unable to create Node.";
    case "place-board-node":
      return "Unable to add Node to Board.";
    case "move-node":
      return "Unable to save Node position.";
    case "create-edge":
      return "Unable to create Relationship.";
    case "update-node":
      return isAxiosError(error) && error.response?.status === 409
        ? "This Node changed elsewhere. Reload before saving again."
        : "Unable to save Node.";
    case "update-edge":
      return isAxiosError(error) && error.response?.status === 409
        ? "This Relationship changed elsewhere. Reload before saving again."
        : "Unable to save Relationship.";
    case "remove-board-node":
      return "Unable to remove Node from Board.";
    case "restore-board-node":
      return "Unable to restore Node to Board.";
    case "remove-board-edge":
      return "Unable to remove Relationship from Board.";
    case "restore-board-edge":
      return "Unable to restore Relationship to Board.";
  }
}
