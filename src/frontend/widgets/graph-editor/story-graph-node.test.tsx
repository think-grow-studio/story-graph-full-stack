import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: ({ id, position }: { id: string; position: string }) => (
    <div data-testid="graph-port" data-port-id={id} data-position={position} />
  ),
  Position: {
    Top: "top",
    Right: "right",
    Bottom: "bottom",
    Left: "left",
  },
}));

import { StoryGraphNode } from "./story-graph-node";

describe("StoryGraphNode", () => {
  it("renders four stable magnetic connection ports", () => {
    render(
      <StoryGraphNode
        {...({
          id: "node-1",
          data: { label: "Alice" },
          selected: false,
        } as never)}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    const ports = screen.getAllByTestId("graph-port");
    expect(ports).toHaveLength(4);
    expect(ports.map((port) => port.getAttribute("data-port-id"))).toEqual([
      "top",
      "right",
      "bottom",
      "left",
    ]);
    expect(ports.map((port) => port.getAttribute("data-position"))).toEqual([
      "top",
      "right",
      "bottom",
      "left",
    ]);
  });
});
