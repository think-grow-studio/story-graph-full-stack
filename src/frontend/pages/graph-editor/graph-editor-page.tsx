"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  defaultEdgePresentation,
  defaultNodePresentation,
} from "@/contracts/graph/graph.contract";
import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import { useBoardSnapshotQuery } from "@/frontend/api/graph/graph.queries";
import { AddNodeDialog } from "@/frontend/features/graph-editor/actions/add-node-dialog";
import { RelationshipDialog } from "@/frontend/features/graph-editor/actions/relationship-dialog";
import type { EditorCommand } from "@/frontend/features/graph-editor/commands/editor-command";
import type { UndoableEditorCommand } from "@/frontend/features/graph-editor/history/editor-history-entry";
import { useEditorHistory } from "@/frontend/features/graph-editor/history/use-editor-history";
import {
  GraphInspector,
  type GraphInspectorSelection,
} from "@/frontend/features/graph-editor/inspector/graph-inspector";
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
import { Button } from "@/frontend/shared/ui/button";
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
  const [isNodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceNodeId: string;
    targetNodeId: string;
  } | null>(null);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const hydratedBoardIdRef = useRef<string | null>(null);
  const dragStartPositionsRef = useRef(
    new Map<string, { x: number; y: number }>(),
  );
  const bootstrap = useBootstrapQuery();
  const workspaceId = bootstrap.data?.workspace.id;
  const snapshot = useBoardSnapshotQuery(workspaceId, boardId);
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
        return node ? evaluateInspectorDraft(draft, node).dirty : true;
      }

      const edgeId = key.slice("edge:".length);
      const edge = state.edges.find((candidate) => candidate.id === edgeId);
      return edge ? evaluateInspectorDraft(draft, edge).dirty : true;
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

  function handleCreateNode(name: string) {
    if (!workspaceId) return;

    const position = canvasRef.current?.getCenterPosition() ?? { x: 0, y: 0 };
    const operationId = history.dispatch({
      type: "create-node",
      boardId,
      workspaceId,
      nodeId: crypto.randomUUID(),
      name,
      description: "",
      kind: "entity",
      iconKey: null,
      properties: {},
      position,
      width: null,
      height: null,
      zIndex: 0,
      presentation: { ...defaultNodePresentation },
      createdAt: new Date().toISOString(),
    });

    if (operationId) setNodeDialogOpen(false);
  }

  function handleConnectNodes(sourceNodeId: string, targetNodeId: string) {
    setPendingConnection({ sourceNodeId, targetNodeId });
  }

  function handleCreateRelationship(name: string) {
    if (!workspaceId || !pendingConnection) return;

    const operationId = history.dispatch({
      type: "create-edge",
      boardId,
      workspaceId,
      edgeId: crypto.randomUUID(),
      sourceNodeId: pendingConnection.sourceNodeId,
      targetNodeId: pendingConnection.targetNodeId,
      direction: "DIRECTED",
      name,
      description: "",
      kind: "relationship",
      iconKey: null,
      properties: {},
      presentation: { ...defaultEdgePresentation },
      routing: {
        type: snapshot.data?.board.graphSettings?.defaultEdgeRouting ?? "orthogonal",
        sourcePort: "auto",
        targetPort: "auto",
        waypoints: [],
      },
      createdAt: new Date().toISOString(),
    });

    if (operationId) setPendingConnection(null);
  }

  function handleNodeDragStart(nodeId: string) {
    const node = store
      .getState()
      .nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    dragStartPositionsRef.current.set(nodeId, { x: node.x, y: node.y });
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

    const node = store
      .getState()
      .nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    history.dispatch(
      {
        type: "move-node",
        boardId,
        nodeId,
        workspaceId,
        expectedVersion: node.version,
        position: { x: node.x, y: node.y },
      },
      { moveStartPosition },
    );
  }

  function handleDeleteSelected() {
    if (!workspaceId || !selectedEntity) return;

    if (selectedEntity.kind === "node") {
      if (!store.getState().nodes.some((node) => node.id === selectedEntity.id)) {
        return;
      }
      const operationId = history.dispatch({
        type: "delete-node",
        boardId,
        nodeId: selectedEntity.id,
        workspaceId,
      });
      if (operationId) setSelectedEntity(null);
      return;
    }

    if (!store.getState().edges.some((edge) => edge.id === selectedEntity.id)) {
      return;
    }
    const operationId = history.dispatch({
      type: "delete-edge",
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

  const canvasNodes = state.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    position: { x: node.x, y: node.y },
  }));
  const canvasEdges = state.edges.map((edge) => ({
    id: edge.id,
    name: edge.name,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
  }));

  const pendingSourceLabel = pendingConnection
    ? canvasNodes.find((node) => node.id === pendingConnection.sourceNodeId)?.name ?? "출발 노드"
    : "";
  const pendingTargetLabel = pendingConnection
    ? canvasNodes.find((node) => node.id === pendingConnection.targetNodeId)?.name ?? "도착 노드"
    : "";

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
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-[var(--sg-canvas)] text-[var(--sg-ink)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--sg-line)] bg-[var(--sg-surface)] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <Link
            className="text-sm font-medium text-[var(--sg-muted)] hover:text-[var(--sg-ink)]"
            href={`/stories/${storyId}`}
          >
            ← 보드
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="truncate text-xl font-semibold tracking-[-0.025em]">
              {snapshot.data.board.name}
            </h1>
            <p className="text-sm text-[var(--sg-muted)]">{snapshot.data.story.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div aria-live="polite" className="min-w-24 text-right text-sm text-[var(--sg-muted)]">
            {editorSaveState === "saved" ? <span>저장됨</span> : null}
            {editorSaveState === "saving" ? <span>저장 중…</span> : null}
            {editorSaveState === "unsaved" ? <span>저장되지 않음</span> : null}
            {editorSaveState === "error" ? (
              <span className="inline-flex items-center gap-2">
                <span>저장 오류</span>
                <button
                  className="font-semibold text-[var(--sg-danger)] underline underline-offset-4"
                  onClick={saveQueue.retryFailed}
                  type="button"
                >
                  다시 시도
                </button>
              </span>
            ) : null}
          </div>
          <Button
            disabled={historyBlocked || !history.snapshot.canUndo}
            emphasis="outline"
            intent="neutral"
            onClick={history.undo}
          >
            Undo
          </Button>
          <Button
            disabled={historyBlocked || !history.snapshot.canRedo}
            emphasis="outline"
            intent="neutral"
            onClick={history.redo}
          >
            Redo
          </Button>
          <Button onClick={() => setNodeDialogOpen(true)}>노드 추가</Button>
        </div>
      </header>

      <div className="grid min-h-0 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-h-0 gap-3">
          {actionFailures.length ? (
            <div className="grid gap-1" role="status">
              {actionFailures.map((failure) => (
                <p
                  className="text-sm text-[var(--sg-danger)]"
                  key={`${failure.operationId}:${failure.attempt}`}
                >
                  {getEditorFailureMessage(failure.command, failure.error)}
                </p>
              ))}
            </div>
          ) : null}
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
        </div>
        {inspectorSelection && selectedDraft && selectedDraftKey ? (
          <GraphInspector
            draft={selectedDraft}
            error={inspectorError}
            isLaneBusy={selectedLaneBusy}
            isRemoving={false}
            key={selectedDraftKey}
            onDelete={handleDeleteSelected}
            onDraftChange={(patch) =>
              draftStore.getState().updateDraft(selectedDraftKey, patch)
            }
            selection={inspectorSelection}
            validationError={inspectorValidationError}
          />
        ) : (
          <aside className="hidden rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 text-sm text-[var(--sg-muted)] lg:block">
            노드나 관계를 선택하면 여기에서 세부 정보를 편집할 수 있습니다.
          </aside>
        )}
      </div>

      <AddNodeDialog
        busy={false}
        onClose={() => setNodeDialogOpen(false)}
        onCreate={handleCreateNode}
        open={isNodeDialogOpen}
      />

      <RelationshipDialog
        busy={false}
        onClose={() => setPendingConnection(null)}
        onCreate={handleCreateRelationship}
        open={Boolean(pendingConnection)}
        sourceLabel={pendingSourceLabel}
        targetLabel={pendingTargetLabel}
      />
    </main>
  );
}

function getEditorFailureMessage(command: EditorCommand, error: unknown): string {
  switch (command.type) {
    case "create-node":
      return "Unable to create Node.";
    case "move-node":
      return "Unable to save Node position.";
    case "update-node":
      return isAxiosError(error) && error.response?.status === 409
        ? "This Node changed elsewhere. Reload before saving again."
        : "Unable to save Node.";
    case "delete-node":
      return "Unable to delete Node.";
    case "restore-node":
      return "Unable to restore Node.";
    case "create-edge":
      return "Unable to create Relationship.";
    case "update-edge":
      return isAxiosError(error) && error.response?.status === 409
        ? "This Relationship changed elsewhere. Reload before saving again."
        : "Unable to save Relationship.";
    case "delete-edge":
      return "Unable to delete Relationship.";
    case "restore-edge":
      return "Unable to restore Relationship.";
  }
}