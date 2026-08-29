import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    edges = [],
    onNodePositionChange,
    onSelectNode,
    onSelectEdge,
  }: {
    nodes: Array<{ id: string; name: string; position: { x: number; y: number } }>;
    edges?: Array<{ id: string; name: string }>;
    onNodePositionChange?: (
      nodeId: string,
      position: { x: number; y: number },
    ) => void;
    onSelectNode?: (nodeId: string) => void;
    onSelectEdge?: (edgeId: string) => void;
  }) => (
    <div>
      {nodes.map((node) => (
        <div key={node.id}>
          <button onClick={() => onSelectNode?.(node.id)} type="button">
            Select {node.name}
          </button>
          <button
            onClick={() => onNodePositionChange?.(node.id, { x: 999, y: 888 })}
            type="button"
          >
            Move {node.name}
          </button>
          <span data-testid={`position-${node.id}`}>
            {node.position.x},{node.position.y}
          </span>
        </div>
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
const now = "2026-08-28T00:00:00.000Z";

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
    edges: [
      {
        id: edgeId,
        storyId,
        sourceNodeId: aliceId,
        targetNodeId: bobId,
        name: "knows",
        description: "Old friends",
        iconKey: null,
        properties: { since: 2020 },
        version: 4,
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

async function advanceAutosave(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBootstrap.mockResolvedValue({
    actor: { id: "user-1", email: "user@example.com", name: "Writer" },
    workspace: { id: "workspace-1", name: "Workspace", slug: "workspace" },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.updateNode.mockResolvedValue({
    ...snapshot().nodes[0],
    name: "Alicia",
    description: "Main protagonist",
    properties: { role: "lead", age: 31 },
    version: 4,
  });
  mocks.updateEdge.mockResolvedValue({
    ...snapshot().edges[0],
    name: "best friend",
    description: "Childhood friends",
    properties: { since: 2012 },
    version: 5,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Graph Editor inspector", () => {
  it("autosaves a selected Node after 500 ms without an explicit Save button", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    expect(screen.getByRole("heading", { name: "Node Inspector" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Alice");
    expect(screen.getByLabelText("Description")).toHaveValue("Protagonist");
    expect(screen.getByLabelText("Properties JSON")).toHaveValue(
      '{\n  "role": "lead"\n}',
    );
    expect(screen.queryByRole("button", { name: "Save Node" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Move Alice" }));
    expect(screen.getByTestId(`position-${aliceId}`)).toHaveTextContent("999,888");

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alicia" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Main protagonist" },
    });
    fireEvent.change(screen.getByLabelText("Properties JSON"), {
      target: { value: '{"role":"lead","age":31}' },
    });

    await advanceAutosave(499);
    expect(mocks.updateNode).not.toHaveBeenCalled();
    await advanceAutosave(1);
    vi.useRealTimers();

    await waitFor(() => expect(mocks.updateNode).toHaveBeenCalledTimes(1));
    expect(mocks.updateNode.mock.calls[0][0]).toEqual({
      nodeId: aliceId,
      workspaceId: "workspace-1",
      version: 3,
      name: "Alicia",
      description: "Main protagonist",
      properties: { role: "lead", age: 31 },
    });
    expect(screen.getByLabelText("Name")).toHaveValue("Alicia");
    expect(screen.getByTestId(`position-${aliceId}`)).toHaveTextContent("999,888");

    await waitFor(() => {
      const cachedSnapshot = queryClient.getQueryData<ReturnType<typeof snapshot>>([
        "graph",
        "snapshot",
        "workspace-1",
        boardId,
      ]);
      expect(cachedSnapshot?.nodes).toContainEqual(
        expect.objectContaining({ id: aliceId, name: "Alicia", version: 4 }),
      );
    });
  });

  it("autosaves a selected Relationship after 500 ms", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();

    await user.click(await screen.findByRole("button", { name: "Select knows" }));
    expect(
      screen.getByRole("heading", { name: "Relationship Inspector" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save Relationship" }),
    ).not.toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "best friend" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Childhood friends" },
    });
    fireEvent.change(screen.getByLabelText("Properties JSON"), {
      target: { value: '{"since":2012}' },
    });

    await advanceAutosave(500);
    vi.useRealTimers();

    await waitFor(() => expect(mocks.updateEdge).toHaveBeenCalledTimes(1));
    expect(mocks.updateEdge.mock.calls[0][0]).toEqual({
      edgeId,
      workspaceId: "workspace-1",
      version: 4,
      name: "best friend",
      description: "Childhood friends",
      properties: { since: 2012 },
    });

    await waitFor(() => {
      const cachedSnapshot = queryClient.getQueryData<ReturnType<typeof snapshot>>([
        "graph",
        "snapshot",
        "workspace-1",
        boardId,
      ]);
      expect(cachedSnapshot?.edges).toContainEqual(
        expect.objectContaining({ id: edgeId, name: "best friend", version: 5 }),
      );
    });
  });

  it("preserves an invalid Alice draft across Alice -> Bob -> Alice selection", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Properties JSON"), {
      target: { value: '{"job":' },
    });

    expect(screen.getByText("Properties must be valid JSON.")).toBeInTheDocument();
    await advanceAutosave(500);
    expect(mocks.updateNode).not.toHaveBeenCalled();
    vi.useRealTimers();

    await user.click(screen.getByRole("button", { name: "Select Bob" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Bob");
    await user.click(screen.getByRole("button", { name: "Select Alice" }));

    expect(screen.getByLabelText("Properties JSON")).toHaveValue('{"job":');
    expect(screen.getByText("Properties must be valid JSON.")).toBeInTheDocument();
    expect(mocks.updateNode).not.toHaveBeenCalled();
  });

  it("does not let a persistence version response replace a newer raw draft", async () => {
    let resolveFirst!: (value: ReturnType<typeof snapshot>["nodes"][number]) => void;
    mocks.updateNode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Select Alice" }));

    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alicia" },
    });
    await advanceAutosave(500);
    expect(mocks.updateNode).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alicia newest raw draft" },
    });

    await act(async () => {
      resolveFirst({
        ...snapshot().nodes[0],
        name: "Alicia",
        version: 4,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("Name")).toHaveValue("Alicia newest raw draft");
  });

  it("preserves the editable raw draft after a 409 conflict", async () => {
    mocks.updateNode.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409 },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Select Alice" }));
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alicia local draft" },
    });
    await advanceAutosave(500);
    vi.useRealTimers();

    expect(
      await screen.findByText("This Node changed elsewhere. Reload before saving again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Alicia local draft");
    expect(mocks.updateNode.mock.calls[0][0]).toMatchObject({ version: 3 });

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Alicia revised after conflict" },
    });
    expect(screen.getByLabelText("Name")).toHaveValue(
      "Alicia revised after conflict",
    );
  });
});
