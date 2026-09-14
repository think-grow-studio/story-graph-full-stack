import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBootstrap: vi.fn(),
  getBoardSnapshot: vi.fn(),
  createEdge: vi.fn(),
  updateEdge: vi.fn(),
  deleteEdge: vi.fn(),
}));

vi.mock("@/frontend/api/auth/bootstrap.api", () => ({
  getBootstrap: mocks.getBootstrap,
}));
vi.mock("@/frontend/api/graph/graph.api", () => ({
  getBoardSnapshot: mocks.getBoardSnapshot,
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  restoreNode: vi.fn(),
  createEdge: mocks.createEdge,
  updateEdge: mocks.updateEdge,
  deleteEdge: mocks.deleteEdge,
  restoreEdge: vi.fn(),
}));

vi.mock("@/frontend/widgets/graph-editor/graph-canvas", () => ({
  GraphCanvas: ({
    edges = [],
    onSelectEdge,
  }: {
    edges?: Array<{ id: string }>;
    onSelectEdge?: (edgeId: string) => void;
  }) => (
    <button onClick={() => onSelectEdge?.(edges[0].id)} type="button">
      Select relationship pair
    </button>
  ),
}));

import { GraphEditorPage } from "./graph-editor-page";

const storyId = "11111111-1111-4111-8111-111111111111";
const boardId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";
const edgeId = "55555555-5555-4555-8555-555555555555";
const now = "2026-09-15T00:00:00.000Z";

const presentation = {
  strokeColor: null,
  strokeWidth: null,
  strokeStyle: "solid" as const,
  labelColor: null,
};
const routing = {
  type: "orthogonal" as const,
  sourcePort: "auto" as const,
  targetPort: "auto" as const,
  waypoints: [],
};

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
    presentation: {
      shape: "rounded-rect" as const,
      fillColor: null,
      borderColor: null,
      borderWidth: null,
      textColor: null,
    },
    version: 1,
    createdAt: now,
    updatedAt: now,
    kind: "entity",
  };
}

function edge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  name: string,
) {
  return {
    id,
    boardId,
    sourceNodeId,
    targetNodeId,
    direction: "DIRECTED" as const,
    name,
    description: "",
    kind: "relationship",
    iconKey: null,
    properties: {},
    presentation,
    routing,
    version: 1,
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
      graphSettings: {
        defaultEdgeRouting: "orthogonal",
        snapToGrid: false,
        layoutMode: "free",
      },
    },
    nodes: [node(aliceId, "Alice", 80), node(bobId, "Bob", 420)],
    edges: [edge(edgeId, aliceId, bobId, "좋아한다")],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
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
    workspace: {
      id: "workspace-1",
      name: "Workspace",
      slug: "personal-user-1",
    },
  });
  mocks.getBoardSnapshot.mockResolvedValue(snapshot());
  mocks.createEdge.mockImplementation(async (input) => ({
    ...edge(input.id, input.sourceNodeId, input.targetNodeId, input.name),
    description: input.description ?? "",
  }));
  mocks.updateEdge.mockImplementation(async (input) => ({
    ...edge(input.edgeId, aliceId, bobId, input.name ?? "좋아한다"),
    description: input.description ?? "",
    version: input.expectedVersion + 1,
  }));
  mocks.deleteEdge.mockResolvedValue(undefined);
});

describe("relationship pair inspector", () => {
  it("opens from the single rail and shows both directions as independent toggles", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Select relationship pair" }),
    );

    expect(await screen.findByRole("heading", { name: "관계" })).toBeVisible();
    expect(screen.getByText("Alice ↔ Bob")).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Alice → Bob 활성화" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Bob → Alice 활성화" }),
    ).not.toBeChecked();
    expect(screen.getByLabelText("Alice → Bob 관계")).toHaveValue("좋아한다");
  });

  it("turns the missing reverse direction on by creating one semantic edge", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Select relationship pair" }),
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Bob → Alice 활성화" }),
    );

    await waitFor(() => expect(mocks.createEdge).toHaveBeenCalledTimes(1));
    expect(mocks.createEdge.mock.calls[0][0]).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      sourceNodeId: bobId,
      targetNodeId: aliceId,
      direction: "DIRECTED",
    });
  });

  it("turns an existing direction off by deleting that semantic edge", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Select relationship pair" }),
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Alice → Bob 활성화" }),
    );

    await waitFor(() => expect(mocks.deleteEdge).toHaveBeenCalledTimes(1));
    expect(mocks.deleteEdge.mock.calls[0][0]).toMatchObject({
      boardId,
      edgeId,
      workspaceId: "workspace-1",
    });
  });

  it("autosaves the relationship text for each active direction", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Select relationship pair" }),
    );

    const field = screen.getByLabelText("Alice → Bob 관계");
    await user.clear(field);
    await user.type(field, "존경한다");

    await waitFor(() => expect(mocks.updateEdge).toHaveBeenCalled(), {
      timeout: 1500,
    });
    expect(mocks.updateEdge.mock.calls.at(-1)?.[0]).toMatchObject({
      edgeId,
      name: "존경한다",
    });
  });
});