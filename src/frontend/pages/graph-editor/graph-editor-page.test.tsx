import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useImperativeHandle, type Ref } from "react";
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
const now = "2026-09-06T00:00:00.000Z";

function graphNode(id: string, name: string, x: number, y: number, version = 3) {
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
    presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    version,
    createdAt: now,
    updatedAt: now,

    kind: "entity",
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

      graphSettings: { defaultEdgeRouting: "orthogonal", snapToGrid: false, layoutMode: "free" },
    },
    nodes: [
      graphNode(nodeId, "Alice", 120, 80),
      graphNode(secondNodeId, "Bob", 420, 240),
    ],
    edges: [],
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
  mocks.createNode.mockImplementation(async (input) =>
    graphNode(input.id, input.name, input.x, input.y, 1),
  );
  mocks.updateNode.mockImplementation(async (input) => {
    const current = snapshot().nodes.find((node) => node.id === input.nodeId)!;
    return {
      ...current,
      ...input,
      boardId,
      version: current.version + 1,
      updatedAt: "2026-09-06T00:01:00.000Z",
    };
  });
  mocks.deleteNode.mockResolvedValue(undefined);
  mocks.restoreNode.mockImplementation(async (input) => ({
    node: { ...input.node, createdAt: now, updatedAt: now },
    edges: input.edges.map((edge: Record<string, unknown>) => ({
      ...edge,
      createdAt: now,
      updatedAt: now,
    })),
  }));
  mocks.createEdge.mockImplementation(async (input) => ({
    id: input.id,
    boardId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    name: input.name,
    description: "",
    iconKey: null,
    properties: {},
    presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
    routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    version: 1,
    createdAt: now,
    updatedAt: now,

    direction: "DIRECTED",
    kind: "relationship",
  }));
  mocks.updateEdge.mockImplementation(async (input) => ({
    id: input.edgeId,
    boardId,
    sourceNodeId: nodeId,
    targetNodeId: secondNodeId,
    name: input.name ?? "knows",
    description: input.description ?? "",
    iconKey: null,
    properties: input.properties ?? {},
    presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
    routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    version: input.expectedVersion + 1,
    createdAt: now,
    updatedAt: now,

    direction: "DIRECTED",
    kind: "relationship",
  }));
  mocks.deleteEdge.mockResolvedValue(undefined);
  mocks.restoreEdge.mockImplementation(async (input) => ({
    ...input.edge,
    createdAt: now,
    updatedAt: now,
  }));
});

afterEach(cleanup);

describe("GraphEditorPage Board-owned graph", () => {
  it("renders direct Node rows at their own positions", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Characters" })).toBeInTheDocument();
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("120,80")).toBeInTheDocument();
    expect(mocks.getBoardSnapshot).toHaveBeenCalledWith(boardId, "workspace-1");
  });

  it("creates a new Board-owned Node from the single add-node dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "노드 추가" }));
    await user.type(await screen.findByLabelText("노드 이름"), "Charlie");
    await user.click(screen.getByRole("button", { name: "새 노드 만들기" }));

    await waitFor(() => expect(mocks.createNode).toHaveBeenCalledTimes(1));
    expect(mocks.createNode.mock.calls[0][0]).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      name: "Charlie",
      x: 320,
      y: 240,

      kind: "entity",
      presentation: { shape: "rounded-rect", fillColor: null, borderColor: null, borderWidth: null, textColor: null },
    });
    expect(await screen.findByText("Charlie")).toBeInTheDocument();
  });

  it("moves the direct Node locally and persists x/y with current expectedVersion on drag stop", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Drag Alice" }));
    expect(screen.getByText("240,160")).toBeInTheDocument();
    expect(mocks.updateNode).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop Alice" }));

    await waitFor(() => expect(mocks.updateNode).toHaveBeenCalledTimes(1));
    expect(mocks.updateNode.mock.calls[0][0]).toMatchObject({
      boardId,
      nodeId,
      workspaceId: "workspace-1",
      expectedVersion: 3,
      x: 240,
      y: 160,
    });
  });

  it("creates a direct Relationship after naming a connection", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Alice");

    await user.click(screen.getByRole("button", { name: "Connect Alice to Bob" }));
    await user.type(await screen.findByLabelText("관계 이름"), "sister");
    await user.click(screen.getByRole("button", { name: "관계 만들기" }));

    await waitFor(() => expect(mocks.createEdge).toHaveBeenCalledTimes(1));
    expect(mocks.createEdge.mock.calls[0][0]).toMatchObject({
      boardId,
      workspaceId: "workspace-1",
      sourceNodeId: nodeId,
      targetNodeId: secondNodeId,
      name: "sister",

      direction: "DIRECTED",
      kind: "relationship",
      presentation: { strokeColor: null, strokeWidth: null, strokeStyle: "solid", labelColor: null },
      routing: { type: "orthogonal", sourcePort: "auto", targetPort: "auto", waypoints: [] as Array<{ x: number; y: number }> },
    });
    expect(await screen.findByText("sister")).toBeInTheDocument();
  });
});
