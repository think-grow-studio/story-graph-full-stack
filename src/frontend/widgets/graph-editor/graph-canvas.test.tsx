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

import { StoryGraphNode } from "./story-graph-node";
import { GraphCanvas } from "./graph-canvas";

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

  it("registers the Story Graph custom Node and loose connection mode", () => {
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
    expect(flowMocks.props?.nodes).toEqual([
      expect.objectContaining({ id: "node-1", type: "storyGraph" }),
    ]);
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
