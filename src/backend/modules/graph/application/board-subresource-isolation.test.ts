import { describe, expect, it, vi } from "vitest";

import type { GraphRepository } from "../domain/graph.repository";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { removeEdgeFromBoard } from "./remove-edge-from-board/remove-edge-from-board";
import { removeNodeFromBoard } from "./remove-node-from-board/remove-node-from-board";
import { updateBoardNode } from "./update-board-node/update-board-node";

const now = new Date("2026-08-28T00:00:00.000Z");

function createDependencies() {
  const stories: StoryRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: "story-1",
      workspaceId: "workspace-2",
      name: "Hidden Story",
      description: "",
      createdAt: now,
      updatedAt: now,
    }),
    listByWorkspace: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const graph: GraphRepository = {
    createBoard: vi.fn(),
    listBoards: vi.fn(),
    findBoard: vi.fn().mockResolvedValue({
      id: "board-1",
      storyId: "story-1",
      name: "Hidden Board",
      description: "",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    }),
    findNode: vi.fn(),
    findEdge: vi.fn(),
    getBoardSnapshot: vi.fn(),
    createNodeOnBoard: vi.fn(),
    updateNode: vi.fn(),
    updateBoardNode: vi.fn(),
    removeNodeFromBoard: vi.fn(),
    restoreNodeToBoard: vi.fn(),
    createEdgeOnBoard: vi.fn(),
    updateEdge: vi.fn(),
    removeEdgeFromBoard: vi.fn(),
    restoreEdgeToBoard: vi.fn(),
  };
  const access: WorkspaceAccessService = {
    findPersonalWorkspace: vi.fn(),
    requireCapability: vi.fn(),
  };
  return { stories, graph, access };
}

describe("Board subresource workspace isolation", () => {
  it("does not resolve a Node before hiding a cross-workspace Board update", async () => {
    const dependencies = createDependencies();

    await expect(
      updateBoardNode(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId: "00000000-0000-4000-8000-000000000001",
          x: 10,
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(dependencies.graph.findNode).not.toHaveBeenCalled();
    expect(dependencies.access.requireCapability).not.toHaveBeenCalled();
  });

  it("does not resolve a Node before hiding a cross-workspace Board removal", async () => {
    const dependencies = createDependencies();

    await expect(
      removeNodeFromBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          nodeId: "00000000-0000-4000-8000-000000000001",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(dependencies.graph.findNode).not.toHaveBeenCalled();
    expect(dependencies.access.requireCapability).not.toHaveBeenCalled();
  });

  it("does not resolve an Edge before hiding a cross-workspace Board removal", async () => {
    const dependencies = createDependencies();

    await expect(
      removeEdgeFromBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          edgeId: "00000000-0000-4000-8000-000000000001",
        },
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(dependencies.graph.findEdge).not.toHaveBeenCalled();
    expect(dependencies.access.requireCapability).not.toHaveBeenCalled();
  });
});
