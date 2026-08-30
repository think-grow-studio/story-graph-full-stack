import { describe, expect, it, vi } from "vitest";

import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Board } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";
import { listBoards } from "./list-boards";

const story = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "workspace-1",
  name: "Story",
  description: "",
  createdAt: new Date("2026-08-28T00:00:00.000Z"),
  updatedAt: new Date("2026-08-28T00:00:00.000Z"),
};

const boards: Board[] = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    storyId: story.id,
    scopeId: null,
    name: "Main Board",
    description: "",
    revision: 0,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  },
];

function dependencies() {
  return {
    stories: {
      findById: vi.fn().mockResolvedValue(story),
    } as unknown as StoryRepository,
    graph: {
      listBoards: vi.fn().mockResolvedValue(boards),
    } as unknown as GraphRepository,
    access: {
      requireCapability: vi.fn().mockResolvedValue(undefined),
    } as unknown as WorkspaceAccessService,
  };
}

describe("listBoards", () => {
  it("requires graph:read and returns boards for the Story", async () => {
    const deps = dependencies();

    const result = await listBoards(
      {
        actorId: "actor-1",
        workspaceId: "workspace-1",
        storyId: story.id,
      },
      deps,
    );

    expect(deps.access.requireCapability).toHaveBeenCalledWith({
      userId: "actor-1",
      workspaceId: "workspace-1",
      capability: "graph:read",
    });
    expect(deps.graph.listBoards).toHaveBeenCalledWith(story.id);
    expect(result).toEqual(boards);
  });

  it("hides a cross-workspace Story before capability or graph lookup", async () => {
    const deps = dependencies();

    await expect(
      listBoards(
        {
          actorId: "actor-1",
          workspaceId: "workspace-2",
          storyId: story.id,
        },
        deps,
      ),
    ).rejects.toEqual(new ApplicationError("NOT_FOUND", 404, "Story not found"));

    expect(deps.access.requireCapability).not.toHaveBeenCalled();
    expect(deps.graph.listBoards).not.toHaveBeenCalled();
  });
});
