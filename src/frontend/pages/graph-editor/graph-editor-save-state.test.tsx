import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          <button onClick={() => onSelectNode?.(node.id)} type="button">
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
const now = "2026-09-06T00:00:00.000Z";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function graphNode({
  id = nodeId,
  name = "Alice",
  x = 100,
  y = 100,
  version = 1,
}: {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  version?: number;
} = {}) {
  return {
    id,
    boardId,
    name,
    description: "",
    iconKey: null,
    properties: {},
    x,
    y,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version,
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
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    nodes: [
      graphNode(),
      graphNode({ id: bobId, name: "Bob", x: 400, y: 100 }),
    ],
    edges: [],
  });
});

afterEach(cleanup);

describe("GraphEditorPage save state", () => {
  it("shows 저장됨, 저장되지 않음, 저장 중, 저장 오류/다시 시도, then 저장됨", async () => {
    const first = deferred<ReturnType<typeof graphNode>>();
    const retry = deferred<ReturnType<typeof graphNode>>();
    mocks.updateNode
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

    expect(await screen.findByText("저장됨")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Drag Alice" }));
    expect(screen.getByText("250,300")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop Alice" }));
    expect(screen.getByText("저장되지 않음")).toBeInTheDocument();

    expect(await screen.findByText("저장 중…")).toBeInTheDocument();
    expect(mocks.updateNode.mock.calls[0]?.[0]).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      nodeId,
      expectedVersion: 1,
      x: 250,
      y: 300,
    });
    first.reject(new Error("offline"));

    expect(await screen.findByText("저장 오류")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.getByText("250,300")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(mocks.updateNode).toHaveBeenCalledTimes(2));
    retry.resolve(graphNode({ x: 250, y: 300, version: 2 }));

    expect(await screen.findByText("저장됨")).toBeInTheDocument();
    expect(screen.getByText("250,300")).toBeInTheDocument();
  });

  it("stays 저장되지 않음 when an unselected Inspector draft is dirty and invalid", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <GraphEditorPage storyId={storyId} boardId={boardId} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("저장됨")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Alice" }));
    fireEvent.change(await screen.findByLabelText("속성 JSON"), {
      target: { value: '{"job":' },
    });

    expect(screen.getByText("Properties must be valid JSON.")).toBeInTheDocument();
    expect(screen.getByText("저장되지 않음")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Bob" }));
    expect(await screen.findByLabelText("이름")).toHaveValue("Bob");
    expect(screen.getByText("저장되지 않음")).toBeInTheDocument();
    expect(mocks.updateNode).not.toHaveBeenCalled();
  });
});
