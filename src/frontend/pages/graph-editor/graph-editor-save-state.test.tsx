import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  createNodeOnBoard: vi.fn(),
  updateBoardNode: vi.fn(),
  createEdgeOnBoard: vi.fn(),
  updateNode: vi.fn(),
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
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    onNodePositionChange,
    onNodeDragStop,
    onSelectNode,
  }: {
    nodes: Array<{ id: string; name: string; position: { x: number; y: number } }>;
    onNodePositionChange: (nodeId: string, position: { x: number; y: number }) => void;
    onNodeDragStop: (nodeId: string) => void;
    onSelectNode?: (nodeId: string) => void;
  }) => (
    <div>
      {nodes.map((node) => (
        <div key={node.id}>
          <span>{`${node.position.x},${node.position.y}`}</span>
          <button
            onClick={() => onSelectNode?.(node.id)}
            type="button"
          >
            Select {node.name}
          </button>
          <button
            onClick={() => onNodePositionChange(node.id, { x: 250, y: 300 })}
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
  ),
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const now = "2026-08-29T00:00:00.000Z";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function boardNode() {
  return {
    boardId,
    nodeId,
    x: 250,
    y: 300,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    createdAt: now,
    updatedAt: now,
  };
}

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
      revision: 1,
      createdAt: now,
      updatedAt: now,
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
      { ...boardNode(), x: 100, y: 100 },
      { ...boardNode(), nodeId: bobId, x: 400, y: 100 },
    ],
    boardEdges: [],
  });
});

afterEach(cleanup);

describe("GraphEditorPage save state", () => {
  it("shows Saved, Unsaved, Saving, Error/Retry, then Saved after retry", async () => {
    const first = deferred<ReturnType<typeof boardNode>>();
    const retry = deferred<ReturnType<typeof boardNode>>();
    mocks.updateBoardNode
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => retry.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GraphEditorPage storyId={storyId} boardId={boardId} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Drag Alice" }));
    expect(screen.getByText("250,300")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop Alice" }));
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    first.reject(new Error("offline"));

    expect(await screen.findByText("Error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText("250,300")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.updateBoardNode).toHaveBeenCalledTimes(2));
    retry.resolve(boardNode());

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("250,300")).toBeInTheDocument();
  });

  it("stays Unsaved when an unselected Inspector draft is dirty and invalid", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GraphEditorPage storyId={storyId} boardId={boardId} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Alice" }));
    fireEvent.change(await screen.findByLabelText("Properties JSON"), {
      target: { value: '{"job":' },
    });

    expect(screen.getByText("Properties must be valid JSON.")).toBeInTheDocument();
    expect(screen.getByText("Unsaved")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Bob" }));
    expect(await screen.findByLabelText("Name")).toHaveValue("Bob");
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(mocks.updateNode).not.toHaveBeenCalled();
  });
});
