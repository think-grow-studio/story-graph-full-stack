import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useImperativeHandle, type Ref } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  listStoryNodes: vi.fn(),
  createNodeOnBoard: vi.fn(),
  placeNodeOnBoard: vi.fn(),
  updateBoardNode: vi.fn(),
  createEdgeOnBoard: vi.fn(),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  listStoryNodes: mocks.listStoryNodes,
  createNodeOnBoard: mocks.createNodeOnBoard,
  placeNodeOnBoard: mocks.placeNodeOnBoard,
  updateBoardNode: mocks.updateBoardNode,
  createEdgeOnBoard: mocks.createEdgeOnBoard,
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    edges = [],
    onNodePositionChange,
    onNodeDragStop,
    onConnectNodes,
    ref,
  }: {
    nodes: Array<{ id: string; name: string; position: { x: number; y: number } }>;
    edges?: Array<{
      id: string;
      name: string;
      sourceNodeId: string;
      targetNodeId: string;
    }>;
    onNodePositionChange: (nodeId: string, position: { x: number; y: number }) => void;
    onNodeDragStop: (nodeId: string) => void;
    onConnectNodes?: (sourceNodeId: string, targetNodeId: string) => void;
    ref?: Ref<{ getCenterPosition: () => { x: number; y: number } }>;
  }) => {
    useImperativeHandle(ref, () => ({
      getCenterPosition: () => ({ x: 320, y: 240 }),
    }));

    return (
      <div>
        {nodes.map((node) => (
          <div key={node.id}>
            <span>{node.name}</span>
            <span>{`${node.position.x},${node.position.y}`}</span>
            <button
              onClick={() => onNodePositionChange(node.id, { x: 240, y: 160 })}
              type="button"
            >
              Drag {node.name}
            </button>
            <button onClick={() => onNodeDragStop(node.id)} type="button">
              Stop {node.name}
            </button>
          </div>
        ))}
        {nodes.length >= 2 ? (
          <button
            onClick={() => onConnectNodes?.(nodes[0].id, nodes[1].id)}
            type="button"
          >
            Connect {nodes[0].name} to {nodes[1].name}
          </button>
        ) : null}
        {edges.map((edge) => (
          <span key={edge.id}>{edge.name}</span>
        ))}
      </div>
    );
  },
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const secondNodeId = "44444444-4444-4444-8444-444444444444";
const thirdNodeId = "55555555-5555-4555-8555-555555555555";

function graphNode(id: string, name: string) {
  return {
    id,
    storyId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };
}

function snapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      scopeId: null,
      name: "Characters",
      description: "",
      revision: 1,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
    scope: null,
    nodes: [graphNode(nodeId, "Alice"), graphNode(secondNodeId, "Bob")],
    nodeStates: [],
    edgeStates: [],
    edges: [],
    boardNodes: [
      {
        boardId,
        nodeId,
        x: 120,
        y: 80,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      },
      {
        boardId,
        nodeId: secondNodeId,
        x: 420,
        y: 240,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      },
    ],
    boardEdges: [],
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
    workspace: { id: "workspace-1", name: "Writer's Workspace", slug: "personal-user-1" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.listStoryNodes.mockResolvedValue([
    graphNode(nodeId, "Alice"),
    graphNode(secondNodeId, "Bob"),
    graphNode(thirdNodeId, "Carol"),
  ]);
  mocks.createNodeOnBoard.mockImplementation(async (input) => ({
    node: graphNode(input.id, input.name),
    boardNode: {
      boardId,
      nodeId: input.id,
      x: input.position.x,
      y: input.position.y,
      width: null,
      height: null,
      zIndex: 0,
      style: {},
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  }));
  mocks.placeNodeOnBoard.mockImplementation(async (input) => ({
    node: graphNode(input.nodeId, "Carol"),
    boardNode: {
      boardId,
      nodeId: input.nodeId,
      x: input.position.x,
      y: input.position.y,
      width: null,
      height: null,
      zIndex: 0,
      style: {},
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  }));
  mocks.updateBoardNode.mockResolvedValue({
    ...snapshot().boardNodes[0],
    x: 240,
    y: 160,
  });
  mocks.createEdgeOnBoard.mockImplementation(async (input) => ({
    edge: {
      id: input.id,
      storyId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      name: input.name,
      description: "",
      iconKey: null,
      properties: {},
      version: 1,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
    boardEdge: {
      boardId,
      edgeId: input.id,
      style: {},
      labelPresentation: {},
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
  }));
});

afterEach(cleanup);

describe("GraphEditorPage", () => {
  it("hydrates and renders the represented snapshot", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Characters" })).toBeInTheDocument();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("120,80")).toBeInTheDocument();
    expect(mocks.getBoardSnapshot).toHaveBeenCalledWith(boardId, "workspace-1");
  });

  it("creates a new Node from the single add-node dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "노드 추가" }));
    expect(await screen.findByRole("dialog", { name: "노드 추가" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("노드 이름"), "Charlie");
    await user.click(screen.getByRole("button", { name: "새 노드 만들기" }));

    await waitFor(() => expect(mocks.createNodeOnBoard).toHaveBeenCalledTimes(1));
    const input = mocks.createNodeOnBoard.mock.calls[0][0];
    expect(input).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      name: "Charlie",
      position: { x: 320, y: 240 },
    });
    expect(input.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByLabelText("노드 이름")).not.toBeInTheDocument();
  });

  it("offers only unrepresented canonical Nodes in the same add-node dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "노드 추가" }));
    const picker = await screen.findByLabelText("기존 노드");
    expect(screen.queryByRole("option", { name: "Alice" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Bob" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Carol" })).toBeInTheDocument();

    await user.selectOptions(picker, thirdNodeId);
    await user.click(screen.getByRole("button", { name: "보드에 추가" }));

    await waitFor(() => expect(mocks.placeNodeOnBoard).toHaveBeenCalledTimes(1));
    expect(mocks.placeNodeOnBoard).toHaveBeenCalledWith({
      boardId,
      nodeId: thirdNodeId,
      workspaceId: "workspace-1",
      position: { x: 320, y: 240 },
    });
    expect(await screen.findByText("Carol")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "노드 추가" })).not.toBeInTheDocument();
  });

  it("keeps drag movement local and persists only when drag stops", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Drag Alice" }));
    expect(screen.getByText("240,160")).toBeInTheDocument();
    expect(mocks.updateBoardNode).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop Alice" }));

    await waitFor(() => expect(mocks.updateBoardNode).toHaveBeenCalledTimes(1));
    expect(mocks.updateBoardNode.mock.calls[0][0]).toEqual({
      boardId,
      nodeId,
      workspaceId: "workspace-1",
      x: 240,
      y: 160,
    });
  });

  it("preserves local drag position and shows an inline error when persistence fails", async () => {
    mocks.updateBoardNode.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Drag Alice" }));
    await user.click(screen.getByRole("button", { name: "Stop Alice" }));

    expect(await screen.findByText("Unable to save Node position.")).toBeInTheDocument();
    expect(screen.getByText("240,160")).toBeInTheDocument();
  });

  it("names a Relationship in a focused dialog after connecting Nodes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Connect Alice to Bob" }));
    expect(await screen.findByRole("dialog", { name: "관계 만들기" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("관계 이름"), "sister");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    await waitFor(() => expect(mocks.createEdgeOnBoard).toHaveBeenCalledTimes(1));
    const input = mocks.createEdgeOnBoard.mock.calls[0][0];
    expect(input).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      sourceNodeId: nodeId,
      targetNodeId: secondNodeId,
      name: "sister",
    });
    expect(input.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText("sister")).toBeInTheDocument();
    expect(screen.queryByLabelText("관계 이름")).not.toBeInTheDocument();
  });

  it("cancels Relationship naming without writing durable state", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Connect Alice to Bob" }));
    expect(await screen.findByRole("dialog", { name: "관계 만들기" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog", { name: "관계 만들기" })).not.toBeInTheDocument();
    expect(mocks.createEdgeOnBoard).not.toHaveBeenCalled();
  });
});
