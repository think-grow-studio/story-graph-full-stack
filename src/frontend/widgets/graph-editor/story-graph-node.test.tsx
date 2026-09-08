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
    const props = {
      id: "node-1",
      data: { label: "Alice" },
      selected: false,
    } as unknown as Parameters<typeof StoryGraphNode>[0];

    render(<StoryGraphNode {...props} />);

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

  it("uses durable graph tokens and non-color structure for selected and connection-target states", () => {
    const selectedProps = {
      id: "node-1",
      data: { label: "Alice", connectionActive: false },
      selected: true,
    } as unknown as Parameters<typeof StoryGraphNode>[0];

    const { rerender } = render(<StoryGraphNode {...selectedProps} />);
    const selectedNode = screen.getByText("Alice").parentElement;

    expect(screen.getByText("Alice")).toHaveClass("text-[var(--sg-ink)]");
    expect(selectedNode).toHaveClass("border-[var(--sg-brand)]", "ring-2");
    expect(selectedNode?.className).not.toContain("--sg-accent");
    expect(selectedNode?.className).not.toContain("--sg-text");

    rerender(
      <StoryGraphNode
        {...({
          ...selectedProps,
          selected: false,
          data: { label: "Alice", connectionActive: true },
        } as unknown as Parameters<typeof StoryGraphNode>[0])}
      />,
    );

    expect(screen.getByText("Alice").parentElement).toHaveClass(
      "border-[var(--sg-brand)]",
      "bg-[var(--sg-graph-target-soft)]",
    );
  });
});
