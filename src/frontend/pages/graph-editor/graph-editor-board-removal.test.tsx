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
const now = "2026-09-06T00:00:00.000Z";

function node(id: string, name: string, x: number) {
  return {
    id,
    boardId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    x,
    y: 100,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 2,
    createdAt: now,
    updatedAt: now,
  };
}

function relationship() {
  return {
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
    version: 3,
    createdAt: now,
    updatedAt: now,
  };
}

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
    nodes: [node(aliceId, "Alice", 100), node(bobId, "Bob", 400)],
    edges: [relationship()],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GraphEditorPage storyId={storyId} boardId={boardId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.deleteNode.mockResolvedValue(undefined);
  mocks.restoreNode.mockImplementation(async (input) => ({
    node: { ...input.node, createdAt: now, updatedAt: now },
    edges: input.edges.map((edge: Record<string, unknown>) => ({
      ...edge,
      createdAt: now,
      updatedAt: now,
    })),
  }));
  mocks.deleteEdge.mockResolvedValue(undefined);
  mocks.restoreEdge.mockImplementation(async (input) => ({
    ...input.edge,
    createdAt: now,
    updatedAt: now,
  }));
});

afterEach(cleanup);

describe("Graph Editor direct deletion", () => {
  it("deletes a Node with incident Relationships and restores the same rows with Undo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    expect(
      screen.getByText(
        "이 노드를 삭제하면 이 보드의 연결된 관계도 함께 삭제됩니다. 현재 세션에서 Undo할 수 있습니다.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "노드 삭제" }));

    await waitFor(() => expect(mocks.deleteNode).toHaveBeenCalledTimes(1));
    expect(mocks.deleteNode).toHaveBeenCalledWith({
      boardId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
    });
    expect(screen.queryByRole("button", { name: "Select Alice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select knows" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Bob" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(mocks.restoreNode).toHaveBeenCalledTimes(1));
    expect(mocks.restoreNode.mock.calls[0][0]).toMatchObject({
      boardId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
      node: expect.objectContaining({ id: aliceId, boardId }),
      edges: [expect.objectContaining({ id: edgeId, boardId })],
    });
    expect(await screen.findByRole("button", { name: "Select Alice" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Select knows" })).toBeInTheDocument();
  });

  it("deletes one Relationship while keeping both Nodes and restores it with Undo", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Select knows" }));
    expect(
      screen.getByText(
        "이 관계를 이 보드에서 삭제합니다. 현재 세션에서 Undo할 수 있습니다.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "관계 삭제" }));

    await waitFor(() => expect(mocks.deleteEdge).toHaveBeenCalledTimes(1));
    expect(mocks.deleteEdge).toHaveBeenCalledWith({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
    });
    expect(screen.queryByRole("button", { name: "Select knows" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Alice" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Bob" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(mocks.restoreEdge).toHaveBeenCalledTimes(1));
    expect(mocks.restoreEdge.mock.calls[0][0]).toMatchObject({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
      edge: expect.objectContaining({ id: edgeId, boardId }),
    });
    expect(await screen.findByRole("button", { name: "Select knows" })).toBeInTheDocument();
  });
});