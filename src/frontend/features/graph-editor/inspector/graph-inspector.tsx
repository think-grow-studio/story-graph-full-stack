"use client";

import { useState, type FormEvent } from "react";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";

export type GraphInspectorSelection =
  | { kind: "node"; entity: GraphNodeResponse }
  | { kind: "edge"; entity: GraphEdgeResponse };

export type GraphInspectorSaveInput = {
  name: string;
  description: string;
  properties: Record<string, unknown>;
};

export function GraphInspector({
  selection,
  isSaving,
  isRemoving,
  error,
  onSave,
  onRemoveFromBoard,
}: {
  selection: GraphInspectorSelection;
  isSaving: boolean;
  isRemoving: boolean;
  error: string | null;
  onSave: (input: GraphInspectorSaveInput) => Promise<void> | void;
  onRemoveFromBoard: () => Promise<void> | void;
}) {
  const [name, setName] = useState(selection.entity.name);
  const [description, setDescription] = useState(selection.entity.description);
  const [propertiesText, setPropertiesText] = useState(
    JSON.stringify(selection.entity.properties, null, 2),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    let properties: unknown;
    try {
      properties = JSON.parse(propertiesText);
    } catch {
      setValidationError("Properties must be valid JSON.");
      return;
    }

    if (
      properties === null ||
      Array.isArray(properties) ||
      typeof properties !== "object"
    ) {
      setValidationError("Properties must be a JSON object.");
      return;
    }

    setValidationError(null);
    await onSave({
      name: trimmedName,
      description,
      properties: properties as Record<string, unknown>,
    });
  }

  const isNode = selection.kind === "node";

  return (
    <aside className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          {isNode ? "Node Inspector" : "Relationship Inspector"}
        </h2>
        <p className="text-xs text-neutral-500">Version {selection.entity.version}</p>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            className="rounded-md border border-neutral-300 px-3 py-2"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            className="min-h-28 rounded-md border border-neutral-300 px-3 py-2"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Properties JSON</span>
          <textarea
            className="min-h-40 font-mono text-xs rounded-md border border-neutral-300 px-3 py-2"
            onChange={(event) => setPropertiesText(event.target.value)}
            value={propertiesText}
          />
        </label>

        {validationError ? (
          <p className="text-sm text-red-600">{validationError}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          className="rounded-md bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50"
          disabled={isSaving || isRemoving || !name.trim()}
          type="submit"
        >
          {isSaving
            ? "Saving..."
            : isNode
              ? "Save Node"
              : "Save Relationship"}
        </button>
      </form>

      <div className="mt-5 border-t border-neutral-200 pt-4">
        <p className="mb-2 text-xs text-neutral-500">
          Removes this item only from the current Board. Canonical Story graph data is kept.
        </p>
        <button
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          disabled={isSaving || isRemoving}
          onClick={onRemoveFromBoard}
          type="button"
        >
          {isRemoving ? "Removing..." : "Remove from Board"}
        </button>
      </div>
    </aside>
  );
}
