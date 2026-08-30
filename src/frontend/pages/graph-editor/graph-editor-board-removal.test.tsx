import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  listStoryNodes: vi.fn(),
  createNodeOnBoard: vi.fn(),
  updateBoardNode: vi.fn(),
  createEdgeOnBoard: vi.fn(),
  updateNode: vi.fn(),
  updateEdge: vi.fn(),
  removeNodeFromBoard: vi.fn(),
  restoreNodeToBoard: vi.fn(),
  removeEdgeFromBoard: vi.fn(),
  restoreEdgeToBoard: vi.fn(),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  listStoryNodes: mocks.listStoryNodes,
  createNodeOnBoard: mocks.createNodeOnBoard,
  updateBoardNode: mocks.updateBoardNode,
  createEdgeOnBoard: mocks.createEdgeOnBoard,
  updateNode: mocks.updateNode,
  updateEdge: mocks.updateEdge,
  removeNodeFromBoard: mocks.removeNodeFromBoard,
  restoreNodeToBoard: mocks.restoreNodeToBoard,
  removeEdgeFromBoard: mocks.removeEdgeFromBoard,
  restoreEdgeToBoard: mocks.restoreEdgeToBoard,
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    edges = [],
    onSelectNode,
    onSelectEdge,
  }: {
    nodes: Array<{ id: string; name: string }>;
    edges?: Array<{ id: string; name: string }>;
    onSelectNode?: (nodeId: string) => void;
    onSelectEdge?: (edgeId: string) => void;
  }) => (
    <div>
      {nodes.map((node) => (
        <button key={node.id} onClick={() => onSelectNode?.(node.id)} type="button">
          Select {node.name}
        </button>
      ))}
      {edges.map((edge) => (
        <button key={edge.id} onClick={() => onSelectEdge?.(edge.id)} type="button">
          Select {edge.name}
        </button>
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

function snapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      scopeId: null,
      name: "Characters",
      description: "",
      revision: 3,
      createdAt: now,
      updatedAt: now,
    },
    scope: null,
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
    nodeStates: [],
    edges: [
      {
        id: edgeId,
        storyId,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        name: "knows",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
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
    boardEdges: [
      {
        boardId,
        edgeId,
        style: {},
        labelPresentation: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <GraphEditorPage storyId={storyId} boardId={boardId} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.listStoryNodes.mockResolvedValue(snapshot().nodes);
  mocks.removeNodeFromBoard.mockResolvedValue(undefined);
  mocks.restoreNodeToBoard.mockResolvedValue({
    node: snapshot().nodes[0],
    boardNode: snapshot().boardNodes[0],
    edges: snapshot().edges,
    boardEdges: snapshot().boardEdges,
  });
  mocks.removeEdgeFromBoard.mockResolvedValue(undefined);
  mocks.restoreEdgeToBoard.mockResolvedValue({
    edge: snapshot().edges[0],
    boardEdge: snapshot().boardEdges[0],
  });
});

afterEach(cleanup);

describe("Graph Editor Board removal", () => {
  it("removes a selected Node and incident Relationship from Board presentation", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    await user.click(screen.getByRole("button", { name: "Remove from Board" }));

    await waitFor(() => expect(mocks.removeNodeFromBoard).toHaveBeenCalledTimes(1));
    expect(mocks.removeNodeFromBoard.mock.calls[0][0]).toEqual({
      boardId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
    });
    expect(screen.queryByRole("button", { name: "Select Alice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select knows" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Bob" })).toBeInTheDocument();

    const cached = queryClient.getQueryData<ReturnType<typeof snapshot>>([
      "graph",
      "snapshot",
      "workspace-1",
      boardId,
    ]);
    expect(cached?.nodes.map((node) => node.id)).toEqual([bobId]);
    expect(cached?.edges).toEqual([]);
    expect(cached?.boardEdges).toEqual([]);
  });

  it("undoes Node Board removal with its incident Relationship and snapshot cache", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    await user.click(screen.getByRole("button", { name: "Remove from Board" }));
    await waitFor(() => expect(mocks.removeNodeFromBoard).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(mocks.restoreNodeToBoard).toHaveBeenCalledTimes(1));
    expect(mocks.restoreNodeToBoard.mock.calls[0][0]).toEqual({
      boardId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
      boardNode: snapshot().boardNodes[0],
      boardEdges: snapshot().boardEdges,
    });
    expect(await screen.findByRole("button", { name: "Select Alice" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Select knows" })).toBeInTheDocument();

    const cached = queryClient.getQueryData<ReturnType<typeof snapshot>>([
      "graph",
      "snapshot",
      "workspace-1",
      boardId,
    ]);
    expect(cached?.nodes).toContainEqual(expect.objectContaining({ id: aliceId }));
    expect(cached?.edges).toContainEqual(expect.objectContaining({ id: edgeId }));
    expect(cached?.boardNodes).toContainEqual(
      expect.objectContaining({ nodeId: aliceId, x: 100, y: 100 }),
    );
    expect(cached?.boardEdges).toContainEqual(expect.objectContaining({ edgeId }));
  });

  it("removes a selected Relationship from Board presentation while leaving both Nodes", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Select knows" }));
    await user.click(screen.getByRole("button", { name: "Remove from Board" }));

    await waitFor(() => expect(mocks.removeEdgeFromBoard).toHaveBeenCalledTimes(1));
    expect(mocks.removeEdgeFromBoard.mock.calls[0][0]).toEqual({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
    });
    expect(screen.queryByRole("button", { name: "Select knows" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Alice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Bob" })).toBeInTheDocument();
  });

  it("undoes Relationship Board removal through restore persistence and snapshot cache", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    await user.click(await screen.findByRole("button", { name: "Select knows" }));
    await user.click(screen.getByRole("button", { name: "Remove from Board" }));
    await waitFor(() => expect(mocks.removeEdgeFromBoard).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Select knows" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(mocks.restoreEdgeToBoard).toHaveBeenCalledTimes(1));
    expect(mocks.restoreEdgeToBoard.mock.calls[0][0]).toEqual({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
      style: {},
      labelPresentation: {},
    });
    expect(await screen.findByRole("button", { name: "Select knows" })).toBeInTheDocument();

    const cached = queryClient.getQueryData<ReturnType<typeof snapshot>>([
      "graph",
      "snapshot",
      "workspace-1",
      boardId,
    ]);
    expect(cached?.edges).toContainEqual(expect.objectContaining({ id: edgeId }));
    expect(cached?.boardEdges).toContainEqual(
      expect.objectContaining({ boardId, edgeId }),
    );
  });
});