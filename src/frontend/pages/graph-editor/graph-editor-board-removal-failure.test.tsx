import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  createNodeOnBoard: vi.fn(),
  updateBoardNode: vi.fn(),
  createEdgeOnBoard: vi.fn(),
  updateNode: vi.fn(),
  updateEdge: vi.fn(),
  removeNodeFromBoard: vi.fn(),
  removeEdgeFromBoard: vi.fn(),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  createNodeOnBoard: mocks.createNodeOnBoard,
  updateBoardNode: mocks.updateBoardNode,
  createEdgeOnBoard: mocks.createEdgeOnBoard,
  updateNode: mocks.updateNode,
  updateEdge: mocks.updateEdge,
  removeNodeFromBoard: mocks.removeNodeFromBoard,
  removeEdgeFromBoard: mocks.removeEdgeFromBoard,
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({ nodes, edges = [], onSelectNode }: {
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
        <span data-testid="canvas-edge" key={edge.id}>{edge.name}</span>
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
const now = "2026-08-29T00:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue({
    story: { id: storyId, name: "Novel" },
    board: { id: boardId, storyId, name: "Characters", description: "", revision: 3, createdAt: now, updatedAt: now },
    nodes: [
      { id: aliceId, storyId, name: "Alice", description: "", iconKey: null, properties: {}, version: 1, createdAt: now, updatedAt: now },
      { id: bobId, storyId, name: "Bob", description: "", iconKey: null, properties: {}, version: 1, createdAt: now, updatedAt: now },
    ],
    edges: [
      { id: edgeId, storyId, sourceNodeId: aliceId, targetNodeId: bobId, name: "knows", description: "", iconKey: null, properties: {}, version: 1, createdAt: now, updatedAt: now },
    ],
    boardNodes: [
      { boardId, nodeId: aliceId, x: 100, y: 100, width: null, height: null, zIndex: 0, style: {}, createdAt: now, updatedAt: now },
      { boardId, nodeId: bobId, x: 400, y: 100, width: null, height: null, zIndex: 0, style: {}, createdAt: now, updatedAt: now },
    ],
    boardEdges: [
      { boardId, edgeId, style: {}, labelPresentation: {}, createdAt: now, updatedAt: now },
    ],
  });
  mocks.removeNodeFromBoard.mockRejectedValue(new Error("offline"));
});

afterEach(cleanup);

describe("Graph Editor failed Board removal", () => {
  it("restores the Node and incident Relationship presentation and shows an error", async () => {
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
    await user.click(screen.getByRole("button", { name: "Remove from Board" }));

    expect(
      await screen.findByText("Unable to remove Node from Board."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Alice" })).toBeInTheDocument();
    expect(screen.getByTestId("canvas-edge")).toHaveTextContent("knows");
    expect(screen.getByRole("heading", { name: "Node Inspector" })).toBeInTheDocument();
  });
});
