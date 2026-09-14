import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const flowMocks = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}));

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  ConnectionMode: { Loose: "loose" },
  Controls: () => null,
  Handle: () => null,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  ReactFlow: (props: Record<string, unknown>) => {
    flowMocks.props = props;
    return <div aria-label="Flow renderer" />;
  },
}));

vi.mock("./story-graph-edge", () => ({
  StoryGraphEdge: () => null,
}));

import { StoryGraphNode } from "./story-graph-node";
import { StoryGraphEdge } from "./story-graph-edge";
import { GraphCanvas } from "./graph-canvas";

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
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name: id,
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
    ...overrides,
  };
}

type FlowEdgeSnapshot = {
  id: string;
  type: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  markerStart?: unknown;
  markerEnd?: unknown;
  data: {
    relationships: Array<{
      id: string;
      label: string;
      sourceLabel: string;
      targetLabel: string;
      direction: string;
      orientation: string;
    }>;
    popoverOpen: boolean;
    visualState: string;
    onSelectPair?: () => void;
    onRequestOpen?: () => void;
    onRequestClose?: () => void;
  };
};

type DragNodeSnapshot = {
  id: string;
  position: { x: number; y: number };
};

const nodes = [
  {
    id: "node-a",
    name: "Alice",
    position: { x: 0, y: 0 },
    width: 100,
    height: 80,
  },
  {
    id: "node-b",
    name: "Bob",
    position: { x: 200, y: 0 },
    width: 100,
    height: 80,
  },
  {
    id: "node-c",
    name: "Carol",
    position: { x: 0, y: 200 },
    width: 100,
    height: 80,
  },
];

describe("GraphCanvas", () => {
  it("uses the available editor height with a sensible minimum", () => {
    const view = render(
      <GraphCanvas
        edges={[]}
        nodes={[]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    expect(view.getByLabelText("Graph canvas")).toHaveClass(
      "h-full",
      "min-h-[420px]",
    );
  });

  it("registers Story Graph custom Node/Edge types and loose connection mode", () => {
    render(
      <GraphCanvas
        edges={[]}
        nodes={[nodes[0]]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    expect(flowMocks.props?.connectionMode).toBe("loose");
    expect(flowMocks.props?.nodeTypes).toMatchObject({ storyGraph: StoryGraphNode });
    expect(flowMocks.props?.edgeTypes).toMatchObject({ storyGraph: StoryGraphEdge });
  });

  it("projects one shared rail for opposite and parallel semantic Relationships", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("edge-a", "node-a", "node-b", { name: "좋아한다" }),
          graphEdge("edge-b", "node-b", "node-a", { name: "잊었다" }),
          graphEdge("edge-c", "node-a", "node-b", { name: "함께 여행함" }),
        ]}
        nodes={nodes}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const flowEdges = flowMocks.props?.edges as FlowEdgeSnapshot[];
    expect(flowEdges).toHaveLength(1);
    expect(flowEdges[0]).toMatchObject({
      id: "node-a:node-b",
      type: "storyGraph",
      source: "node-a",
      target: "node-b",
      sourceHandle: "right",
      targetHandle: "left",
      markerStart: { type: "arrowclosed" },
      markerEnd: { type: "arrowclosed" },
    });
    expect(flowEdges[0]?.data.relationships).toEqual([
      {
        id: "edge-a",
        label: "좋아한다",
        sourceLabel: "Alice",
        targetLabel: "Bob",
        direction: "DIRECTED",
        orientation: "forward",
      },
      {
        id: "edge-c",
        label: "함께 여행함",
        sourceLabel: "Alice",
        targetLabel: "Bob",
        direction: "DIRECTED",
        orientation: "forward",
      },
      {
        id: "edge-b",
        label: "잊었다",
        sourceLabel: "Bob",
        targetLabel: "Alice",
        direction: "DIRECTED",
        orientation: "reverse",
      },
    ]);
  });

  it("only adds endpoint arrows for directed meanings that exist", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("forward", "node-a", "node-b"),
          graphEdge("undirected", "node-b", "node-a", {
            direction: "UNDIRECTED",
          }),
        ]}
        nodes={nodes}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const [rail] = flowMocks.props?.edges as FlowEdgeSnapshot[];
    expect(rail?.markerStart).toBeUndefined();
    expect(rail?.markerEnd).toEqual({ type: "arrowclosed" });
  });

  it("projects semantic Edge focus onto the shared rail", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("edge-a", "node-a", "node-b"),
          graphEdge("edge-b", "node-b", "node-a"),
          graphEdge("edge-c", "node-a", "node-c"),
        ]}
        nodes={nodes}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
        selectedEdgeId="edge-a"
      />,
    );

    const flowEdges = flowMocks.props?.edges as FlowEdgeSnapshot[];
    expect(
      Object.fromEntries(
        flowEdges.map((edge) => [edge.id, edge.data.visualState]),
      ),
    ).toEqual({
      "node-a:node-b": "selected",
      "node-a:node-c": "dimmed",
    });
  });

  it("selects the relationship pair on rail click and clears it on pane click", () => {
    const onClearSelection = vi.fn();
    const onSelectEdge = vi.fn();
    render(
      <GraphCanvas
        edges={[graphEdge("edge-a", "node-a", "node-b")]}
        nodes={nodes}
        onClearSelection={onClearSelection}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
        onSelectEdge={onSelectEdge}
      />,
    );

    const [rail] = flowMocks.props?.edges as FlowEdgeSnapshot[];
    expect(rail?.data.popoverOpen).toBe(false);

    act(() => {
      (
        flowMocks.props?.onEdgeClick as
          | ((event: unknown, edge: FlowEdgeSnapshot) => void)
          | undefined
      )?.({}, rail!);
    });

    expect(onSelectEdge).toHaveBeenCalledWith("edge-a");

    act(() => {
      (flowMocks.props?.onPaneClick as (() => void) | undefined)?.();
    });

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("preserves semantic source and target Node ids for new connections", () => {
    const onConnectNodes = vi.fn();
    render(
      <GraphCanvas
        edges={[]}
        nodes={[]}
        onConnectNodes={onConnectNodes}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    act(() => {
      (
        flowMocks.props?.onConnect as
          | ((connection: Record<string, unknown>) => void)
          | undefined
      )?.({
        source: "node-a",
        target: "node-b",
        sourceHandle: "top",
        targetHandle: "left",
      });
    });

    expect(onConnectNodes).toHaveBeenCalledWith("node-a", "node-b");
  });

  it("forwards drag start once while drag frames remain working-state only", () => {
    const onNodeDragStart = vi.fn();
    const onNodePositionChange = vi.fn();
    const onNodeDragStop = vi.fn();
    render(
      <GraphCanvas
        edges={[]}
        nodes={[nodes[0]]}
        onConnectNodes={vi.fn()}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodePositionChange={onNodePositionChange}
      />,
    );

    act(() => {
      (
        flowMocks.props?.onNodeDragStart as
          | ((event: unknown, node: DragNodeSnapshot) => void)
          | undefined
      )?.({}, { id: "node-a", position: { x: 0, y: 0 } });
      (
        flowMocks.props?.onNodeDrag as
          | ((event: unknown, node: DragNodeSnapshot) => void)
          | undefined
      )?.({}, { id: "node-a", position: { x: 20, y: 30 } });
      (
        flowMocks.props?.onNodeDragStop as
          | ((event: unknown, node: DragNodeSnapshot) => void)
          | undefined
      )?.({}, { id: "node-a", position: { x: 40, y: 50 } });
    });

    expect(onNodeDragStart).toHaveBeenCalledWith("node-a");
    expect(onNodePositionChange).toHaveBeenNthCalledWith(1, "node-a", {
      x: 20,
      y: 30,
    });
    expect(onNodePositionChange).toHaveBeenNthCalledWith(2, "node-a", {
      x: 40,
      y: 50,
    });
    expect(onNodeDragStop).toHaveBeenCalledWith("node-a");
  });
});