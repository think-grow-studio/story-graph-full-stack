import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flowProps: null as null | Record<string, unknown>,
}));

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  BaseEdge: ({
    markerStart,
    markerEnd,
  }: {
    markerStart?: string;
    markerEnd?: string;
  }) => (
    <div
      data-testid="base-edge"
      data-marker-start={markerStart ?? ""}
      data-marker-end={markerEnd ?? ""}
    />
  ),
  ConnectionMode: { Loose: "loose" },
  Controls: () => null,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Handle: () => null,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  ReactFlow: (props: Record<string, unknown>) => {
    mocks.flowProps = props;
    return <div aria-label="Flow renderer" />;
  },
  getBezierPath: vi.fn(() => ["M0 0 C 25 0 75 0 100 0", 50, 0]),
  getSmoothStepPath: vi.fn(() => ["M0 0 L 100 0", 50, 0]),
  getStraightPath: vi.fn(() => ["M0 0 L 100 0", 50, 0]),
}));

import { GraphCanvas } from "./graph-canvas";
import { StoryGraphEdge, type StoryGraphFlowEdge } from "./story-graph-edge";

const presentation = {
  strokeColor: null,
  strokeWidth: null,
  strokeStyle: "solid" as const,
  labelColor: null,
};

function graphEdge(
  id: string,
  name: string,
  sourceNodeId: string,
  targetNodeId: string,
) {
  return {
    id,
    name,
    sourceNodeId,
    targetNodeId,
    direction: "DIRECTED" as const,
    presentation,
    routing: {
      type: "orthogonal" as const,
      sourcePort: "auto" as const,
      targetPort: "auto" as const,
      waypoints: [],
    },
  };
}

describe("shared relationship rail", () => {
  it("projects one visual rail for an unordered Node pair and exposes direction at both ends", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("edge-a", "좋아한다", "node-a", "node-b"),
          graphEdge("edge-b", "잊었다", "node-b", "node-a"),
        ]}
        nodes={[
          {
            id: "node-a",
            name: "피터 파커",
            position: { x: 0, y: 0 },
            width: 100,
            height: 80,
          },
          {
            id: "node-b",
            name: "MJ",
            position: { x: 240, y: 0 },
            width: 100,
            height: 80,
          },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const flowEdges = mocks.flowProps?.edges as Array<{
      source: string;
      target: string;
      markerStart?: unknown;
      markerEnd?: unknown;
      data: {
        relationships: Array<{
          id: string;
          label: string;
          orientation: string;
        }>;
      };
    }>;

    expect(flowEdges).toHaveLength(1);
    expect(flowEdges[0]).toMatchObject({
      source: "node-a",
      target: "node-b",
      markerStart: { type: "arrowclosed" },
      markerEnd: { type: "arrowclosed" },
    });
    expect(flowEdges[0]?.data.relationships).toEqual([
      expect.objectContaining({
        id: "edge-a",
        label: "좋아한다",
        orientation: "forward",
      }),
      expect.objectContaining({
        id: "edge-b",
        label: "잊었다",
        orientation: "reverse",
      }),
    ]);
  });

  it("keeps the relationship summary visible on the single rail", () => {
    const data = {
      relationships: [
        {
          id: "edge-a",
          label: "좋아한다",
          sourceLabel: "피터 파커",
          targetLabel: "MJ",
          direction: "DIRECTED" as const,
          orientation: "forward" as const,
        },
        {
          id: "edge-b",
          label: "잊었다",
          sourceLabel: "MJ",
          targetLabel: "피터 파커",
          direction: "DIRECTED" as const,
          orientation: "reverse" as const,
        },
      ],
      pairLabel: "피터 파커와 MJ",
      popoverOpen: false,
      routingType: "orthogonal" as const,
      sourcePort: "right" as const,
      targetPort: "left" as const,
      waypoints: [],
      visualState: "idle" as const,
      presentation,
    } as unknown as NonNullable<StoryGraphFlowEdge["data"]>;

    render(
      <StoryGraphEdge
        {...({
          id: "node-a:node-b",
          data,
          sourceX: 0,
          sourceY: 0,
          targetX: 100,
          targetY: 0,
          sourcePosition: "right",
          targetPosition: "left",
          selected: false,
          markerStart: "url(#start)",
          markerEnd: "url(#end)",
        } as unknown as Parameters<typeof StoryGraphEdge>[0])}
      />,
    );

    expect(screen.getByText("→ 좋아한다")).toBeVisible();
    expect(screen.getByText("← 잊었다")).toBeVisible();
  });

  it("selects the representative Relationship when the single rail is clicked", () => {
    const onSelectEdge = vi.fn();
    render(
      <GraphCanvas
        edges={[graphEdge("edge-a", "좋아한다", "node-a", "node-b")]}
        nodes={[
          { id: "node-a", name: "피터 파커", position: { x: 0, y: 0 } },
          { id: "node-b", name: "MJ", position: { x: 240, y: 0 } },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
        onSelectEdge={onSelectEdge}
      />,
    );

    const onEdgeClick = mocks.flowProps?.onEdgeClick as
      | ((event: unknown, edge: StoryGraphFlowEdge) => void)
      | undefined;
    const edge = (mocks.flowProps?.edges as StoryGraphFlowEdge[])[0];
    expect(onEdgeClick).toBeTypeOf("function");
    onEdgeClick?.({}, edge);

    expect(onSelectEdge).toHaveBeenCalledWith("edge-a");
  });
});