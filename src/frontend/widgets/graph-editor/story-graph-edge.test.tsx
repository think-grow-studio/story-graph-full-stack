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
    markerStart,
    markerEnd,
    interactionWidth,
    style,
  }: {
    id: string;
    markerStart?: string;
    markerEnd?: string;
    interactionWidth?: number;
    style?: Record<string, unknown>;
  }) => (
    <div
      data-testid="base-edge"
      data-edge-id={id}
      data-interaction-width={String(interactionWidth ?? "")}
      data-marker-start={markerStart ?? ""}
      data-marker-end={markerEnd ?? ""}
      data-stroke={String(style?.stroke ?? "")}
      data-stroke-width={String(style?.strokeWidth ?? "")}
    />
  ),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  getBezierPath: geometry.bezier,
  getSmoothStepPath: geometry.smooth,
  getStraightPath: geometry.straight,
}));

import { StoryGraphEdge, type StoryGraphFlowEdge } from "./story-graph-edge";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type StoryGraphEdgeProps = Parameters<typeof StoryGraphEdge>[0];

function edgeData(
  overrides: Partial<NonNullable<StoryGraphFlowEdge["data"]>> = {},
): NonNullable<StoryGraphFlowEdge["data"]> {
  return {
    relationships: [
      {
        id: "edge-a",
        label: "좋아한다",
        sourceLabel: "피터 파커",
        targetLabel: "MJ",
        direction: "DIRECTED",
      },
      {
        id: "edge-b",
        label: "잊었다",
        sourceLabel: "MJ",
        targetLabel: "피터 파커",
        direction: "DIRECTED",
      },
    ],
    pairLabel: "피터 파커와 MJ",
    popoverOpen: false,
    selectedRelationshipId: null,
    routingType: "orthogonal",
    sourcePort: "right",
    targetPort: "left",
    waypoints: [],
    visualState: "idle",
    presentation: {
      strokeColor: null,
      strokeWidth: null,
      strokeStyle: "solid",
      labelColor: null,
    },
    ...overrides,
  };
}

function edgeProps(
  data: NonNullable<StoryGraphFlowEdge["data"]>,
  overrides: Partial<StoryGraphEdgeProps> = {},
): StoryGraphEdgeProps {
  return {
    id: "node-a:node-b",
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

describe("StoryGraphEdge", () => {
  it.each([
    ["orthogonal", "smooth"],
    ["straight", "straight"],
    ["curved", "bezier"],
  ] as const)("uses the %s route geometry", (routingType, helper) => {
    render(<StoryGraphEdge {...edgeProps(edgeData({ routingType }))} />);

    expect(geometry[helper]).toHaveBeenCalled();
    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-edge-id",
      "node-a:node-b",
    );
  });

  it("forwards both resolved endpoint marker URLs to BaseEdge", () => {
    render(
      <StoryGraphEdge
        {...edgeProps(edgeData(), {
          markerStart: "url(#reverse-arrow)",
          markerEnd: "url(#forward-arrow)",
        })}
      />,
    );

    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-marker-start",
      "url(#reverse-arrow)",
    );
    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-marker-end",
      "url(#forward-arrow)",
    );
  });

  it("keeps Relationship names off the canvas while the card is closed", () => {
    render(<StoryGraphEdge {...edgeProps(edgeData())} />);

    expect(screen.queryByTestId("relationship-card")).not.toBeInTheDocument();
    expect(screen.queryByText("좋아한다")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "피터 파커와 MJ 관계 보기" })).toBeVisible();
  });

  it("shows semantic direction and names together in the open card", () => {
    render(<StoryGraphEdge {...edgeProps(edgeData({ popoverOpen: true }))} />);

    expect(screen.getByText("관계 2개")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "피터 파커 → MJ: 좋아한다" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "MJ → 피터 파커: 잊었다" }),
    ).toBeVisible();
  });

  it("selects a semantic Relationship from the card and dismisses the card", () => {
    const onSelectRelationship = vi.fn();
    const onDismiss = vi.fn();
    render(
      <StoryGraphEdge
        {...edgeProps(
          edgeData({ popoverOpen: true, onSelectRelationship, onDismiss }),
        )}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "MJ → 피터 파커: 잊었다" }),
    );

    expect(onSelectRelationship).toHaveBeenCalledWith("edge-b");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("opens from keyboard focus, pins from click, and dismisses with Escape", () => {
    const onRequestOpen = vi.fn();
    const onTogglePinned = vi.fn();
    const onDismiss = vi.fn();
    render(
      <StoryGraphEdge
        {...edgeProps(
          edgeData({ onRequestOpen, onTogglePinned, onDismiss }),
        )}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "피터 파커와 MJ 관계 보기",
    });
    fireEvent.focus(trigger);
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(onRequestOpen).toHaveBeenCalled();
    expect(onTogglePinned).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveClass("focus-visible:ring-[color:var(--sg-focus)]");
  });

  it("forwards a wide interaction target for stable rail hover", () => {
    render(
      <StoryGraphEdge
        {...edgeProps(edgeData(), { interactionWidth: 48 })}
      />,
    );

    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-interaction-width",
      "48",
    );
  });

  it.each([
    ["selected", "3"],
    ["secondary", "2"],
    ["dimmed", "1"],
  ] as const)("uses non-color emphasis for %s state", (visualState, expectedWidth) => {
    render(
      <StoryGraphEdge
        {...edgeProps(edgeData({ visualState }))}
      />,
    );

    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-stroke-width",
      expectedWidth,
    );
  });

  it("uses durable Story Graph tokens for the default rail stroke", () => {
    render(<StoryGraphEdge {...edgeProps(edgeData())} />);

    expect(screen.getByTestId("base-edge")).toHaveAttribute(
      "data-stroke",
      "var(--sg-brand)",
    );
  });
});
