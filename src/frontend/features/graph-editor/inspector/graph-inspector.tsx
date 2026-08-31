"use client";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import { Button } from "@/frontend/shared/ui/button";
import { TextAreaField, TextField } from "@/frontend/shared/ui/form-field";
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
    <aside className="self-start rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 shadow-[0_1px_2px_rgba(23,25,29,0.03)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--sg-brand-strong)]">
            INSPECTOR
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">
            {isNode ? "노드" : "관계"}
          </h2>
        </div>
        <span className="rounded-full bg-[var(--sg-canvas)] px-2 py-1 text-xs font-medium text-[var(--sg-muted)]">
          v{selection.entity.version}
        </span>
      </div>

      <div className="grid gap-4">
        <TextField
          label="이름"
          onChange={(event) => onDraftChange({ name: event.target.value })}
          value={draft.name}
        />

        <TextAreaField
          label="설명"
          onChange={(event) =>
            onDraftChange({ description: event.target.value })
          }
          value={draft.description}
        />

        <TextAreaField
          className="min-h-40 font-mono text-xs"
          error={validationError}
          label="속성 JSON"
          onChange={(event) =>
            onDraftChange({ propertiesText: event.target.value })
          }
          value={draft.propertiesText}
        />

        {error ? (
          <p className="text-sm leading-6 text-[var(--sg-danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 border-t border-[var(--sg-line)] pt-5">
        <p className="mb-3 text-xs leading-5 text-[var(--sg-muted)]">
          현재 보드에서만 제거합니다. 이야기의 원본 노드와 관계 데이터는 유지됩니다.
        </p>
        <Button
          busy={isRemoving}
          className="w-full"
          disabled={isLaneBusy}
          emphasis="outline"
          intent="danger"
          onClick={onRemoveFromBoard}
        >
          보드에서 제거
        </Button>
      </div>
    </aside>
  );
}
