import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    edges = [],
    onSelectNode,
  }: {
    nodes: Array<{ id: string; name: string }>;
    edges?: Array<{ id: string; name: string }>;
    onSelectNode?: (nodeId: string) => void;
  }) => (
    <div>
      {nodes.map((node) => (
        <button key={node.id} onClick={() => onSelectNode?.(node.id)} type="button">
          Select {node.name}
        </button>
      ))}
      {edges.map((edge) => (
        <span data-testid="canvas-edge" key={edge.id}>
          {edge.name}
        </span>
      ))}
    </div>
  ),
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-06T00:00:00.000Z";

function snapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    nodes: [
      {
        id: aliceId,
        boardId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        x: 100,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: bobId,
        boardId,
        name: "Bob",
        description: "",
        iconKey: null,
        properties: {},
        x: 400,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    edges: [
      {
        id: edgeId,
        boardId,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        name: "knows",
        description: "",
        iconKey: null,
        properties: {},
        style: {},
        labelPresentation: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.deleteNode.mockRejectedValue(new Error("offline"));
});

afterEach(cleanup);

describe("Graph Editor failed direct Node deletion", () => {
  it("keeps the optimistic deletion and exposes save retry", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GraphEditorPage storyId={storyId} boardId={boardId} />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    await user.click(screen.getByRole("button", { name: "노드 삭제" }));

    await waitFor(() => expect(mocks.deleteNode).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("Unable to delete Node."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select Alice" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-edge")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "노드" })).not.toBeInTheDocument();
    expect(screen.getByText("저장 오류")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
