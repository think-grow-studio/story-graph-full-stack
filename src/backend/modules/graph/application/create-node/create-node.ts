import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphNode } from "../../domain/graph-node";
import type { GraphRepository } from "../../domain/graph.repository";
import { requireGraphStory } from "../_shared/require-graph-story";

export async function createNode(
  input: {
    actorId: string;
    workspaceId: string;
    storyId: string;
    id: string;
    name: string;
    description: string;
    iconKey: string | null;
    properties: Record<string, unknown>;
  },
  dependencies: {
    graph: GraphRepository;
    stories: StoryRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphNode> {
  await requireGraphStory(
    { ...input, capability: "graph:update" },
    { stories: dependencies.stories, access: dependencies.access },
  );

  const now = new Date();
  return dependencies.graph.createNode({
    id: input.id,
    storyId: input.storyId,
    name: input.name,
    description: input.description,
    iconKey: input.iconKey,
    properties: input.properties,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}
