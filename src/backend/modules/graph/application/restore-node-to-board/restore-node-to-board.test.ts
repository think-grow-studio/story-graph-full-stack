import { describe, expect, it, vi } from "vitest";

import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphRepository } from "../../domain/graph.repository";
import { restoreNodeToBoard } from "./restore-node-to-board";

const now = new Date("2026-08-30T00:00:00.000Z");

function createDependencies({ nodeStoryId = "story-1" } = {}) {
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
    node: {
      id: "node-1",
      storyId: nodeStoryId,
      name: "Alice",
      description: "",
      iconKey: null,
      properties: {},
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    boardNode: {
      boardId: "board-1",
      nodeId: "node-1",
      x: 10,
      y: 20,
      width: 180,
      height: 90,
      zIndex: 3,
      style: { tint: "violet" },
      createdAt: now,
      updatedAt: now,
    },
    edges: [],
    boardEdges: [],
  }));

  const graph = {
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
    findNode: vi.fn(async (id: string) =>
      id === "node-1"
        ? {
            id: "node-1",
            storyId: nodeStoryId,
            name: "Alice",
            description: "",
            iconKey: null,
            properties: {},
            version: 1,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    ),
    restoreNodeToBoard: restore,
  } as unknown as GraphRepository;

  const access = {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn().mockResolvedValue(undefined),
  } satisfies WorkspaceAccessService;

  return { stories, graph, access, restore };
}

describe("restoreNodeToBoard", () => {
  it("restores BoardNode placement and incident BoardEdge presentation", async () => {
    const dependencies = createDependencies();
    const placement = {
      x: 10,
      y: 20,
      width: 180,
      height: 90,
      zIndex: 3,
      style: { tint: "violet" },
    };
    const boardEdges = [
      {
        edgeId: "edge-1",
        style: { stroke: "dashed" },
        labelPresentation: { hidden: false },
      },
    ];

    await restoreNodeToBoard(
      {
        actorId: "user-1",
        workspaceId: "workspace-1",
        boardId: "board-1",
        nodeId: "node-1",
        placement,
        boardEdges,
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
      nodeId: "node-1",
      placement,
      boardEdges,
    });
  });

  it("hides a Node from another Story before authorization", async () => {
    const dependencies = createDependencies({ nodeStoryId: "story-2" });

    await expect(
      restoreNodeToBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId: "node-1",
          placement: {
            x: 0,
            y: 0,
            width: null,
            height: null,
            zIndex: 0,
            style: {},
          },
          boardEdges: [],
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(dependencies.access.requireCapability).not.toHaveBeenCalled();
    expect(dependencies.restore).not.toHaveBeenCalled();
  });
});
