import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const geometry = vi.hoisted(() => ({
  bezier: vi.fn(() => ["M0 0 C 50 0 50 100 100 100", 50, 50]),
  smooth: vi.fn(() => ["M0 0 L 50 0 L 50 100 L 100 100", 50, 50]),
  straight: vi.fn(() => ["M0 0 L 100 100", 50, 50]),
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ id, path, markerEnd, style }: { id: string; path: string; markerEnd?: string; style?: Record<string, unknown> }) => (
    <div
      data-testid="base-edge"
      data-edge-id={id}
      data-marker-end={markerEnd ?? ""}
      data-path={path}
      data-stroke-width={String(style?.strokeWidth ?? "")}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  getBezierPath: geometry.bezier,
  getSmoothStepPath: geometry.smooth,
  getStraightPath: geometry.straight,
  MarkerType: { ArrowClosed: "arrowclosed" },
}));

import { StoryGraphEdge, type StoryGraphFlowEdge } from "./story-graph-edge";

function renderEdge(overrides: Partial<StoryGraphFlowEdge["data"]> = {}) {
  const data: NonNullable<StoryGraphFlowEdge["data"]> = {
    label: "친구라고 생각함",
    direction: "DIRECTED",
    routingType: "orthogonal",
    sourcePort: "right",
    targetPort: "left",
    waypoints: [],
    laneIndex: 1,
    laneCount: 3,
    visualState: "idle",
    presentation: {
      strokeColor: null,
      strokeWidth: null,
      strokeStyle: "solid",
      labelColor: null,
    },
    ...overrides,
  };

  render(
    <StoryGraphEdge
      {...({
        id: "edge-1",
        data,
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 100,
        sourcePosition: "right",
        targetPosition: "left",
        selected: false,
      } as never)}
    />,
  );
}

describe("StoryGraphEdge", () => {
  it.each([
    ["orthogonal", "smooth"],
    ["straight", "straight"],
    ["curved", "bezier"],
  ] as const)("uses the %s route geometry", (routingType, helper) => {
    renderEdge({ routingType });
    expect(geometry[helper]).toHaveBeenCalled();
    expect(screen.getByTestId("base-edge")).toHaveAttribute("data-edge-id", "edge-1");
  });

  it("renders a target arrow only for directed semantic relationships", () => {
    const { rerender } = render(
      <StoryGraphEdge
        {...({
          id: "edge-1",
          data: {
            label: "knows",
            direction: "DIRECTED",
            routingType: "orthogonal",
            sourcePort: "right",
            targetPort: "left",
            waypoints: [],
            laneIndex: 0,
            laneCount: 1,
            visualState: "idle",
            presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
          },
          sourceX: 0,
          sourceY: 0,
          targetX: 100,
          targetY: 0,
        } as never)}
      />,
    );
    expect(screen.getByTestId("base-edge")).toHaveAttribute("data-marker-end", "arrowclosed");

    rerender(
      <StoryGraphEdge
        {...({
          id: "edge-1",
          data: {
            label: "siblings",
            direction: "UNDIRECTED",
            routingType: "orthogonal",
            sourcePort: "right",
            targetPort: "left",
            waypoints: [],
            laneIndex: 0,
            laneCount: 1,
            visualState: "idle",
            presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
          },
          sourceX: 0,
          sourceY: 0,
          targetX: 100,
          targetY: 0,
        } as never)}
      />,
    );
    expect(screen.getByTestId("base-edge")).toHaveAttribute("data-marker-end", "");
  });

  it("renders the relationship label and deterministic lane offset", () => {
    renderEdge({ laneIndex: 2, laneCount: 3 });
    expect(screen.getByText("친구라고 생각함")).toBeInTheDocument();
    expect(screen.getByTestId("relationship-label")).toHaveAttribute("data-lane-offset", "18");
  });

  it.each([
    ["selected", "3"],
    ["secondary", "2"],
    ["dimmed", "1"],
  ] as const)("uses non-color emphasis for %s state", (visualState, expectedWidth) => {
    renderEdge({ visualState });
    expect(screen.getByTestId("base-edge")).toHaveAttribute("data-stroke-width", expectedWidth);
    expect(screen.getByTestId("relationship-label")).toHaveAttribute("data-visual-state", visualState);
  });
});
