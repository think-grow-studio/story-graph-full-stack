import type { EditorCommand } from "../commands/editor-command";
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
  let unsubscribeDrafts: (() => void) | null = null;
  let unsubscribeGraph: (() => void) | null = null;

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
      const node = graphStore
        .getState()
        .nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;

      const evaluation = evaluateInspectorDraft(draft, node);
      if (evaluation.status !== "saveable" || !evaluation.dirty) return;

      dispatch({
        type: "update-node",
        boardId,
        workspaceId,
        nodeId,
        expectedVersion: node.version,
        kind: node.kind,
        iconKey: node.iconKey,
        presentation: node.presentation,
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
      expectedVersion: edge.version,
      direction: edge.direction,
      kind: edge.kind,
      iconKey: edge.iconKey,
      presentation: edge.presentation,
      routing: edge.routing,
      ...evaluation.input,
    });
  }

  function discardMissingDrafts() {
    const graphState = graphStore.getState();
    const draftKeys = Object.keys(
      draftStore.getState().drafts,
    ) as InspectorEntityKey[];

    for (const key of draftKeys) {
      const exists = key.startsWith("node:")
        ? graphState.nodes.some(
            (node) => node.id === key.slice("node:".length),
          )
        : graphState.edges.some(
            (edge) => edge.id === key.slice("edge:".length),
          );
      if (exists) continue;

      const timer = timers.get(key);
      if (timer) clearTimeout(timer);
      timers.delete(key);
      draftStore.getState().discardDraft(key);
    }
  }

  return {
    start() {
      if (unsubscribeDrafts || unsubscribeGraph) return;

      unsubscribeDrafts = draftStore.subscribe((state, previousState) => {
        const keys = Object.keys(state.drafts) as InspectorEntityKey[];
        for (const key of keys) {
          const current = state.drafts[key];
          const previous = previousState.drafts[key];
          if (!current || current.revision === previous?.revision) continue;
          schedule(key);
        }
      });
      unsubscribeGraph = graphStore.subscribe(discardMissingDrafts);
    },
    dispose() {
      unsubscribeDrafts?.();
      unsubscribeDrafts = null;
      unsubscribeGraph?.();
      unsubscribeGraph = null;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
