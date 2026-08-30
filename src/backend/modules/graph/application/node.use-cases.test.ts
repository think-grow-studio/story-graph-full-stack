import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Board, BoardNode, GraphNode } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createNodeOnBoard } from "./create-node-on-board/create-node-on-board";
import { removeNodeFromBoard } from "./remove-node-from-board/remove-node-from-board";
import { updateBoardNode } from "./update-board-node/update-board-node";
import { updateNode } from "./update-node/update-node";

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
    revision: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function nodeFixture(overrides: Partial<GraphNode> = {}): GraphNode {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    id: "00000000-0000-4000-8000-000000000001",
    storyId: "story-1",
    name: "Alice",
    description: "",
    iconKey: null,
    properties: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function boardNodeFixture(overrides: Partial<BoardNode> = {}): BoardNode {
  const now = new Date("2026-08-28T00:00:00.000Z");
  return {
    boardId: "board-1",
    nodeId: "00000000-0000-4000-8000-000000000001",
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
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
  const node = nodeFixture();
  const boardNode = boardNodeFixture();
  return {
    createBoard: vi.fn(),
    listBoards: vi.fn(),
    findBoard: vi.fn(async (id) => (id === board.id ? board : null)),
    findNode: vi.fn(async (id) => (id === node.id ? node : null)),
    findEdge: vi.fn(),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(async (input) => ({
      node: input.node,
      boardNode: { ...boardNode, ...input.placement, boardId: input.boardId, nodeId: input.node.id },
    })),
    updateNode: vi.fn(async (input) => ({ ...node, ...input, version: node.version + 1 })),
    updateBoardNode: vi.fn(async (input) => ({ ...boardNode, ...input })),
    removeNodeFromBoard: vi.fn(async () => true),
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

describe("Node use-cases", () => {
  let stories: StoryRepository;
  let graph: GraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(() => {
    stories = createStories();
    graph = createGraph();
    access = createAccess();
  });

  it("creates canonical Node + BoardNode after ownership validation and graph:update", async () => {
    const result = await createNodeOnBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: "00000000-0000-4000-8000-000000000009",
        name: "Bob",
        description: "Friend",
        iconKey: "person",
        properties: { age: 20 },
        x: 120,
        y: 80,
        width: null,
        height: null,
        zIndex: 2,
        style: { accent: true },
      },
      { stories, graph, access },
    );

    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graph.createNodeOnBoard).toHaveBeenCalledWith({
      boardId: "board-1",
      node: expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000009",
        storyId: "story-1",
        name: "Bob",
        description: "Friend",
        iconKey: "person",
        properties: { age: 20 },
        version: 1,
      }),
      placement: {
        x: 120,
        y: 80,
        width: null,
        height: null,
        zIndex: 2,
        style: { accent: true },
      },
    });
    expect(result.boardNode).not.toHaveProperty("name");
    expect(result.boardNode).not.toHaveProperty("properties");
  });

  it("hides a cross-workspace Board before capability checks", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      createNodeOnBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: "00000000-0000-4000-8000-000000000009",
          name: "Denied",
          description: "",
          iconKey: null,
          properties: {},
          x: 0,
          y: 0,
          width: null,
          height: null,
          zIndex: 0,
          style: {},
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.createNodeOnBoard).not.toHaveBeenCalled();
  });

  it("updates a canonical Node with compare-and-swap and maps stale writes to 409", async () => {
    const updated = await updateNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        nodeId: "00000000-0000-4000-8000-000000000001",
        version: 1,
        name: "Alice v2",
        properties: { age: 21 },
      },
      { stories, graph, access },
    );

    expect(updated.version).toBe(2);
    expect(graph.updateNode).toHaveBeenCalledWith({
      id: "00000000-0000-4000-8000-000000000001",
      expectedVersion: 1,
      name: "Alice v2",
      properties: { age: 21 },
    });

    vi.mocked(graph.updateNode).mockResolvedValueOnce(null);
    await expect(
      updateNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          nodeId: "00000000-0000-4000-8000-000000000001",
          version: 1,
          description: "stale",
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("returns 404 for cross-workspace Node before graph:update", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      updateNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          nodeId: "00000000-0000-4000-8000-000000000001",
          version: 1,
          name: "Denied",
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.updateNode).not.toHaveBeenCalled();
  });

  it("updates BoardNode presentation without mutating the canonical Node", async () => {
    const result = await updateBoardNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId: "00000000-0000-4000-8000-000000000001",
        x: 50,
        style: { selected: true },
      },
      { stories, graph, access },
    );

    expect(result).toMatchObject({ x: 50, style: { selected: true } });
    expect(graph.updateBoardNode).toHaveBeenCalledWith({
      boardId: "board-1",
      nodeId: "00000000-0000-4000-8000-000000000001",
      x: 50,
      style: { selected: true },
    });
    expect(graph.updateNode).not.toHaveBeenCalled();
  });

  it("rejects BoardNode addressing when Board and Node belong to different Stories", async () => {
    vi.mocked(graph.findNode).mockResolvedValueOnce(
      nodeFixture({ storyId: "story-2" }),
    );

    await expect(
      updateBoardNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId: "00000000-0000-4000-8000-000000000001",
          x: 50,
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.updateBoardNode).not.toHaveBeenCalled();
  });

  it("removes only Board membership and requires graph:update after ownership validation", async () => {
    await expect(
      removeNodeFromBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId: "00000000-0000-4000-8000-000000000001",
        },
        { stories, graph, access },
      ),
    ).resolves.toBeUndefined();

    expect(access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(graph.removeNodeFromBoard).toHaveBeenCalledWith(
      "board-1",
      "00000000-0000-4000-8000-000000000001",
    );
  });
});
