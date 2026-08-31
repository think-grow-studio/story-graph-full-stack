import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Scope } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function listScopes(
  input: {
    actorId: string;
    workspaceId: string;
    storyId: string;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<Scope[]> {
  const story = await dependencies.stories.findById(input.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Story not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:read",
  });

  return dependencies.graph.listScopes(story.id);
}
