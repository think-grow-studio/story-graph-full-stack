import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const flowMocks = vi.hoisted(() => ({
  props: null as null | Record<string, (...args: unknown[]) => unknown>,
}));

vi.mock("@xyflow/react", () => ({
  addEdge: (_connection: unknown, edges: unknown[]) => edges,
  applyNodeChanges: (_changes: unknown, nodes: unknown[]) => nodes,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlow: (props: Record<string, (...args: unknown[]) => unknown>) => {
    flowMocks.props = props;
    return <div aria-label="Graph canvas" />;
  },
  useReactFlow: () => ({
    screenToFlowPosition: (position: { x: number; y: number }) => position,
  }),
}));

import { GraphCanvas } from "./graph-canvas";

describe("GraphCanvas drag lifecycle", () => {
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

    act(() => {
      props?.onNodeDragStart?.({}, { id: "node-1", position: { x: 10, y: 20 } });
      props?.onNodeDrag?.({}, { id: "node-1", position: { x: 30, y: 40 } });
      props?.onNodeDragStop?.({}, { id: "node-1", position: { x: 50, y: 60 } });
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
