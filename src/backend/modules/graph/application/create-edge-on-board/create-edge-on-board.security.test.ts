import { describe, expect, it, vi } from "vitest";

import type { GraphRepository } from "../../domain/graph.repository";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import { createEdgeOnBoard } from "./create-edge-on-board";

const now = new Date("2026-08-28T00:00:00.000Z");

describe("createEdgeOnBoard workspace isolation", () => {
  it("does not resolve endpoint Nodes when the Board belongs to another workspace", async () => {
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
      createEdgeOnBoard: vi.fn(),
      updateEdge: vi.fn(),
      removeEdgeFromBoard: vi.fn(),
      restoreEdgeToBoard: vi.fn(),
    };
    const access: WorkspaceAccessService = {
      findPersonalWorkspace: vi.fn(),
      requireCapability: vi.fn(),
    };

    await expect(
      createEdgeOnBoard(
        {
          actorId: "user-1",
          workspaceId: "workspace-1",
          boardId: "board-1",
          id: "00000000-0000-4000-8000-000000000099",
          sourceNodeId: "00000000-0000-4000-8000-000000000001",
          targetNodeId: "00000000-0000-4000-8000-000000000002",
          name: "hidden",
          description: "",
          iconKey: null,
          properties: {},
        },
        { stories, graph, access },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    expect(graph.findNode).not.toHaveBeenCalled();
    expect(access.requireCapability).not.toHaveBeenCalled();
    expect(graph.createEdgeOnBoard).not.toHaveBeenCalled();
  });
});
