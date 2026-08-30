import type { EditorCommand } from "../commands/editor-command";
import {
  findNodeState,
  normalizeNodeStateOverrides,
  resolveEffectiveNode,
} from "../model/effective-node";
import type { GraphEditorStore } from "../store/graph-editor-store";
import type { InspectorDraftStore } from "./inspector-draft-store";
import {
  evaluateInspectorDraft,
  type InspectorEntityKey,
} from "./inspector-draft-model";

export type InspectorAutosaveController = {
  start(): void;
  dispose(): void;
};

export function createInspectorAutosaveController({
  draftStore,
  graphStore,
  boardId,
  workspaceId,
  delayMs = 500,
  dispatch,
}: {
  draftStore: InspectorDraftStore;
  graphStore: GraphEditorStore;
  boardId: string;
  workspaceId: string;
  delayMs?: number;
  dispatch(command: EditorCommand): string | null;
}): InspectorAutosaveController {
  const timers = new Map<InspectorEntityKey, ReturnType<typeof setTimeout>>();
  let unsubscribe: (() => void) | null = null;

  function schedule(key: InspectorEntityKey) {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(key);
      dispatchLatestDraft(key);
    }, delayMs);
    timers.set(key, timer);
  }

  function dispatchLatestDraft(key: InspectorEntityKey) {
    const draft = draftStore.getState().drafts[key];
    if (!draft) return;

    if (key.startsWith("node:")) {
      const nodeId = key.slice("node:".length);
      const state = graphStore.getState();
      const node = state.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;

      if (state.scope) {
        const nodeState = findNodeState(state.scope.id, nodeId, state.nodeStates);
        const effectiveNode = resolveEffectiveNode(node, nodeState);
        const evaluation = evaluateInspectorDraft(draft, effectiveNode);
        if (evaluation.status !== "saveable" || !evaluation.dirty) return;

        dispatch({
          type: "update-node-state",
          boardId,
          workspaceId,
          scopeId: state.scope.id,
          nodeId,
          version: nodeState?.version ?? null,
          ...normalizeNodeStateOverrides(node, evaluation.input),
        });
        return;
      }

      const evaluation = evaluateInspectorDraft(draft, node);
      if (evaluation.status !== "saveable" || !evaluation.dirty) return;

      dispatch({
        type: "update-node",
        boardId,
        workspaceId,
        nodeId,
        version: node.version,
        ...evaluation.input,
      });
      return;
    }

    const edgeId = key.slice("edge:".length);
    const edge = graphStore
      .getState()
      .edges.find((candidate) => candidate.id === edgeId);
    if (!edge) return;

    const evaluation = evaluateInspectorDraft(draft, edge);
    if (evaluation.status !== "saveable" || !evaluation.dirty) return;

    dispatch({
      type: "update-edge",
      boardId,
      workspaceId,
      edgeId,
      version: edge.version,
      ...evaluation.input,
    });
  }

  return {
    start() {
      if (unsubscribe) return;

      unsubscribe = draftStore.subscribe((state, previousState) => {
        const keys = Object.keys(state.drafts) as InspectorEntityKey[];
        for (const key of keys) {
          const current = state.drafts[key];
          const previous = previousState.drafts[key];
          if (!current || current.revision === previous?.revision) continue;
          schedule(key);
        }
      });
    },
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
