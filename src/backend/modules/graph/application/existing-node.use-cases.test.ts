import { describe, expect, it, vi } from "vitest";

import type { Board, BoardNode, GraphNode, Scope } from "../domain/graph";
import type { GraphRepository } from "../domain/graph.repository";
import type { Story } from "@/backend/modules/story/domain/story";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { listStoryNodes } from "./list-story-nodes/list-story-nodes";
import { placeNodeOnBoard } from "./place-node-on-board/place-node-on-board";

const nodeId = "00000000-0000-4000-8000-000000000001";

function storyFixture(overrides: Partial<Story> = {}): Story {
  const now = new Date("2026-08-30T00:00:00.000Z");
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
  const now = new Date("2026-08-30T00:00:00.000Z");
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

function nodeFixture(overrides: Partial<GraphNode> = {}): GraphNode {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    id: nodeId,
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

function boardNodeFixture(): BoardNode {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    boardId: "board-1",
    nodeId,
    x: 120,
    y: 80,
    width: null,
    height: null,
    zIndex: 0,
    style: {},
    createdAt: now,
    updatedAt: now,
  };
}

function stories(story: Story): StoryRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async (id) => (id === story.id ? story : null)),
    listByWorkspace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function graph(input?: {
  board?: Board;
  node?: GraphNode;
}): GraphRepository {
  const board = input?.board ?? boardFixture();
  const node = input?.node ?? nodeFixture();
  const boardNode = boardNodeFixture();
  const scope: Scope = {
    id: "scope-1",
    storyId: "story-1",
    name: "Chapter 10",
    description: "",
    createdAt: new Date("2026-08-30T00:00:00.000Z"),
    updatedAt: new Date("2026-08-30T00:00:00.000Z"),
  };
  return {
    createScope: vi.fn(),
    listScopes: vi.fn(async () => [scope]),
    findScope: vi.fn(async () => scope),
    createBoard: vi.fn(),
    listBoards: vi.fn(async () => [board]),
    findBoard: vi.fn(async (id) => (id === board.id ? board : null)),
    listNodes: vi.fn(async () => [node]),
    findNode: vi.fn(async (id) => (id === node.id ? node : null)),
    findEdge: vi.fn(),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(),
    placeNodeOnBoard: vi.fn(async () => ({ node, boardNode })),
    putNodeState: vi.fn(),
    putEdgeState: vi.fn(),
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

function access(): WorkspaceAccessService {
  return {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  };
}

describe("existing canonical Node use-cases", () => {
  it("lists canonical Story Nodes after graph:read", async () => {
    const story = storyFixture();
    const graphRepository = graph();
    const workspaceAccess = access();

    const result = await listStoryNodes(
      { actorId: "user-1", workspaceId: "workspace-1", storyId: "story-1" },
      { stories: stories(story), graph: graphRepository, access: workspaceAccess },
    );

    expect(result).toEqual([expect.objectContaining({ id: nodeId, name: "Alice" })]);
    expect(graphRepository.listNodes).toHaveBeenCalledWith("story-1");
    expect(workspaceAccess.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:read",
    });
  });

  it("places an existing same-Story Node on a Board without creating canonical data", async () => {
    const story = storyFixture();
    const graphRepository = graph();
    const workspaceAccess = access();

    const result = await placeNodeOnBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId,
        x: 120,
        y: 80,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
      },
      { stories: stories(story), graph: graphRepository, access: workspaceAccess },
    );

    expect(result.node.id).toBe(nodeId);
    expect(graphRepository.createNodeOnBoard).not.toHaveBeenCalled();
    expect(graphRepository.placeNodeOnBoard).toHaveBeenCalledWith({
      boardId: "board-1",
      nodeId,
      placement: {
        x: 120,
        y: 80,
        width: null,
        height: null,
        zIndex: 0,
        style: {},
      },
    });
  });

  it("hides a cross-Story Node before graph:update", async () => {
    const story = storyFixture();
    const graphRepository = graph({ node: nodeFixture({ storyId: "story-2" }) });
    const workspaceAccess = access();

    await expect(
      placeNodeOnBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId,
          x: 0,
          y: 0,
          width: null,
          height: null,
          zIndex: 0,
          style: {},
        },
        { stories: stories(story), graph: graphRepository, access: workspaceAccess },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(workspaceAccess.requireCapability).not.toHaveBeenCalled();
    expect(graphRepository.placeNodeOnBoard).not.toHaveBeenCalled();
  });
});