import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  GraphEdgeResponse,
  GraphNodeResponse,
} from "@/contracts/graph/graph.contract";
import type { InspectorDraft } from "./inspector-draft-model";
import { GraphInspector } from "./graph-inspector";

const now = "2026-09-08T00:00:00.000Z";
const boardId = "22222222-2222-4222-8222-222222222222";

const node: GraphNodeResponse = {
  id: "33333333-3333-4333-8333-333333333333",
  boardId,
  name: "Alice",
  description: "Lead",
  kind: "person",
  iconKey: null,
  properties: { role: "lead" },
  x: 10,
  y: 20,
  width: null,
  height: null,
  zIndex: 0,
  presentation: {
    shape: "rounded-rect",
    fillColor: null,
    borderColor: null,
    borderWidth: null,
    textColor: null,
  },
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const edge: GraphEdgeResponse = {
  id: "55555555-5555-4555-8555-555555555555",
  boardId,
  sourceNodeId: node.id,
  targetNodeId: "44444444-4444-4444-8444-444444444444",
  direction: "DIRECTED",
  name: "knows",
  description: "Friends",
  kind: "relationship",
  iconKey: null,
  properties: { since: "2020" },
  presentation: {
    strokeColor: null,
    strokeWidth: null,
    strokeStyle: "solid",
    labelColor: null,
  },
  routing: {
    type: "orthogonal",
    sourcePort: "auto",
    targetPort: "auto",
    waypoints: [],
  },
  version: 2,
  createdAt: now,
  updatedAt: now,
};

function draft(overrides: Partial<InspectorDraft> = {}): InspectorDraft {
  return {
    name: "Alice",
    description: "Lead",
    kind: "person",
    properties: { role: "lead" },
    direction: null,
    routingType: null,
    revision: 0,
    ...overrides,
  };
}

function commonProps(onDraftChange = vi.fn()) {
  return {
    validationError: null,
    error: null,
    isRemoving: false,
    isLaneBusy: false,
    onDraftChange,
    onDelete: vi.fn(),
  };
}

afterEach(cleanup);

describe("GraphInspector structured controls", () => {
  it("edits Node kind and properties without exposing raw JSON", () => {
    const onDraftChange = vi.fn();
    render(
      <GraphInspector
        {...commonProps(onDraftChange)}
        draft={draft()}
        selection={{ kind: "node", entity: node }}
      />,
    );

    expect(screen.queryByLabelText("속성 JSON")).not.toBeInTheDocument();
    expect(screen.getByLabelText("종류")).toHaveValue("person");
    expect(screen.getByLabelText("role 값")).toHaveValue("lead");

    fireEvent.change(screen.getByLabelText("종류"), {
      target: { value: "character" },
    });
    expect(onDraftChange).toHaveBeenCalledWith({ kind: "character" });
  });

  it("edits Relationship direction and routing type", () => {
    const onDraftChange = vi.fn();
    render(
      <GraphInspector
        {...commonProps(onDraftChange)}
        draft={draft({
          name: "knows",
          description: "Friends",
          kind: "relationship",
          properties: { since: "2020" },
          direction: "DIRECTED",
          routingType: "orthogonal",
        })}
        selection={{ kind: "edge", entity: edge }}
      />,
    );

    expect(screen.getByLabelText("방향")).toHaveValue("DIRECTED");
    expect(screen.getByLabelText("선 모양")).toHaveValue("orthogonal");

    fireEvent.change(screen.getByLabelText("방향"), {
      target: { value: "UNDIRECTED" },
    });
    fireEvent.change(screen.getByLabelText("선 모양"), {
      target: { value: "curved" },
    });

    expect(onDraftChange).toHaveBeenCalledWith({ direction: "UNDIRECTED" });
    expect(onDraftChange).toHaveBeenCalledWith({ routingType: "curved" });
  });
});
