import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Board, BoardEdge, GraphEdge, GraphNode } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createEdgeOnBoard } from "./create-edge-on-board/create-edge-on-board";
import { removeEdgeFromBoard } from "./remove-edge-from-board/remove-edge-from-board";
import { updateEdge } from "./update-edge/update-edge";

function storyFixture(overrides: Partial<Story> = {}): Story {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: "story-1",
    workspaceId: "workspace-1",
    name: "Story",
    description: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function boardFixture(overrides: Partial<Board> = {}): Board {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: "board-1",
    storyId: "story-1",
    scopeId: null,
    name: "Main",
    description: "",
    revision: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function nodeFixture(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id,
    storyId: "story-1",
    name: id,
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const source = nodeFixture("00000000-0000-4000-8000-000000000001");
const target = nodeFixture("00000000-0000-4000-8000-000000000002");

function edgeFixture(overrides: Partial<GraphEdge> = {}): GraphEdge {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000010",
    storyId: "story-1",
    sourceNodeId: source.id,
    targetNodeId: target.id,
    name: "trusts",
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function boardEdgeFixture(overrides: Partial<BoardEdge> = {}): BoardEdge {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    boardId: "board-1",
    edgeId: "00000000-0000-4000-8000-000000000010",
    style: {},
    labelPresentation: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createStories(stories: Story[] = [storyFixture()]): StoryRepository {
  const values = new Map(stories.map((story) => [story.id, story]));
  return {
    create: vi.fn(),
    findById: vi.fn(async (id) => values.get(id) ?? null),
    listByWorkspace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createGraph(): GraphRepository {
  const board = boardFixture();
  const edge = edgeFixture();
  return {
    createScope: vi.fn(),
    listScopes: vi.fn(),
    findScope: vi.fn(),
    createBoard: vi.fn(),
    listBoards: vi.fn(),
    findBoard: vi.fn(async (id) => (id === board.id ? board : null)),
    listNodes: vi.fn(async () => [source, target]),
    findNode: vi.fn(async (id) => {
      if (id === source.id) return source;
      if (id === target.id) return target;
      return null;
    }),
    findEdge: vi.fn(async (id) => (id === edge.id ? edge : null)),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(),
    placeNodeOnBoard: vi.fn(),
    putNodeState: vi.fn(),
    putEdgeState: vi.fn(),
    updateNode: vi.fn(),
    updateBoardNode: vi.fn(),
    removeNodeFromBoard: vi.fn(),
    restoreNodeToBoard: vi.fn(),
    createEdgeOnBoard: vi.fn(async (input) => ({
      edge: input.edge,
      boardEdge: {
        ...boardEdgeFixture(),
        boardId: input.boardId,
        edgeId: input.edge.id,
      },
    })),
    updateEdge: vi.fn(async (input) => ({ ...edge, ...input, version: edge.version + 1 })),
    removeEdgeFromBoard: vi.fn(async () => true),
    restoreEdgeToBoard: vi.fn(),
  };
}

function createAccess(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Edge use-cases", () => {
  let stories: StoryRepository;
  let graph: GraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(() => {
    stories = createStories();
    graph = createGraph();
    access = createAccess();
  });

  it("creates a directed Edge after Board/endpoints ownership validation and graph:update", async () => {
    const result = await createEdgeOnBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: "00000000-0000-4000-8000-000000000099",
        sourceNodeId: source.id,
        targetNodeId: target.id,
        name: "protects",
        description: "",
        iconKey: null,
        properties: { since: 2024 },
      },
      { stories, graph, access },
    );

    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graph.createEdgeOnBoard).toHaveBeenCalledWith({
      boardId: "board-1",
      edge: expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000099",
        storyId: "story-1",
        sourceNodeId: source.id,
        targetNodeId: target.id,
        name: "protects",
        properties: { since: 2024 },
        version: 1,
      }),
    });
    expect(result.edge.sourceNodeId).toBe(source.id);
    expect(result.edge.targetNodeId).toBe(target.id);
  });

  it("does not reject a second Edge with the same source and target", async () => {
    await createEdgeOnBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: "00000000-0000-4000-8000-000000000091",
        sourceNodeId: source.id,
        targetNodeId: target.id,
        name: "trusts",
        description: "",
        iconKey: null,
        properties: {},
      },
      { stories, graph, access },
    );
    await createEdgeOnBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: "00000000-0000-4000-8000-000000000092",
        sourceNodeId: source.id,
        targetNodeId: target.id,
        name: "protects",
        description: "",
        iconKey: null,
        properties: {},
      },
      { stories, graph, access },
    );

    expect(graph.createEdgeOnBoard).toHaveBeenCalledTimes(2);
  });

  it("returns 404 before authorization when an endpoint belongs to another Story", async () => {
    vi.mocked(graph.findNode).mockImplementation(async (id) => {
      if (id === source.id) return source;
      if (id === target.id) return nodeFixture(target.id, { storyId: "story-2" });
      return null;
    });

    await expect(
      createEdgeOnBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: "00000000-0000-4000-8000-000000000099",
          sourceNodeId: source.id,
          targetNodeId: target.id,
          name: "invalid",
          description: "",
          iconKey: null,
          properties: {},
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.createEdgeOnBoard).not.toHaveBeenCalled();
  });

  it("hides a cross-workspace Board before graph:update", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      createEdgeOnBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: "00000000-0000-4000-8000-000000000099",
          sourceNodeId: source.id,
          targetNodeId: target.id,
          name: "invalid",
          description: "",
          iconKey: null,
          properties: {},
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
  });

  it("updates a canonical Edge with compare-and-swap and maps stale writes to 409", async () => {
    const updated = await updateEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        edgeId: edgeFixture().id,
        version: 1,
        name: "protects",
      },
      { stories, graph, access },
    );

    expect(updated.version).toBe(2);
    expect(graph.updateEdge).toHaveBeenCalledWith({
      id: edgeFixture().id,
      expectedVersion: 1,
      name: "protects",
    });

    vi.mocked(graph.updateEdge).mockResolvedValueOnce(null);
    await expect(
      updateEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          edgeId: edgeFixture().id,
          version: 1,
          description: "stale",
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("removes only Board membership and preserves the canonical Edge contract", async () => {
    await expect(
      removeEdgeFromBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          edgeId: edgeFixture().id,
        },
        { stories, graph, access },
      ),
    ).resolves.toBeUndefined();

    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graph.removeEdgeFromBoard).toHaveBeenCalledWith("board-1", edgeFixture().id);
  });
});
