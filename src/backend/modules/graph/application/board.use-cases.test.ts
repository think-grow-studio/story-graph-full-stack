import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Board, BoardSnapshot, Scope } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createBoard } from "./create-board/create-board";
import { getBoardSnapshot } from "./get-board-snapshot/get-board-snapshot";

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

function scopeFixture(overrides: Partial<Scope> = {}): Scope {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: "scope-1",
    storyId: "story-1",
    name: "Chapter 10",
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

function snapshotFixture(board: Board): BoardSnapshot {
  return {
    board,
    scope: null,
    nodes: [],
    nodeStates: [],
    edges: [],
    boardNodes: [],
    boardEdges: [],
  };
}

function createStories(stories: Story[] = []): StoryRepository {
  const values = new Map(stories.map((story) => [story.id, story]));
  return {
    create: vi.fn(async (story) => {
      values.set(story.id, story);
      return story;
    }),
    findById: vi.fn(async (id) => values.get(id) ?? null),
    listByWorkspace: vi.fn(async (workspaceId) =>
      [...values.values()].filter((story) => story.workspaceId === workspaceId),
    ),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
  };
}

function createGraph(
  boardValue: Board = boardFixture(),
  scopeValue: Scope = scopeFixture(),
): GraphRepository {
  return {
    createScope: vi.fn(async (input) => ({ ...scopeValue, ...input })),
    listScopes: vi.fn(async () => [scopeValue]),
    findScope: vi.fn(async (id) => (id === scopeValue.id ? scopeValue : null)),
    createBoard: vi.fn(async (input) => ({ ...boardValue, ...input })),
    listBoards: vi.fn(async () => [boardValue]),
    findBoard: vi.fn(async (id) => (id === boardValue.id ? boardValue : null)),
    listNodes: vi.fn(async () => []),
    findNode: vi.fn(async () => null),
    findEdge: vi.fn(async () => null),
    getBoardSnapshot: vi.fn(async (id) =>
      id === boardValue.id ? snapshotFixture(boardValue) : null,
    ),
    createNodeOnBoard: vi.fn(),
    placeNodeOnBoard: vi.fn(),
    putNodeState: vi.fn(),
    updateNode: vi.fn(),
    updateBoardNode: vi.fn(),
    removeNodeFromBoard: vi.fn(),
    restoreNodeToBoard: vi.fn(),
    createEdgeOnBoard: vi.fn(),
    updateEdge: vi.fn(),
    removeEdgeFromBoard: vi.fn(),
    restoreEdgeToBoard: vi.fn(),
  };
}

function createAccess(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Board use-cases", () => {
  let stories: StoryRepository;
  let graph: GraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(() => {
    stories = createStories([storyFixture()]);
    graph = createGraph();
    access = createAccess();
  });

  it("creates an unscoped Board only after resolving Story ownership and graph:update", async () => {
    const result = await createBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        name: "Main",
        description: "View",
      },
      { stories, graph, access },
    );

    expect(result).toMatchObject({ storyId: "story-1", scopeId: null, name: "Main" });
    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graph.createBoard).toHaveBeenCalledWith({
      storyId: "story-1",
      scopeId: null,
      name: "Main",
      description: "View",
    });
  });

  it("creates a Board with a Scope from the same Story", async () => {
    const result = await createBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        scopeId: "scope-1",
        name: "Chapter Board",
        description: "",
      },
      { stories, graph, access },
    );

    expect(result).toMatchObject({ storyId: "story-1", scopeId: "scope-1" });
    expect(graph.findScope).toHaveBeenCalledWith("scope-1");
    expect(graph.createBoard).toHaveBeenCalledWith({
      storyId: "story-1",
      scopeId: "scope-1",
      name: "Chapter Board",
      description: "",
    });
  });

  it("hides a cross-Story Scope before graph:update capability checks", async () => {
    graph = createGraph(boardFixture(), scopeFixture({ storyId: "story-2" }));

    await expect(
      createBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          scopeId: "scope-1",
          name: "Denied",
          description: "",
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.createBoard).not.toHaveBeenCalled();
  });

  it("returns 404 for missing/cross-workspace Story before authorization", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      createBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          storyId: "story-1",
          name: "Denied",
          description: "",
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
  });

  it("loads a Board snapshot only after Board→Story ownership resolution and graph:read", async () => {
    const result = await getBoardSnapshot(
      { actorId: "user-1", workspaceId: "workspace-1", boardId: "board-1" },
      { stories, graph, access },
    );

    expect(result.story).toEqual({ id: "story-1", name: "Story" });
    expect(result.snapshot.board.id).toBe("board-1");
    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:read",
    });
  });

  it("hides cross-workspace Boards before graph:read capability checks", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      getBoardSnapshot(
        { actorId: "user-1", workspaceId: "workspace-1", boardId: "board-1" },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.getBoardSnapshot).not.toHaveBeenCalled();
  });
});