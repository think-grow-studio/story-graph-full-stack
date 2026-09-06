import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Board, DeletedNodeSnapshot, GraphNode } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createNode } from "./create-node/create-node";
import { deleteNode } from "./delete-node/delete-node";
import { restoreNode } from "./restore-node/restore-node";
import { updateNode } from "./update-node/update-node";

const now = new Date("2026-09-06T00:00:00.000Z");
const nodeId = "00000000-0000-4000-8000-000000000001";

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

function nodeFixture(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: nodeId,
    boardId: "board-1",
    name: "Alice",
    description: "",
    iconKey: null,
    properties: {},
    x: 10,
    y: 20,
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
  const deleted: DeletedNodeSnapshot = { node, edges: [] };
  return {
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    listBoards: vi.fn(),
    findBoard: vi.fn(async (id) => (id === board.id ? board : null)),
    getBoardSnapshot: vi.fn(),
    createNode: vi.fn(async (input) => ({ ...input, version: 1, createdAt: now, updatedAt: now })),
    findNode: vi.fn(async (boardId, id) =>
      boardId === board.id && id === node.id ? node : null,
    ),
    updateNode: vi.fn(async (input) => ({ ...node, ...input, version: node.version + 1 })),
    deleteNode: vi.fn(async (boardId, id) =>
      boardId === board.id && id === node.id ? deleted : null,
    ),
    restoreNode: vi.fn(async (input) => ({
      node: { ...input.node, createdAt: now, updatedAt: now },
      edges: input.edges.map((edge: Record<string, unknown>) => ({
        ...edge,
        createdAt: now,
        updatedAt: now,
      })),
    })),
    createEdge: vi.fn(),
    findEdge: vi.fn(),
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

describe("Board-owned Node use-cases", () => {
  let stories: StoryRepository;
  let graph: GraphRepository;
  let access: WorkspaceAccessService;

  beforeEach(() => {
    stories = createStories();
    graph = createGraph();
    access = createAccess();
  });

  it("creates one direct Board-owned Node after Board ownership authorization", async () => {
    const result = await createNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: nodeId,
        name: "Alice",
        description: "Lead",
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

    expect(graph.createNode).toHaveBeenCalledWith({
      id: nodeId,
      boardId: "board-1",
      name: "Alice",
      description: "Lead",
      iconKey: "person",
      properties: { age: 20 },
      x: 120,
      y: 80,
      width: null,
      height: null,
      zIndex: 2,
      style: { accent: true },
    });
    expect(result).toMatchObject({ boardId: "board-1", x: 120, version: 1 });
  });

  it("hides a cross-workspace Board before graph:update capability checks", async () => {
    stories = createStories([storyFixture({ workspaceId: "workspace-2" })]);

    await expect(
      createNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: nodeId,
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
    expect(graph.createNode).not.toHaveBeenCalled();
  });

  it("updates semantic and position fields in one CAS write and maps stale writes to 409", async () => {
    const updated = await updateNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId,
        expectedVersion: 1,
        name: "Alicia",
        x: 50,
        style: { selected: true },
      },
      { stories, graph, access },
    );

    expect(updated).toMatchObject({ name: "Alicia", x: 50, version: 2 });
    expect(graph.updateNode).toHaveBeenCalledWith({
      boardId: "board-1",
      id: nodeId,
      expectedVersion: 1,
      name: "Alicia",
      x: 50,
      style: { selected: true },
    });

    vi.mocked(graph.updateNode).mockResolvedValueOnce(null);
    await expect(
      updateNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId,
          expectedVersion: 1,
          y: 99,
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("deletes the Node row and returns the Node plus incident Edge snapshot", async () => {
    const result = await deleteNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId,
      },
      { stories, graph, access },
    );

    expect(result.node.id).toBe(nodeId);
    expect(graph.deleteNode).toHaveBeenCalledWith("board-1", nodeId);
  });

  it("restores the captured Node identity/version under the same Board", async () => {
    const captured = nodeFixture({ version: 3, x: 77 });
    const result = await restoreNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId,
        node: {
          id: captured.id,
          boardId: captured.boardId,
          name: captured.name,
          description: captured.description,
          iconKey: captured.iconKey,
          properties: captured.properties,
          x: captured.x,
          y: captured.y,
          width: captured.width,
          height: captured.height,
          zIndex: captured.zIndex,
          style: captured.style,
          version: captured.version,
        },
        edges: [],
      },
      { stories, graph, access },
    );

    expect(result.node).toMatchObject({ id: nodeId, boardId: "board-1", version: 3, x: 77 });
  });

  it("rejects restore when route identity and snapshot identity differ", async () => {
    await expect(
      restoreNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId,
          node: {
            id: "00000000-0000-4000-8000-000000000009",
            boardId: "board-1",
            name: "Wrong",
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
          },
          edges: [],
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });

    expect(graph.restoreNode).not.toHaveBeenCalled();
  });
});
