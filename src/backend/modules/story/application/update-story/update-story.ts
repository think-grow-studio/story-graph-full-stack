import { ApplicationError } from "@/backend/common/errors/application-error";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Story } from "../../domain/story";
import type { StoryRepository } from "../../domain/story.repository";

export async function updateStory(
  input: {
    actorId: string;
    workspaceId: string;
    storyId: string;
    name?: string;
    description?: string;
  },
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
    capability: "story:update",
  });

  const updated = await dependencies.repository.update({
    id: story.id,
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.description === undefined ? {} : { description: input.description }),
  });

  if (!updated) {
    throw new ApplicationError("NOT_FOUND", 404);
  }

  return updated;
}
