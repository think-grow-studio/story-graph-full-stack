import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  baseEdgeProps: null as null | Record<string, unknown>,
  flowProps: null as null | Record<string, unknown>,
  smoothCalls: [] as Record<string, unknown>[],
}));

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  BaseEdge: (props: Record<string, unknown>) => {
    mocks.baseEdgeProps = props;
    return <div data-testid="base-edge" />;
  },
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
  getSmoothStepPath: vi.fn((options: Record<string, unknown>) => {
    mocks.smoothCalls.push(options);
    return ["M0 0 L 100 0", 50, 0];
  }),
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
  sourceNodeId: string,
  targetNodeId: string,
  direction: "DIRECTED" | "UNDIRECTED" = "DIRECTED",
) {
  return {
    id,
    name: id,
    sourceNodeId,
    targetNodeId,
    direction,
    presentation,
    routing: {
      type: "orthogonal" as const,
      sourcePort: "auto" as const,
      targetPort: "auto" as const,
      waypoints: [],
    },
  };
}

function railData(): NonNullable<StoryGraphFlowEdge["data"]> {
  return {
    relationships: [
      {
        id: "edge-a",
        label: "좋아한다",
        sourceLabel: "A",
        targetLabel: "B",
        direction: "DIRECTED",
        orientation: "forward",
      },
    ],
    pairLabel: "A와 B",
    popoverOpen: false,
    selectedRelationshipId: null,
    routingType: "orthogonal",
    sourcePort: "right",
    targetPort: "left",
    waypoints: [],
    visualState: "idle",
    presentation,
  };
}

afterEach(() => {
  cleanup();
  mocks.baseEdgeProps = null;
  mocks.flowProps = null;
  mocks.smoothCalls.length = 0;
});

describe("relationship rail direction rendering", () => {
  it("summarizes opposite directed Relationships as arrows at both rail endpoints", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("forward", "node-a", "node-b"),
          graphEdge("reverse", "node-b", "node-a"),
        ]}
        nodes={[
          {
            id: "node-a",
            name: "A",
            position: { x: 0, y: 0 },
            width: 100,
            height: 80,
          },
          {
            id: "node-b",
            name: "B",
            position: { x: 200, y: 0 },
            width: 100,
            height: 80,
          },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const rails = mocks.flowProps?.edges as Array<{
      markerStart?: unknown;
      markerEnd?: unknown;
    }>;
    expect(rails).toHaveLength(1);
    expect(rails[0]).toMatchObject({
      markerStart: { type: "arrowclosed" },
      markerEnd: { type: "arrowclosed" },
    });
  });

  it("keeps an undirected meaning from inventing an arrow", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("forward", "node-a", "node-b", "DIRECTED"),
          graphEdge("undirected", "node-b", "node-a", "UNDIRECTED"),
        ]}
        nodes={[
          {
            id: "node-a",
            name: "A",
            position: { x: 0, y: 0 },
            width: 100,
            height: 80,
          },
          {
            id: "node-b",
            name: "B",
            position: { x: 200, y: 0 },
            width: 100,
            height: 80,
          },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const [rail] = mocks.flowProps?.edges as Array<{
      markerStart?: unknown;
      markerEnd?: unknown;
    }>;
    expect(rail?.markerStart).toBeUndefined();
    expect(rail?.markerEnd).toEqual({ type: "arrowclosed" });
  });

  it("forwards React Flow's resolved start and end marker URLs to BaseEdge", () => {
    render(
      <StoryGraphEdge
        {...({
          id: "node-a:node-b",
          data: railData(),
          sourceX: 0,
          sourceY: 0,
          targetX: 100,
          targetY: 0,
          sourcePosition: "right",
          targetPosition: "left",
          selected: false,
          markerStart: "url(#reverse-arrow)",
          markerEnd: "url(#forward-arrow)",
        } as unknown as Parameters<typeof StoryGraphEdge>[0])}
      />,
    );

    expect(mocks.baseEdgeProps?.markerStart).toBe("url(#reverse-arrow)");
    expect(mocks.baseEdgeProps?.markerEnd).toBe("url(#forward-arrow)");
  });

  it("keeps the exact node handle endpoints with no lane displacement", () => {
    render(
      <StoryGraphEdge
        {...({
          id: "node-a:node-b",
          data: railData(),
          sourceX: 0,
          sourceY: 12,
          targetX: 100,
          targetY: 12,
          sourcePosition: "right",
          targetPosition: "left",
          selected: false,
        } as unknown as Parameters<typeof StoryGraphEdge>[0])}
      />,
    );

    expect(mocks.smoothCalls.at(-1)).toMatchObject({
      sourceX: 0,
      sourceY: 12,
      targetX: 100,
      targetY: 12,
    });
    expect(mocks.smoothCalls.at(-1)).not.toHaveProperty("centerX");
    expect(mocks.smoothCalls.at(-1)).not.toHaveProperty("centerY");
  });
});