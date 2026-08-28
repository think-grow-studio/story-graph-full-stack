import { ApplicationError } from "@/backend/common/errors/application-error";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Story } from "../../domain/story";
import type { StoryRepository } from "../../domain/story.repository";

export async function getStory(
  input: { actorId: string; workspaceId: string; storyId: string },
  dependencies: {
    repository: StoryRepository;
    access: WorkspaceAccessService;
  },
): Promise<Story> {
  const story = await dependencies.repository.findById(input.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404);
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: story.workspaceId,
    capability: "story:read",
  });

  return story;
}
