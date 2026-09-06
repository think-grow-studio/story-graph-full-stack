import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Board, BoardSnapshot } from "../domain/graph";
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

function boardFixture(overrides: Partial<Board> = {}): Board {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: "board-1",
    storyId: "story-1",
    name: "Main",
    description: "",
    tags: ["characters"],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function snapshotFixture(board: Board): BoardSnapshot {
  return {
    board,
    nodes: [],
    edges: [],
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

function createGraph(boardValue: Board = boardFixture()): GraphRepository {
  return {
    createBoard: vi.fn(async (input) => ({ ...boardValue, ...input })),
    updateBoard: vi.fn(async () => null),
    listBoards: vi.fn(async () => [boardValue]),
    findBoard: vi.fn(async (id) => (id === boardValue.id ? boardValue : null)),
    getBoardSnapshot: vi.fn(async (id) =>
      id === boardValue.id ? snapshotFixture(boardValue) : null,
    ),
    createNode: vi.fn(),
    findNode: vi.fn(async () => null),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    restoreNode: vi.fn(),
    createEdge: vi.fn(),
    findEdge: vi.fn(async () => null),
    updateEdge: vi.fn(),
    deleteEdge: vi.fn(),
    restoreEdge: vi.fn(),
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

  it("creates an independent Board with tags after resolving Story ownership", async () => {
    const result = await createBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        storyId: "story-1",
        name: "Main",
        description: "View",
        tags: ["characters", "draft"],
      },
      { stories, graph, access },
    );

    expect(result).toMatchObject({
      storyId: "story-1",
      name: "Main",
      tags: ["characters", "draft"],
    });
    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graph.createBoard).toHaveBeenCalledWith({
      storyId: "story-1",
      name: "Main",
      description: "View",
      tags: ["characters", "draft"],
    });
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
          tags: [],
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
  });

  it("loads a direct Board snapshot after Board→Story ownership resolution", async () => {
    const result = await getBoardSnapshot(
      { actorId: "user-1", workspaceId: "workspace-1", boardId: "board-1" },
      { stories, graph, access },
    );

    expect(result.story).toEqual({ id: "story-1", name: "Story" });
    expect(result.snapshot).toEqual({
      board: boardFixture(),
      nodes: [],
      edges: [],
    });
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
