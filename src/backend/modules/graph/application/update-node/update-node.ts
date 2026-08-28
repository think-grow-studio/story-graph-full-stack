import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphNode } from "../../domain/graph-node";
import type { GraphRepository } from "../../domain/graph.repository";
import { requireGraphStory } from "../_shared/require-graph-story";

export async function updateNode(
  input: {
    actorId: string;
    workspaceId: string;
    storyId: string;
    nodeId: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: Record<string, unknown>;
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

  const existing = await dependencies.graph.findNodeById(input.nodeId);
  if (!existing || existing.storyId !== input.storyId) {
    throw new ApplicationError("NOT_FOUND", 404);
  }

  const result = await dependencies.graph.updateNode({
    id: input.nodeId,
    expectedVersion: input.expectedVersion,
    name: input.name,
    description: input.description,
    iconKey: input.iconKey,
    properties: input.properties,
  });

  if (result.kind === "conflict") {
    throw new ApplicationError("CONFLICT", 409);
  }
  if (result.kind === "not-found") {
    throw new ApplicationError("NOT_FOUND", 404);
  }

  return result.node;
}
