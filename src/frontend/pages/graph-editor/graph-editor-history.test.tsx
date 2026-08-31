import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  createNodeOnBoard: vi.fn(),
  updateBoardNode: vi.fn(),
  createEdgeOnBoard: vi.fn(),
  updateNode: vi.fn(),
  updateEdge: vi.fn(),
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
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    nodes,
    onSelectNode,
  }: {
    nodes: Array<{ id: string; name: string }>;
    onSelectNode?: (nodeId: string) => void;
  }) => (
    <div>
      {nodes.map((node) => (
        <button key={node.id} onClick={() => onSelectNode?.(node.id)} type="button">
          Select {node.name}
        </button>
      ))}
    </div>
  ),
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const nodeId = "33333333-3333-4333-8333-333333333333";
const now = "2026-08-30T00:00:00.000Z";

function snapshot() {
  return {
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
        description: "Protagonist",
        iconKey: null,
        properties: { role: "lead" },
        version: 3,
        createdAt: now,
        updatedAt: now,
      },
    ],
    edges: [],
    boardNodes: [
      {
        boardId,
        nodeId,
        x: 100,
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

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.updateNode
    .mockResolvedValueOnce({ ...snapshot().nodes[0], name: "Alicia", version: 4 })
    .mockResolvedValueOnce({ ...snapshot().nodes[0], name: "Alice", version: 5 })
    .mockResolvedValueOnce({ ...snapshot().nodes[0], name: "Alicia", version: 6 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Graph Editor history", () => {
  it("undoes and redoes an autosaved Node edit without draft autosave feedback", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Select Alice" }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "Alicia" },
    });
    await advance(500);

    expect(mocks.updateNode).toHaveBeenCalledTimes(1);
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toBeEnabled();

    fireEvent.click(undo);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByLabelText("이름")).toHaveValue("Alice");
    expect(mocks.updateNode).toHaveBeenCalledTimes(2);
    expect(mocks.updateNode.mock.calls[1]?.[0]).toMatchObject({
      nodeId,
      name: "Alice",
    });

    await advance(501);
    expect(mocks.updateNode).toHaveBeenCalledTimes(2);

    const redo = screen.getByRole("button", { name: "Redo" });
    expect(redo).toBeEnabled();
    fireEvent.click(redo);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("이름")).toHaveValue("Alicia");
    expect(mocks.updateNode).toHaveBeenCalledTimes(3);
    expect(mocks.updateNode.mock.calls[2]?.[0]).toMatchObject({
      nodeId,
      name: "Alicia",
    });
  });
});
