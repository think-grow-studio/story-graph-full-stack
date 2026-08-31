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
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  createNodeOnBoard: mocks.createNodeOnBoard,
  updateBoardNode: mocks.updateBoardNode,
  createEdgeOnBoard: mocks.createEdgeOnBoard,
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    edges = [],
    onConnectNodes,
  }: {
    nodes: Array<{ id: string; name: string }>;
    edges?: Array<{ id: string; name: string }>;
    onConnectNodes: (sourceNodeId: string, targetNodeId: string) => void;
  }) => (
    <div>
      <button
        onClick={() => onConnectNodes(nodes[0].id, nodes[1].id)}
        type="button"
      >
        Connect Nodes
      </button>
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
const now = "2026-08-28T00:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue({
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    },
    nodes: [
      {
        id: aliceId,
        storyId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: bobId,
        storyId,
        name: "Bob",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
    edges: [],
    boardNodes: [
      {
        boardId,
        nodeId: aliceId,
        x: 100,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        boardId,
        nodeId: bobId,
        x: 400,
        y: 100,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    boardEdges: [],
  });
  mocks.createEdgeOnBoard.mockRejectedValue(new Error("offline"));
});

afterEach(cleanup);

describe("GraphEditorPage failed relationship creation", () => {
  it("keeps the optimistic Edge and exposes save retry", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GraphEditorPage boardId={boardId} storyId={storyId} />
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { name: "Characters" });
    await user.click(screen.getByRole("button", { name: "Connect Nodes" }));
    await user.type(screen.getByLabelText("관계 이름"), "knows");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    expect(
      await screen.findByText("Unable to create Relationship."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("canvas-edge")).toHaveTextContent("knows");
    expect(screen.queryByLabelText("관계 이름")).not.toBeInTheDocument();
    expect(screen.getByText("저장 오류")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
  });
});
