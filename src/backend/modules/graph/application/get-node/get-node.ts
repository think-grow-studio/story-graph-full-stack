import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphNode } from "../../domain/graph-node";
import type { GraphRepository } from "../../domain/graph.repository";
import { requireGraphStory } from "../_shared/require-graph-story";

export async function getNode(
  input: { actorId: string; workspaceId: string; storyId: string; nodeId: string },
  dependencies: {
    graph: GraphRepository;
    stories: StoryRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphNode> {
  await requireGraphStory(
    { ...input, capability: "graph:read" },
    { stories: dependencies.stories, access: dependencies.access },
  );

  const node = await dependencies.graph.findNodeById(input.nodeId);
  if (!node || node.storyId !== input.storyId) {
    throw new ApplicationError("NOT_FOUND", 404);
  }

  return node;
}
