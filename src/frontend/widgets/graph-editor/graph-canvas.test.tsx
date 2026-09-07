import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const flowMocks = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
}));

vi.mock("@xyflow/react", () => ({
  addEdge: (_connection: unknown, edges: unknown[]) => edges,
  applyNodeChanges: (_changes: unknown, nodes: unknown[]) => nodes,
  Background: () => null,
  ConnectionMode: { Loose: "loose" },
  Controls: () => null,
  Handle: () => null,
  MiniMap: () => null,
  Position: { Top: "top", Right: "right", Bottom: "bottom", Left: "left" },
  ReactFlow: (props: Record<string, unknown>) => {
    flowMocks.props = props;
    return <div aria-label="Flow renderer" />;
  },
  useReactFlow: () => ({
    screenToFlowPosition: (position: { x: number; y: number }) => position,
  }),
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

    const canvas = view.getByLabelText("Graph canvas");
    expect(canvas).toHaveClass("h-full", "min-h-[420px]");
    expect(canvas).not.toHaveClass("h-[560px]");
  });

  it("registers Story Graph custom Node/Edge types and loose connection mode", () => {
    render(
      <GraphCanvas
        edges={[]}
        nodes={[{ id: "node-1", name: "Alice", position: { x: 10, y: 20 } }]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    expect(flowMocks.props?.connectionMode).toBe("loose");
    expect(flowMocks.props?.nodeTypes).toMatchObject({ storyGraph: StoryGraphNode });
    expect(flowMocks.props?.edgeTypes).toMatchObject({ storyGraph: StoryGraphEdge });
    expect(flowMocks.props?.nodes).toEqual([
      expect.objectContaining({ id: "node-1", type: "storyGraph" }),
    ]);
  });

  it("projects parallel and bidirectional relationships into deterministic separate lanes", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("edge-b", "node-b", "node-a"),
          graphEdge("edge-a", "node-a", "node-b"),
        ]}
        nodes={[
          { id: "node-a", name: "A", position: { x: 0, y: 0 }, width: 100, height: 80 },
          { id: "node-b", name: "B", position: { x: 200, y: 0 }, width: 100, height: 80 },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const flowEdges = flowMocks.props?.edges as Array<Record<string, any>>;
    expect(flowEdges.map((edge) => edge.id)).toEqual(["edge-a", "edge-b"]);
    expect(flowEdges.map((edge) => edge.type)).toEqual(["storyGraph", "storyGraph"]);
    expect(flowEdges.map((edge) => [edge.data.laneIndex, edge.data.laneCount])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    expect(flowEdges[0]).toMatchObject({ sourceHandle: "right", targetHandle: "left" });
    expect(flowEdges[1]).toMatchObject({ sourceHandle: "left", targetHandle: "right" });
  });

  it("projects selected Edge focus with sibling secondary and unrelated relationships dimmed", () => {
    render(
      <GraphCanvas
        edges={[
          graphEdge("edge-a", "node-a", "node-b"),
          graphEdge("edge-b", "node-b", "node-a"),
          graphEdge("edge-c", "node-a", "node-c"),
        ]}
        nodes={[
          { id: "node-a", name: "A", position: { x: 0, y: 0 }, width: 100, height: 80 },
          { id: "node-b", name: "B", position: { x: 200, y: 0 }, width: 100, height: 80 },
          { id: "node-c", name: "C", position: { x: 0, y: 200 }, width: 100, height: 80 },
        ]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
        selectedEdgeId="edge-a"
      />,
    );

    const flowEdges = flowMocks.props?.edges as Array<Record<string, any>>;
    const stateById = Object.fromEntries(
      flowEdges.map((edge) => [edge.id, edge.data.visualState]),
    );
    expect(stateById).toEqual({
      "edge-a": "selected",
      "edge-b": "secondary",
      "edge-c": "dimmed",
    });
  });

  it("marks Node data active only while a connection gesture is in progress", () => {
    render(
      <GraphCanvas
        edges={[]}
        nodes={[{ id: "node-1", name: "Alice", position: { x: 10, y: 20 } }]}
        onConnectNodes={vi.fn()}
        onNodeDragStop={vi.fn()}
        onNodePositionChange={vi.fn()}
      />,
    );

    const getNodeData = () =>
      ((flowMocks.props?.nodes as Array<{ data: { connectionActive: boolean } }>)?.[0]
        ?.data);
    expect(getNodeData()?.connectionActive).toBe(false);

    act(() => {
      (flowMocks.props?.onConnectStart as (() => void) | undefined)?.();
    });
    expect(getNodeData()?.connectionActive).toBe(true);

    act(() => {
      (flowMocks.props?.onConnectEnd as (() => void) | undefined)?.();
    });
    expect(getNodeData()?.connectionActive).toBe(false);
  });

  it("preserves semantic source and target Node ids regardless of physical handles", () => {
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

    const onConnect = flowMocks.props?.onConnect as
      | ((connection: Record<string, unknown>) => void)
      | undefined;
    act(() => {
      onConnect?.({
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
        nodes={[{ id: "node-1", name: "Alice", position: { x: 10, y: 20 } }]}
        onConnectNodes={vi.fn()}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onNodePositionChange={onNodePositionChange}
      />,
    );

    const props = flowMocks.props;
    expect(props).not.toBeNull();
    const onStart = props?.onNodeDragStart as ((event: unknown, node: unknown) => void) | undefined;
    const onDrag = props?.onNodeDrag as ((event: unknown, node: unknown) => void) | undefined;
    const onStop = props?.onNodeDragStop as ((event: unknown, node: unknown) => void) | undefined;

    act(() => {
      onStart?.({}, { id: "node-1", position: { x: 10, y: 20 } });
      onDrag?.({}, { id: "node-1", position: { x: 30, y: 40 } });
      onStop?.({}, { id: "node-1", position: { x: 50, y: 60 } });
    });

    expect(onNodeDragStart).toHaveBeenCalledTimes(1);
    expect(onNodeDragStart).toHaveBeenCalledWith("node-1");
    expect(onNodePositionChange).toHaveBeenNthCalledWith(1, "node-1", {
      x: 30,
      y: 40,
    });
    expect(onNodePositionChange).toHaveBeenNthCalledWith(2, "node-1", {
      x: 50,
      y: 60,
    });
    expect(onNodeDragStop).toHaveBeenCalledTimes(1);
    expect(onNodeDragStop).toHaveBeenCalledWith("node-1");
  });
});
