"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
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

export type StoryGraphEdgeData = {
  label: string;
  direction: EdgeDirection;
  routingType: EdgeRouting["type"];
  sourcePort: ResolvedPort;
  targetPort: ResolvedPort;
  waypoints: EdgeRouting["waypoints"];
  laneIndex: number;
  laneCount: number;
  bundleExpanded?: boolean;
  visualState: RelationshipVisualState;
  presentation: EdgePresentation;
  onSelect?: (edgeId: string) => void;
};

export type StoryGraphFlowEdge = Edge<StoryGraphEdgeData, "storyGraph">;

const compactLaneGap = 18;
const expandedLaneGap = 28;

export function StoryGraphEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<StoryGraphFlowEdge>) {
  if (!data) return null;

  const laneOffset = getLaneOffset(
    data.laneIndex,
    data.laneCount,
    Boolean(data.bundleExpanded),
  );
  const offsetCoordinates = offsetEndpoints(
    sourceX,
    sourceY,
    targetX,
    targetY,
    laneOffset,
  );
  const [path, labelX, labelY] = getRoutePath({
    routingType: data.routingType,
    sourceX: offsetCoordinates.sourceX,
    sourceY: offsetCoordinates.sourceY,
    targetX: offsetCoordinates.targetX,
    targetY: offsetCoordinates.targetY,
    sourcePosition,
    targetPosition,
  });
  const strokeWidth = getStrokeWidth(
    data.visualState,
    data.presentation.strokeWidth,
  );
  const opacity =
    data.visualState === "dimmed"
      ? 0.2
      : data.visualState === "secondary"
        ? 0.65
        : 1;

  return (
    <>
      <BaseEdge
        id={id}
        markerEnd={
          data.direction === "DIRECTED" ? MarkerType.ArrowClosed : undefined
        }
        path={path}
        style={{
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
          aria-label={`관계 선택: ${data.label}`}
          className="nodrag nopan pointer-events-auto absolute cursor-pointer rounded border-0 bg-[var(--sg-surface)] px-1.5 py-0.5 text-xs font-medium text-[var(--sg-ink)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-focus)]"
          data-lane-offset={laneOffset}
          data-testid="relationship-label"
          data-visual-state={data.visualState}
          onClick={(event) => {
            event.stopPropagation();
            data.onSelect?.(id);
          }}
          style={{
            opacity,
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          type="button"
        >
          {data.label}
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export function getLaneOffset(
  laneIndex: number,
  laneCount: number,
  expanded = false,
) {
  if (laneCount <= 1) return 0;
  const laneGap = expanded ? expandedLaneGap : compactLaneGap;
  return (laneIndex - (laneCount - 1) / 2) * laneGap;
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

function offsetEndpoints(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  laneOffset: number,
) {
  if (!laneOffset) return { sourceX, sourceY, targetX, targetY };

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy) || 1;
  const offsetX = (-dy / length) * laneOffset;
  const offsetY = (dx / length) * laneOffset;

  return {
    sourceX: sourceX + offsetX,
    sourceY: sourceY + offsetY,
    targetX: targetX + offsetX,
    targetY: targetY + offsetY,
  };
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
