import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const geometry = vi.hoisted(() => ({
  bezier: vi.fn(() => ["M0 0 C 50 0 50 100 100 100", 50, 50]),
  smooth: vi.fn(() => ["M0 0 L 50 0 L 50 100 L 100 100", 50, 50]),
  straight: vi.fn(() => ["M0 0 L 100 100", 50, 50]),
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({
    id,
    path,
    markerEnd,
    interactionWidth,
    style,
  }: {
    id: string;
    path: string;
    markerEnd?: string;
    interactionWidth?: number;
    style?: Record<string, unknown>;
  }) => (
    <div
      data-testid="base-edge"
      data-edge-id={id}
      data-interaction-width={String(interactionWidth ?? "")}
      data-marker-end={markerEnd ?? ""}
      data-path={path}
      data-stroke={String(style?.stroke ?? "")}
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type StoryGraphEdgeProps = Parameters<typeof StoryGraphEdge>[0];

function storyGraphEdgeProps(
  data: NonNullable<StoryGraphFlowEdge["data"]>,
  overrides: Partial<StoryGraphEdgeProps> = {},
): StoryGraphEdgeProps {
  return {
    id: "edge-1",
    data,
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "right",
    targetPosition: "left",
    selected: false,
    ...overrides,
  } as unknown as StoryGraphEdgeProps;
}

function renderEdge(
  overrides: Partial<StoryGraphFlowEdge["data"]> = {},
  propsOverrides: Partial<StoryGraphEdgeProps> = {},
) {
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

  render(<StoryGraphEdge {...storyGraphEdgeProps(data, propsOverrides)} />);
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
    const directed: NonNullable<StoryGraphFlowEdge["data"]> = {
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
    };
    const undirected: NonNullable<StoryGraphFlowEdge["data"]> = {
      ...directed,
      label: "siblings",
      direction: "UNDIRECTED",
    };

    const { rerender } = render(
      <StoryGraphEdge {...storyGraphEdgeProps(directed)} />,
    );
    expect(screen.getByTestId("base-edge")).toHaveAttribute("data-marker-end", "arrowclosed");

    rerender(<StoryGraphEdge {...storyGraphEdgeProps(undirected)} />);
    expect(screen.getByTestId("base-edge")).toHaveAttribute("data-marker-end", "");
  });

  it("renders the relationship label and deterministic lane offset", () => {
    renderEdge({ laneIndex: 2, laneCount: 3 });
    expect(screen.getByText("친구라고 생각함")).toBeInTheDocument();
    expect(screen.getByTestId("relationship-label")).toHaveAttribute("data-lane-offset", "18");
  });

  it("expands relationship bundle lanes when the bundle is active", () => {
    renderEdge({
      laneIndex: 2,
      laneCount: 3,
      bundleExpanded: true,
    } as unknown as Partial<StoryGraphFlowEdge["data"]>);

    expect(screen.getByTestId("relationship-label")).toHaveAttribute(
      "data-lane-offset",
      "28",
    );
  });

  it("forwards a wider interaction area so hover remains stable while lanes expand", () => {
    renderEdge({}, { interactionWidth: 48 });
    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-interaction-width",
      "48",
    );
  });

  it("exposes the relationship label as an explicit selection surface", () => {
    const onSelect = vi.fn();
    renderEdge({ onSelect } as unknown as Partial<StoryGraphFlowEdge["data"]>);

    const selectionSurface = screen.getByRole("button", {
      name: "관계 선택: 친구라고 생각함",
    });
    fireEvent.click(selectionSurface);

    expect(onSelect).toHaveBeenCalledWith("edge-1");
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

  it("uses durable Story Graph tokens for default stroke and keyboard focus", () => {
    renderEdge();

    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-stroke",
      "var(--sg-brand)",
    );
    const label = screen.getByRole("button", {
      name: "관계 선택: 친구라고 생각함",
    });
    expect(label).toHaveClass("focus-visible:ring-[color:var(--sg-focus)]");
    expect(label.className).not.toContain("--sg-accent");
  });
});
