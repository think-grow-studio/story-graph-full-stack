import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Board, GraphEdge, GraphNode } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createEdge } from "./create-edge/create-edge";
import { deleteEdge } from "./delete-edge/delete-edge";
import { restoreEdge } from "./restore-edge/restore-edge";
import { updateEdge } from "./update-edge/update-edge";

const now = new Date("2026-09-06T00:00:00.000Z");
const sourceId = "00000000-0000-4000-8000-000000000001";
const targetId = "00000000-0000-4000-8000-000000000002";
const edgeId = "00000000-0000-4000-8000-000000000010";

function storyFixture(overrides: Partial<Story> = {}): Story {
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
  return {
    id: "board-1",
    storyId: "story-1",
    name: "Main",
    description: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function nodeFixture(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    boardId: "board-1",
    name: id,
    description: "",
    iconKey: null,
    properties: {},
    x: 0,
    y: 0,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function edgeFixture(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: edgeId,
    boardId: "board-1",
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    name: "trusts",
    description: "",
    iconKey: null,
    properties: {},
    style: {},
    labelPresentation: {},
    version: 1,
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
  const source = nodeFixture(sourceId);
  const target = nodeFixture(targetId);
  const edge = edgeFixture();
  return {
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    listBoards: vi.fn(),
    findBoard: vi.fn(async (id) => (id === board.id ? board : null)),
    getBoardSnapshot: vi.fn(),
    createNode: vi.fn(),
    findNode: vi.fn(async (boardId, id) => {
      if (boardId !== board.id) return null;
      if (id === source.id) return source;
      if (id === target.id) return target;
      return null;
    }),
    updateNode: vi.fn(),
    deleteNode: vi.fn(),
    restoreNode: vi.fn(),
    createEdge: vi.fn(async (input) => ({ ...input, version: 1, createdAt: now, updatedAt: now })),
    findEdge: vi.fn(async (boardId, id) =>
      boardId === board.id && id === edge.id ? edge : null,
    ),
    updateEdge: vi.fn(async (input) => ({ ...edge, ...input, version: edge.version + 1 })),
    deleteEdge: vi.fn(async (boardId, id) =>
      boardId === board.id && id === edge.id ? edge : null,
    ),
    restoreEdge: vi.fn(async (input) => ({ ...input.edge, createdAt: now, updatedAt: now })),
  };
}

function createAccess(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Board-owned Edge use-cases", () => {
  let stories: StoryRepository;
  let graph: GraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(() => {
    stories = createStories();
    graph = createGraph();
    access = createAccess();
  });

  it("creates an Edge only when both endpoints belong to the Board", async () => {
    const result = await createEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: edgeId,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        name: "protects",
        description: "",
        iconKey: null,
        properties: { since: 2024 },
        style: { dashed: true },
        labelPresentation: { offset: 10 },
      },
      { stories, graph, access },
    );

    expect(graph.findNode).toHaveBeenCalledWith("board-1", sourceId);
    expect(graph.findNode).toHaveBeenCalledWith("board-1", targetId);
    expect(graph.createEdge).toHaveBeenCalledWith({
      id: edgeId,
      boardId: "board-1",
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      name: "protects",
      description: "",
      iconKey: null,
      properties: { since: 2024 },
      style: { dashed: true },
      labelPresentation: { offset: 10 },
    });
    expect(result.boardId).toBe("board-1");
  });

  it("rejects cross-Board endpoints without creating an Edge", async () => {
    vi.mocked(graph.findNode).mockImplementation(async (boardId, id) => {
      if (id === sourceId && boardId === "board-1") return nodeFixture(sourceId);
      return null;
    });

    await expect(
      createEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: edgeId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          name: "invalid",
          description: "",
          iconKey: null,
          properties: {},
          style: {},
          labelPresentation: {},
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(graph.createEdge).not.toHaveBeenCalled();
  });

  it("hides a cross-workspace Board before graph:update capability checks", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      createEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: edgeId,
          sourceNodeId: sourceId,
          targetNodeId: targetId,
          name: "invalid",
          description: "",
          iconKey: null,
          properties: {},
          style: {},
          labelPresentation: {},
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.findNode).not.toHaveBeenCalled();
  });

  it("updates semantic and presentation fields in one CAS write", async () => {
    const result = await updateEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        edgeId,
        expectedVersion: 1,
        name: "protects",
        style: { dashed: true },
      },
      { stories, graph, access },
    );

    expect(result).toMatchObject({ name: "protects", style: { dashed: true }, version: 2 });
    expect(graph.updateEdge).toHaveBeenCalledWith({
      boardId: "board-1",
      id: edgeId,
      expectedVersion: 1,
      name: "protects",
      style: { dashed: true },
    });

    vi.mocked(graph.updateEdge).mockResolvedValueOnce(null);
    await expect(
      updateEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          edgeId,
          expectedVersion: 1,
          description: "stale",
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("deletes and returns the actual Edge row for Undo", async () => {
    const result = await deleteEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        edgeId,
      },
      { stories, graph, access },
    );

    expect(result.id).toBe(edgeId);
    expect(graph.deleteEdge).toHaveBeenCalledWith("board-1", edgeId);
  });

  it("restores the same Edge UUID/version and rejects route identity mismatch", async () => {
    const captured = edgeFixture({ version: 4, style: { dashed: true } });
    const edge = {
      id: captured.id,
      boardId: captured.boardId,
      sourceNodeId: captured.sourceNodeId,
      targetNodeId: captured.targetNodeId,
      name: captured.name,
      description: captured.description,
      iconKey: captured.iconKey,
      properties: captured.properties,
      style: captured.style,
      labelPresentation: captured.labelPresentation,
      version: captured.version,
    };

    const restored = await restoreEdge(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        edgeId,
        edge,
      },
      { stories, graph, access },
    );
    expect(restored).toMatchObject({ id: edgeId, boardId: "board-1", version: 4 });

    await expect(
      restoreEdge(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          edgeId: "00000000-0000-4000-8000-000000000099",
          edge,
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
  });
});
