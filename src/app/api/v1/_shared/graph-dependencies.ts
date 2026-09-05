import { DrizzleTaggedGraphRepository } from "@/backend/modules/graph/infrastructure/drizzle-tagged-graph.repository";
import { DrizzleStoryRepository } from "@/backend/modules/story/infrastructure/drizzle-story.repository";
import { DrizzleWorkspaceAccessService } from "@/backend/modules/workspace/infrastructure/drizzle-workspace-access.service";

export const graphDependencies = {
  stories: new DrizzleStoryRepository(),
  graph: new DrizzleTaggedGraphRepository(),
  access: new DrizzleWorkspaceAccessService(),
};
