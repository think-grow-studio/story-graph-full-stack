import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useImperativeHandle, type Ref } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  restoreNode: vi.fn(),
  createEdge: vi.fn(),
  updateEdge: vi.fn(),
  deleteEdge: vi.fn(),
  restoreEdge: vi.fn(),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  createNode: mocks.createNode,
  updateNode: mocks.updateNode,
  deleteNode: mocks.deleteNode,
  restoreNode: mocks.restoreNode,
  createEdge: mocks.createEdge,
  updateEdge: mocks.updateEdge,
  deleteEdge: mocks.deleteEdge,
  restoreEdge: mocks.restoreEdge,
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    onClearSelection,
    onSelectNode,
    ref,
  }: {
    nodes: Array<{ id: string; name: string }>;
    onClearSelection?: () => void;
    onSelectNode?: (nodeId: string) => void;
    ref?: Ref<{ getCenterPosition: () => { x: number; y: number } }>;
  }) => {
    useImperativeHandle(ref, () => ({
      getCenterPosition: () => ({ x: 320, y: 240 }),
    }));

    return (
      <div>
        {nodes.map((node) => (
          <button
            key={node.id}
            onClick={() => onSelectNode?.(node.id)}
            type="button"
          >
            Select {node.name}
          </button>
        ))}
        <button onClick={() => onClearSelection?.()} type="button">
          Clear canvas selection
        </button>
      </div>
    );
  },
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const now = "2026-09-08T00:00:00.000Z";

function snapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      graphSettings: {
        defaultEdgeRouting: "orthogonal",
        snapToGrid: false,
        layoutMode: "free",
      },
      createdAt: now,
      updatedAt: now,
    },
    nodes: [
      {
        id: nodeId,
        boardId,
        name: "Alice",
        description: "Protagonist",
        kind: "person",
        iconKey: null,
        properties: {},
        x: 120,
        y: 80,
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
      },
    ],
    edges: [],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GraphEditorPage boardId={boardId} storyId={storyId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "writer@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
});

afterEach(cleanup);

describe("GraphEditorPage focus clearing", () => {
  it("clears a selected Inspector when the empty canvas is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Select Alice" }),
    );
    expect(screen.getByRole("heading", { name: "노드" })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Clear canvas selection" }),
    );

    expect(
      screen.queryByRole("heading", { name: "노드" }),
    ).not.toBeInTheDocument();
  });

  it("clears a selected Inspector with Escape when no modal workflow owns Escape", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Select Alice" }),
    );
    expect(screen.getByRole("heading", { name: "노드" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("heading", { name: "노드" }),
    ).not.toBeInTheDocument();
  });
});
