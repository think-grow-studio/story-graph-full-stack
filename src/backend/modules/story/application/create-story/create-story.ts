import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Story } from "../../domain/story";
import type { StoryRepository } from "../../domain/story.repository";

export async function createStory(
  input: {
    actorId: string;
    workspaceId: string;
    name: string;
    description: string;
  },
  dependencies: {
    repository: StoryRepository;
    access: WorkspaceAccessService;
  },
): Promise<Story> {
  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "story:create",
  });

  const now = new Date();
  return dependencies.repository.create({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
  });
}
