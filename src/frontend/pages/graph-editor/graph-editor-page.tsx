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

import { useBootstrapQuery } from "@/frontend/api/auth/bootstrap.queries";
import {
  useBoardSnapshotQuery,
  useStoryNodesQuery,
} from "@/frontend/api/graph/graph.queries";
import { AddNodeDialog } from "@/frontend/features/graph-editor/actions/add-node-dialog";
import { RelationshipDialog } from "@/frontend/features/graph-editor/actions/relationship-dialog";
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
import {
  findEdgeState,
  resolveEffectiveEdge,
} from "@/frontend/features/graph-editor/model/effective-edge";
import {
  findNodeState,
  resolveEffectiveNode,
} from "@/frontend/features/graph-editor/model/effective-node";
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
    if (node) {
      const nodeState = state.scope
        ? findNodeState(state.scope.id, node.id, state.nodeStates)
        : null;
      inspectorSelection = {
        kind: "node",
        entity: resolveEffectiveNode(node, nodeState),
      };
    }
  } else if (selectedEntity?.kind === "edge") {
    const edge = state.edges.find(
      (candidate) => candidate.id === selectedEntity.id,
    );
    if (edge) {
      const edgeState = state.scope
        ? findEdgeState(state.scope.id, edge.id, state.edgeStates)
        : null;
      inspectorSelection = {
        kind: "edge",
        entity: resolveEffectiveEdge(edge, edgeState),
      };
    }
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
        if (!node) return true;
        const nodeState = state.scope
          ? findNodeState(state.scope.id, node.id, state.nodeStates)
          : null;
        return evaluateInspectorDraft(
          draft,
          resolveEffectiveNode(node, nodeState),
        ).dirty;
      }

      const edgeId = key.slice("edge:".length);
      const edge = state.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return true;
      const edgeState = state.scope
        ? findEdgeState(state.scope.id, edge.id, state.edgeStates)
        : null;
      return evaluateInspectorDraft(
        draft,
        resolveEffectiveEdge(edge, edgeState),
      ).dirty;
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

      if (command.type === "update-node-state") {
        const currentState = store.getState();
        const node = currentState.nodes.find(
          (candidate) => candidate.id === command.nodeId,
        );
        if (node) {
          const nodeState = findNodeState(
            command.scopeId,
            command.nodeId,
            currentState.nodeStates,
          );
          draftStore.getState().replaceDraft(
            toInspectorEntityKey("node", command.nodeId),
            resolveEffectiveNode(node, nodeState),
          );
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
        return;
      }

      if (command.type === "update-edge-state") {
        const currentState = store.getState();
        const edge = currentState.edges.find(
          (candidate) => candidate.id === command.edgeId,
        );
        if (edge) {
          const edgeState = findEdgeState(
            command.scopeId,
            command.edgeId,
            currentState.edgeStates,
          );
          draftStore.getState().replaceDraft(
            toInspectorEntityKey("edge", command.edgeId),
            resolveEffectiveEdge(edge, edgeState),
          );
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
    if (!workspaceId || !snapshot.data) return;

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

    if (operationId) setNodeDialogOpen(false);
  }

  function handleAddExistingNode(nodeId: string) {
    if (!workspaceId || !storyNodes.data) return;

    const node = storyNodes.data.find((candidate) => candidate.id === nodeId);
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
    if (operationId) setNodeDialogOpen(false);
  }

  function handleConnectNodes(sourceNodeId: string, targetNodeId: string) {
    setPendingConnection({ sourceNodeId, targetNodeId });
  }

  function handleCreateRelationship(name: string) {
    if (!workspaceId || !snapshot.data || !pendingConnection) return;

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

    if (operationId) setPendingConnection(null);
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
    const nodeState = state.scope
      ? findNodeState(state.scope.id, node.id, state.nodeStates)
      : null;
    const effectiveNode = resolveEffectiveNode(node, nodeState);
    return [
      {
        id: node.id,
        name: effectiveNode.name,
        position: { x: placement.x, y: placement.y },
      },
    ];
  });
  const representedEdgeIds = new Set(
    state.boardEdges.map((boardEdge) => boardEdge.edgeId),
  );
  const canvasEdges = state.edges
    .filter((edge) => representedEdgeIds.has(edge.id))
    .map((edge) => {
      const edgeState = state.scope
        ? findEdgeState(state.scope.id, edge.id, state.edgeStates)
        : null;
      const effectiveEdge = resolveEffectiveEdge(edge, edgeState);
      return {
        id: edge.id,
        name: effectiveEdge.name,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
      };
    });

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
              failure.command.type === "update-node-state" ||
              failure.command.type === "update-edge" ||
              failure.command.type === "update-edge-state"),
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
            {state.scope ? (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--sg-brand)_8%,white)] px-2 py-1 text-xs font-semibold text-[var(--sg-brand-strong)]">
                컨텍스트 · {state.scope.name}
              </span>
            ) : null}
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
          {storyNodes.isError ? (
            <p className="text-sm text-[var(--sg-danger)]">
              기존 노드 목록을 불러오지 못했습니다. 새 노드는 계속 만들 수 있습니다.
            </p>
          ) : null}
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
            onDraftChange={(patch) =>
              draftStore.getState().updateDraft(selectedDraftKey, patch)
            }
            onRemoveFromBoard={handleRemoveFromBoard}
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
        existingNodes={availableExistingNodes}
        onClose={() => setNodeDialogOpen(false)}
        onCreate={handleCreateNode}
        onPlace={handleAddExistingNode}
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
    case "update-node-state":
      return isAxiosError(error) && error.response?.status === 409
        ? "This scoped Node state changed elsewhere. Reload before saving again."
        : "Unable to save scoped Node state.";
    case "update-edge":
      return isAxiosError(error) && error.response?.status === 409
        ? "This Relationship changed elsewhere. Reload before saving again."
        : "Unable to save Relationship.";
    case "update-edge-state":
      return isAxiosError(error) && error.response?.status === 409
        ? "This scoped Relationship state changed elsewhere. Reload before saving again."
        : "Unable to save scoped Relationship state.";
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
