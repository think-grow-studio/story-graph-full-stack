"use client";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import type {
  InspectorDraft,
  InspectorDraftPatch,
} from "./inspector-draft-model";

export type GraphInspectorSelection =
  | { kind: "node"; entity: GraphNodeResponse }
  | { kind: "edge"; entity: GraphEdgeResponse };

export function GraphInspector({
  selection,
  draft,
  validationError,
  error,
  isRemoving,
  isLaneBusy,
  onDraftChange,
  onRemoveFromBoard,
}: {
  selection: GraphInspectorSelection;
  draft: InspectorDraft;
  validationError: string | null;
  error: string | null;
  isRemoving: boolean;
  isLaneBusy: boolean;
  onDraftChange: (patch: InspectorDraftPatch) => void;
  onRemoveFromBoard: () => Promise<void> | void;
}) {
  const isNode = selection.kind === "node";

  return (
    <aside className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {isNode ? "Node Inspector" : "Relationship Inspector"}
        </h2>
        <p className="text-xs text-neutral-500">
          Version {selection.entity.version}
        </p>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2"
            onChange={(event) => onDraftChange({ name: event.target.value })}
            value={draft.name}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            className="min-h-28 rounded-md border border-neutral-300 px-3 py-2"
            onChange={(event) =>
              onDraftChange({ description: event.target.value })
            }
            value={draft.description}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Properties JSON</span>
          <textarea
            className="min-h-40 rounded-md border border-neutral-300 px-3 py-2 font-mono text-xs"
            onChange={(event) =>
              onDraftChange({ propertiesText: event.target.value })
            }
            value={draft.propertiesText}
          />
        </label>

        {validationError ? (
          <p className="text-sm text-red-600">{validationError}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="mt-5 border-t border-neutral-200 pt-4">
        <p className="mb-2 text-xs text-neutral-500">
          Removes this item only from the current Board. Canonical Story graph data is kept.
        </p>
        <button
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          disabled={isLaneBusy || isRemoving}
          onClick={onRemoveFromBoard}
          type="button"
        >
          {isRemoving ? "Removing..." : "Remove from Board"}
        </button>
      </div>
    </aside>
  );
}
