import { describe, expect, it, vi } from "vitest";

import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphRepository } from "../../domain/graph.repository";
import { restoreEdgeToBoard } from "./restore-edge-to-board";

const now = new Date("2026-08-30T00:00:00.000Z");

function createDependencies({ edgeStoryId = "story-1" } = {}) {
  const stories = {
    create: vi.fn(),
    findById: vi.fn(async (id: string) =>
      id === "story-1"
        ? {
            id: "story-1",
            workspaceId: "workspace-1",
            name: "Story",
            description: "",
            createdAt: now,
            updatedAt: now,
          }
        : null,
    ),
    listByWorkspace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } satisfies StoryRepository;

  const restore = vi.fn(async () => ({
    edge: {
      id: "edge-1",
      storyId: edgeStoryId,
      sourceNodeId: "node-1",
      targetNodeId: "node-2",
      name: "knows",
      description: "",
      iconKey: null,
      properties: {},
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    boardEdge: {
      boardId: "board-1",
      edgeId: "edge-1",
      style: { stroke: "dashed" },
      labelPresentation: { hidden: false },
      createdAt: now,
      updatedAt: now,
    },
  }));

  const graph = {
    createBoard: vi.fn(),
    listBoards: vi.fn(),
    findBoard: vi.fn(async (id: string) =>
      id === "board-1"
        ? {
            id: "board-1",
            storyId: "story-1",
            name: "Main",
            description: "",
            revision: 1,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    ),
    findNode: vi.fn(),
    findEdge: vi.fn(async (id: string) =>
      id === "edge-1"
        ? {
            id: "edge-1",
            storyId: edgeStoryId,
            sourceNodeId: "node-1",
            targetNodeId: "node-2",
            name: "knows",
            description: "",
            iconKey: null,
            properties: {},
            version: 1,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    ),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(),
    updateNode: vi.fn(),
    updateBoardNode: vi.fn(),
    removeNodeFromBoard: vi.fn(),
    createEdgeOnBoard: vi.fn(),
    updateEdge: vi.fn(),
    removeEdgeFromBoard: vi.fn(),
    restoreEdgeToBoard: restore,
  } as unknown as GraphRepository;

  const access = {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  } satisfies WorkspaceAccessService;

  return { stories, graph, access, restore };
}

describe("restoreEdgeToBoard", () => {
  it("restores an existing canonical Edge to the Board with its previous presentation", async () => {
    const dependencies = createDependencies();

    const result = await restoreEdgeToBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        edgeId: "edge-1",
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
      },
      dependencies,
    );

    expect(dependencies.access.requireCapability).toHaveBeenCalledWith({
      userId: "user-1",
      workspaceId: "workspace-1",
      capability: "graph:update",
    });
    expect(dependencies.restore).toHaveBeenCalledWith({
      boardId: "board-1",
      edgeId: "edge-1",
      style: { stroke: "dashed" },
      labelPresentation: { hidden: false },
    });
    expect(result).toMatchObject({
      edge: { id: "edge-1" },
      boardEdge: { boardId: "board-1", edgeId: "edge-1" },
    });
  });

  it("hides an Edge from another Story before authorization", async () => {
    const dependencies = createDependencies({ edgeStoryId: "story-2" });

    await expect(
      restoreEdgeToBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          edgeId: "edge-1",
          style: {},
          labelPresentation: {},
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(dependencies.access.requireCapability).not.toHaveBeenCalled();
    expect(dependencies.restore).not.toHaveBeenCalled();
  });
});
