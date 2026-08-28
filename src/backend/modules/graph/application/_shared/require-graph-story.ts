import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type {
  WorkspaceAccessService,
  WorkspaceCapability,
} from "@/backend/modules/workspace/domain/workspace-access.service";

export async function requireGraphStory(
  input: {
    actorId: string;
    workspaceId: string;
    storyId: string;
    capability: Extract<WorkspaceCapability, "graph:read" | "graph:update">;
  },
  dependencies: {
    stories: StoryRepository;
    access: WorkspaceAccessService;
  },
): Promise<void> {
  const story = await dependencies.stories.findById(input.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404);
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: story.workspaceId,
    capability: input.capability,
  });
}
