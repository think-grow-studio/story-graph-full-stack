import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  updateNode: vi.fn(),
  updateNodeState: vi.fn(),
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
  placeNodeOnBoard: mocks.placeNodeOnBoard,
  updateBoardNode: mocks.updateBoardNode,
  createEdgeOnBoard: mocks.createEdgeOnBoard,
  updateNode: mocks.updateNode,
  updateNodeState: mocks.updateNodeState,
  updateEdge: mocks.updateEdge,
  removeNodeFromBoard: mocks.removeNodeFromBoard,
  restoreNodeToBoard: mocks.restoreNodeToBoard,
  removeEdgeFromBoard: mocks.removeEdgeFromBoard,
  restoreEdgeToBoard: mocks.restoreEdgeToBoard,
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
const scopeId = "33333333-3333-4333-8333-333333333333";
const aliceId = "44444444-4444-4444-8444-444444444444";
const now = "2026-08-30T00:00:00.000Z";

function snapshot() {
  return {
    story: { id: storyId, name: "Novel" },
    board: {
      id: boardId,
      storyId,
      scopeId,
      name: "Chapter Characters",
      description: "",
      revision: 2,
      createdAt: now,
      updatedAt: now,
    },
    scope: {
      id: scopeId,
      storyId,
      name: "Chapter 10",
      description: "",
      createdAt: now,
      updatedAt: now,
    },
    nodes: [
      {
        id: aliceId,
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
    nodeStates: [
      {
        scopeId,
        nodeId: aliceId,
        name: "Queen Alice",
        description: null,
        properties: { role: "queen" },
        version: 2,
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
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.listStoryNodes.mockResolvedValue(snapshot().nodes);
  mocks.updateNodeState.mockResolvedValue({
    ...snapshot().nodeStates[0],
    name: "Empress Alice",
    version: 3,
    updatedAt: "2026-08-30T00:01:00.000Z",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Graph Editor scoped inspector", () => {
  it("shows effective Node values and autosaves sparse NodeState overrides", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Select Queen Alice" }),
    );

    expect(screen.getByLabelText("이름")).toHaveValue("Queen Alice");
    expect(screen.getByLabelText("설명")).toHaveValue("Protagonist");
    expect(screen.getByLabelText("속성 JSON")).toHaveValue(
      '{\n  "role": "queen"\n}',
    );

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "Empress Alice" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    vi.useRealTimers();

    await waitFor(() => expect(mocks.updateNodeState).toHaveBeenCalledTimes(1));
    expect(mocks.updateNodeState.mock.calls[0][0]).toEqual({
      scopeId,
      nodeId: aliceId,
      workspaceId: "workspace-1",
      version: 2,
      name: "Empress Alice",
      description: null,
      properties: { role: "queen" },
    });
    expect(mocks.updateNode).not.toHaveBeenCalled();
  });
});
