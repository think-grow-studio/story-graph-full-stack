"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type EdgeProps,
  type Position,
} from "@xyflow/react";
import type {
  EdgeDirection,
  EdgePresentation,
  EdgeRouting,
} from "@/contracts/graph/graph.contract";
import type { ResolvedPort } from "@/frontend/features/graph-editor/model/port-resolver";

export type RelationshipVisualState =
  | "idle"
  | "selected"
  | "secondary"
  | "dimmed";

export type RelationshipRailItem = {
  id: string;
  label: string;
  sourceLabel: string;
  targetLabel: string;
  direction: EdgeDirection;
};

export type StoryGraphEdgeData = {
  relationships: RelationshipRailItem[];
  pairLabel: string;
  popoverOpen: boolean;
  selectedRelationshipId?: string | null;
  routingType: EdgeRouting["type"];
  sourcePort: ResolvedPort;
  targetPort: ResolvedPort;
  waypoints: EdgeRouting["waypoints"];
  visualState: RelationshipVisualState;
  presentation: EdgePresentation;
  onSelectRelationship?: (edgeId: string) => void;
  onRequestOpen?: () => void;
  onRequestClose?: () => void;
  onTogglePinned?: () => void;
  onDismiss?: () => void;
};

export type StoryGraphFlowEdge = Edge<StoryGraphEdgeData, "storyGraph">;

export function StoryGraphEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  interactionWidth,
  markerStart,
  markerEnd,
}: EdgeProps<StoryGraphFlowEdge>) {
  if (!data) return null;

  const [path, labelX, labelY] = getRoutePath({
    routingType: data.routingType,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const baseStrokeWidth = getStrokeWidth(
    data.visualState,
    data.presentation.strokeWidth,
  );
  const strokeWidth = data.popoverOpen
    ? Math.max(baseStrokeWidth, 2)
    : baseStrokeWidth;
  const opacity =
    data.visualState === "dimmed"
      ? 0.2
      : data.visualState === "secondary"
        ? 0.65
        : 1;
  const firstRelationship = data.relationships[0];
  const pairLabel =
    data.pairLabel ||
    (firstRelationship
      ? `${firstRelationship.sourceLabel}와 ${firstRelationship.targetLabel}`
      : "관계");

  return (
    <>
      <BaseEdge
        id={id}
        interactionWidth={interactionWidth}
        markerEnd={markerEnd}
        markerStart={markerStart}
        path={path}
        style={{
          cursor: "pointer",
          opacity,
          stroke: data.presentation.strokeColor ?? "var(--sg-brand)",
          strokeDasharray:
            data.presentation.strokeStyle === "dashed"
              ? "8 5"
              : data.presentation.strokeStyle === "dotted"
                ? "2 5"
                : undefined,
          strokeWidth,
        }}
      />

      <EdgeLabelRenderer>
        <button
          aria-label={`${pairLabel} 관계 보기`}
          className="nodrag nopan pointer-events-auto absolute h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sg-surface)]"
          data-testid="relationship-rail-trigger"
          data-visual-state={data.visualState}
          onBlur={data.onRequestClose}
          onClick={(event) => {
            event.stopPropagation();
            data.onTogglePinned?.();
          }}
          onFocus={data.onRequestOpen}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            data.onDismiss?.();
          }}
          onPointerEnter={data.onRequestOpen}
          onPointerLeave={data.onRequestClose}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          type="button"
        >
          <span className="sr-only">관계 보기</span>
        </button>

        {data.popoverOpen ? (
          <div
            aria-label={`${pairLabel} 관계`}
            className="nodrag nopan pointer-events-auto absolute w-[min(300px,calc(100vw-32px))] overflow-hidden rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] shadow-[0_10px_30px_rgba(23,25,29,0.12)]"
            data-testid="relationship-card"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              data.onDismiss?.();
            }}
            onPointerEnter={data.onRequestOpen}
            onPointerLeave={data.onRequestClose}
            role="region"
            style={{
              opacity,
              transform: `translate(-50%, calc(-100% - 14px)) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <div className="border-b border-[var(--sg-line)] px-3 py-2 text-[11px] font-medium text-[var(--sg-muted)]">
              관계 {data.relationships.length}개
            </div>
            <div className="grid p-1.5">
              {data.relationships.map((relationship) => {
                const selected =
                  relationship.id === data.selectedRelationshipId;
                const directionSymbol =
                  relationship.direction === "DIRECTED" ? "→" : "—";
                const accessibleLabel = `${relationship.sourceLabel} ${directionSymbol} ${relationship.targetLabel}: ${relationship.label}`;

                return (
                  <button
                    aria-label={accessibleLabel}
                    className={`cursor-pointer rounded-[var(--sg-radius-sm)] px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-focus)] ${
                      selected
                        ? "bg-[var(--sg-canvas)]"
                        : "bg-transparent hover:bg-[var(--sg-canvas)]"
                    }`}
                    data-relationship-id={relationship.id}
                    data-selected={selected ? "true" : "false"}
                    key={relationship.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onSelectRelationship?.(relationship.id);
                      data.onDismiss?.();
                    }}
                    type="button"
                  >
                    <span className="block truncate text-xs font-medium text-[var(--sg-muted)]">
                      {relationship.sourceLabel}
                      <span
                        aria-hidden="true"
                        className="mx-1.5 text-[var(--sg-brand-strong)]"
                      >
                        {directionSymbol}
                      </span>
                      {relationship.targetLabel}
                    </span>
                    <span className="mt-1 block text-sm font-semibold leading-5 text-[var(--sg-ink)]">
                      {relationship.label || "이름 없는 관계"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}

function getStrokeWidth(
  visualState: RelationshipVisualState,
  persistedWidth: number | null,
) {
  if (visualState === "selected") return 3;
  if (visualState === "secondary") return 2;
  if (visualState === "dimmed") return 1;
  return persistedWidth ?? 1.5;
}

function getRoutePath({
  routingType,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: {
  routingType: EdgeRouting["type"];
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}): [string, number, number] {
  if (routingType === "straight") {
    const [path, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    return [path, labelX, labelY];
  }

  if (routingType === "curved") {
    const [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
    return [path, labelX, labelY];
  }

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });
  return [path, labelX, labelY];
}
