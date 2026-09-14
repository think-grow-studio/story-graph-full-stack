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
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

function edgeData(overrides: Record<string, unknown> = {}) {
  return {
    label: "좋아한다",
    direction: "DIRECTED" as const,
    routingType: "orthogonal" as const,
    sourcePort: "right" as const,
    targetPort: "left" as const,
    waypoints: [],
    laneIndex: 0,
    laneCount: 2,
    laneOrientation: "forward",
    visualState: "idle" as const,
    presentation,
    ...overrides,
  } as unknown as NonNullable<StoryGraphFlowEdge["data"]>;
}

function renderStoryEdge(
  data: NonNullable<StoryGraphFlowEdge["data"]>,
  overrides: Record<string, unknown> = {},
) {
  render(
    <StoryGraphEdge
      {...({
        id: "edge-a",
        data,
        sourceX: 0,
        sourceY: 0,
        targetX: 100,
        targetY: 0,
        sourcePosition: "right",
        targetPosition: "left",
        selected: false,
        ...overrides,
      } as never)}
    />,
  );
}

afterEach(() => {
  cleanup();
  mocks.baseEdgeProps = null;
  mocks.flowProps = null;
  mocks.smoothCalls.length = 0;
});

describe("directed relationship rendering regressions", () => {
  it("configures a React Flow marker for directed edges only", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("directed", "node-a", "node-b", "DIRECTED"),
          graphEdge("undirected", "node-a", "node-c", "UNDIRECTED"),
        ]}
        nodes={[
          { id: "node-a", name: "A", position: { x: 0, y: 0 }, width: 100, height: 80 },
          { id: "node-b", name: "B", position: { x: 200, y: 0 }, width: 100, height: 80 },
          { id: "node-c", name: "C", position: { x: 0, y: 200 }, width: 100, height: 80 },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const flowEdges = mocks.flowProps?.edges as Array<{
      id: string;
      markerEnd?: unknown;
    }>;
    expect(flowEdges.find((edge) => edge.id === "directed")?.markerEnd).toEqual({
      type: "arrowclosed",
    });
    expect(flowEdges.find((edge) => edge.id === "undirected")?.markerEnd).toBeUndefined();
  });

  it("forwards React Flow's resolved marker URL to BaseEdge", () => {
    renderStoryEdge(edgeData(), { markerEnd: "url(#react-flow-arrow)" });

    expect(mocks.baseEdgeProps?.markerEnd).toBe("url(#react-flow-arrow)");
  });

  it("keeps node handle endpoints exact while opposite directions occupy opposite lanes", () => {
    renderStoryEdge(edgeData({ laneIndex: 0, laneOrientation: "forward" }));
    const forwardCall = mocks.smoothCalls.at(-1);

    cleanup();
    renderStoryEdge(
      edgeData({
        label: "잊었다",
        laneIndex: 1,
        laneOrientation: "reverse",
        sourcePort: "left",
        targetPort: "right",
      }),
      {
        id: "edge-b",
        sourceX: 100,
        targetX: 0,
        sourcePosition: "left",
        targetPosition: "right",
      },
    );
    const reverseCall = mocks.smoothCalls.at(-1);

    expect(forwardCall).toMatchObject({ sourceX: 0, sourceY: 0, targetX: 100, targetY: 0 });
    expect(reverseCall).toMatchObject({ sourceX: 100, sourceY: 0, targetX: 0, targetY: 0 });

    const forwardCenterY = Number(forwardCall?.centerY);
    const reverseCenterY = Number(reverseCall?.centerY);
    expect(Number.isFinite(forwardCenterY)).toBe(true);
    expect(Number.isFinite(reverseCenterY)).toBe(true);
    expect(Math.sign(forwardCenterY)).toBe(-Math.sign(reverseCenterY));
  });
});
