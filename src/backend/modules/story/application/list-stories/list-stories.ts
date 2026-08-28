import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Story } from "../../domain/story";
import type { StoryRepository } from "../../domain/story.repository";

export async function listStories(
  input: { actorId: string; workspaceId: string },
  dependencies: {
    repository: StoryRepository;
    access: WorkspaceAccessService;
  },
): Promise<Story[]> {
  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "story:read",
  });

  return dependencies.repository.listByWorkspace(input.workspaceId);
}
