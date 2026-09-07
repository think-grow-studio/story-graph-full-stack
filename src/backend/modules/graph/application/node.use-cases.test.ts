import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Board,
  DeletedNodeSnapshot,
  GraphNode,
  GraphSettings,
  NodePresentation,
} from "../domain/graph";
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
const graphSettings: GraphSettings = {
  defaultEdgeRouting: "orthogonal",
  snapToGrid: false,
  layoutMode: "free",
};
const nodePresentation: NodePresentation = {
  shape: "rounded-rect",
  fillColor: null,
  borderColor: null,
  borderWidth: null,
  textColor: null,
};

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
    graphSettings,
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
    kind: "person",
    iconKey: null,
    properties: {},
    x: 10,
    y: 20,
    width: null,
    height: null,
    zIndex: 0,
    presentation: nodePresentation,
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
    createNode: vi.fn(async (input) => ({
      ...input,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })),
    findNode: vi.fn(async (boardId, id) =>
      boardId === board.id && id === node.id ? node : null,
    ),
    updateNode: vi.fn(async (input) => ({
      ...node,
      ...input,
      version: node.version + 1,
    })),
    deleteNode: vi.fn(async (boardId, id) =>
      boardId === board.id && id === node.id ? deleted : null,
    ),
    restoreNode: vi.fn(async (input) => ({
      node: { ...input.node, createdAt: now, updatedAt: now },
      edges: input.edges.map((edge) => ({
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

  it("creates one direct Board-owned Node with V2 semantic and presentation fields", async () => {
    const presentation: NodePresentation = {
      shape: "ellipse",
      fillColor: "#fff",
      borderColor: "#111",
      borderWidth: 2,
      textColor: "#222",
    };
    const result = await createNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        id: nodeId,
        name: "Alice",
        description: "Lead",
        kind: "person",
        iconKey: "person",
        properties: { age: "20", home: { city: "Seoul" } },
        x: 120,
        y: 80,
        width: null,
        height: null,
        zIndex: 2,
        presentation,
      },
      { stories, graph, access },
    );

    expect(graph.createNode).toHaveBeenCalledWith({
      id: nodeId,
      boardId: "board-1",
      name: "Alice",
      description: "Lead",
      kind: "person",
      iconKey: "person",
      properties: { age: "20", home: { city: "Seoul" } },
      x: 120,
      y: 80,
      width: null,
      height: null,
      zIndex: 2,
      presentation,
    });
    expect(result).toMatchObject({
      boardId: "board-1",
      kind: "person",
      presentation,
      x: 120,
      version: 1,
    });
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
          kind: "entity",
          iconKey: null,
          properties: {},
          x: 0,
          y: 0,
          width: null,
          height: null,
          zIndex: 0,
          presentation: nodePresentation,
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.createNode).not.toHaveBeenCalled();
  });

  it("updates semantic, presentation, and position fields in one CAS write and maps stale writes to 409", async () => {
    const presentation: NodePresentation = {
      ...nodePresentation,
      shape: "diamond",
      borderWidth: 3,
    };
    const updated = await updateNode(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId,
        expectedVersion: 1,
        name: "Alicia",
        kind: "character",
        properties: { role: "lead" },
        x: 50,
        presentation,
      },
      { stories, graph, access },
    );

    expect(updated).toMatchObject({
      name: "Alicia",
      kind: "character",
      properties: { role: "lead" },
      presentation,
      x: 50,
      version: 2,
    });
    expect(graph.updateNode).toHaveBeenCalledWith({
      boardId: "board-1",
      id: nodeId,
      expectedVersion: 1,
      name: "Alicia",
      kind: "character",
      properties: { role: "lead" },
      x: 50,
      presentation,
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

  it("restores the captured Node identity/version and V2 fields under the same Board", async () => {
    const captured = nodeFixture({
      version: 3,
      x: 77,
      kind: "character",
      properties: { status: "active" },
    });
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
          kind: captured.kind,
          iconKey: captured.iconKey,
          properties: captured.properties,
          x: captured.x,
          y: captured.y,
          width: captured.width,
          height: captured.height,
          zIndex: captured.zIndex,
          presentation: captured.presentation,
          version: captured.version,
        },
        edges: [],
      },
      { stories, graph, access },
    );

    expect(result.node).toMatchObject({
      id: nodeId,
      boardId: "board-1",
      version: 3,
      kind: "character",
      properties: { status: "active" },
      x: 77,
    });
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
            kind: "entity",
            iconKey: null,
            properties: {},
            x: 0,
            y: 0,
            width: null,
            height: null,
            zIndex: 0,
            presentation: nodePresentation,
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
