"use client";

import type {
  InspectorDraft,
  InspectorDraftPatch,
} from "./inspector-draft-model";
import {
  TextAreaField,
  TextField,
} from "@/frontend/shared/ui/form-field";

type RelationshipDirectionEditorProps = {
  active: boolean;
  busy?: boolean;
  draft?: InspectorDraft;
  extraCount?: number;
  label: string;
  onDraftChange: (patch: InspectorDraftPatch) => void;
  onToggle: (active: boolean) => void;
};

export type RelationshipPairInspectorProps = {
  leftLabel: string;
  rightLabel: string;
  forward: Omit<RelationshipDirectionEditorProps, "label">;
  reverse: Omit<RelationshipDirectionEditorProps, "label">;
  undirectedCount?: number;
};

export function RelationshipPairInspector({
  leftLabel,
  rightLabel,
  forward,
  reverse,
  undirectedCount = 0,
}: RelationshipPairInspectorProps) {
  return (
    <aside className="rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-5 shadow-[0_1px_2px_rgba(23,25,29,0.03)]">
      <div className="border-b border-[var(--sg-line)] pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--sg-muted)]">
          Inspector
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">관계</h2>
        <p className="mt-1 truncate text-sm font-medium text-[var(--sg-muted)]">
          {leftLabel} ↔ {rightLabel}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <RelationshipDirectionEditor
          {...forward}
          label={`${leftLabel} → ${rightLabel}`}
        />
        <RelationshipDirectionEditor
          {...reverse}
          label={`${rightLabel} → ${leftLabel}`}
        />
      </div>

      {undirectedCount > 0 ? (
        <p className="mt-4 rounded-[var(--sg-radius-sm)] bg-[var(--sg-canvas)] px-3 py-2 text-xs leading-5 text-[var(--sg-muted)]">
          방향 없는 관계 {undirectedCount}개는 그대로 유지됩니다.
        </p>
      ) : null}
    </aside>
  );
}

function RelationshipDirectionEditor({
  active,
  busy = false,
  draft,
  extraCount = 0,
  label,
  onDraftChange,
  onToggle,
}: RelationshipDirectionEditorProps) {
  return (
    <section className="rounded-[var(--sg-radius-sm)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-3.5">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold text-[var(--sg-ink)]">
          {label}
        </span>
        <span className="relative inline-flex shrink-0 items-center">
          <input
            aria-label={`${label} 활성화`}
            checked={active}
            className="peer sr-only"
            disabled={busy}
            onChange={(event) => onToggle(event.target.checked)}
            type="checkbox"
          />
          <span className="h-5 w-9 rounded-full border border-[var(--sg-line)] bg-[var(--sg-canvas)] transition-colors peer-checked:border-[var(--sg-brand)] peer-checked:bg-[var(--sg-brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--sg-focus)] peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />
          <span className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full border border-[var(--sg-line)] bg-[var(--sg-surface)] shadow-sm transition-transform peer-checked:translate-x-4 peer-checked:border-transparent" />
        </span>
      </label>

      {active && draft ? (
        <div className="mt-3 grid gap-3 border-t border-[var(--sg-line)] pt-3">
          <TextField
            label={`${label} 관계`}
            onChange={(event) => onDraftChange({ name: event.target.value })}
            value={draft.name}
          />
          <TextAreaField
            label={`${label} 설명`}
            onChange={(event) =>
              onDraftChange({ description: event.target.value })
            }
            rows={3}
            value={draft.description}
          />
          {extraCount > 0 ? (
            <p className="text-xs leading-5 text-[var(--sg-muted)]">
              같은 방향에 기존 관계가 {extraCount}개 더 있습니다. 현재 대표 관계를
              편집하고 있습니다.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-[var(--sg-muted)]">
          활성화하면 이 방향의 관계를 작성할 수 있습니다.
        </p>
      )}
    </section>
  );
}
