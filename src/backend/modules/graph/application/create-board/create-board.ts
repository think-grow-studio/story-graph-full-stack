import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Board } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function createBoard(
  input: {
    actorId: string;
    workspaceId: string;
    storyId: string;
    name: string;
    description: string;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<Board> {
  const story = await dependencies.stories.findById(input.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Story not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  return dependencies.graph.createBoard({
    storyId: story.id,
    name: input.name,
    description: input.description,
  });
}
