import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useImperativeHandle, type Ref } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  createNodeOnBoard: vi.fn(),
  updateBoardNode: vi.fn(),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));

vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  createNodeOnBoard: mocks.createNodeOnBoard,
  updateBoardNode: mocks.updateBoardNode,
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    onNodePositionChange,
    onNodeDragStop,
    ref,
  }: {
    nodes: Array<{ id: string; name: string; position: { x: number; y: number } }>;
    onNodePositionChange: (nodeId: string, position: { x: number; y: number }) => void;
    onNodeDragStop: (nodeId: string) => void;
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
      </div>
    );
  },
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";

function snapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      name: "Characters",
      description: "",
      revision: 1,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
    nodes: [
      {
        id: nodeId,
        storyId,
        name: "Alice",
        description: "",
        iconKey: null,
        properties: {},
        version: 1,
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      },
    ],
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
  mocks.createNodeOnBoard.mockImplementation(async (input) => ({
    node: {
      id: input.id,
      storyId,
      name: input.name,
      description: "",
      iconKey: null,
      properties: {},
      version: 1,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    },
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
  mocks.updateBoardNode.mockResolvedValue({
    ...snapshot().boardNodes[0],
    x: 240,
    y: 160,
  });
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

  it("opens a name form and optimistically creates a Node at the canvas center", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "+ Node" }));
    await user.type(screen.getByLabelText("Node name"), "Bob");
    await user.click(screen.getByRole("button", { name: "Create Node" }));

    await waitFor(() => expect(mocks.createNodeOnBoard).toHaveBeenCalledTimes(1));
    const input = mocks.createNodeOnBoard.mock.calls[0][0];
    expect(input).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      name: "Bob",
      position: { x: 320, y: 240 },
    });
    expect(input.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText("Bob")).toBeInTheDocument();
    expect(screen.queryByLabelText("Node name")).not.toBeInTheDocument();
  });

  it("keeps drag movement local and persists only when drag stops", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Drag Alice" }));
    expect(screen.getByText("240,160")).toBeInTheDocument();
    expect(mocks.updateBoardNode).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop Alice" }));

    await waitFor(() =>
      expect(mocks.updateBoardNode).toHaveBeenCalledWith({
        boardId,
        nodeId,
        workspaceId: "workspace-1",
        x: 240,
        y: 160,
      }),
    );
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
});
