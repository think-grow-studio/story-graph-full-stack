import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphEdge, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function updateEdge(
  input: {
    actorId: string;
    workspaceId: string;
    edgeId: string;
    version: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphEdge> {
  const edge = await dependencies.graph.findEdge(input.edgeId);
  if (!edge) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge not found");
  }

  const story = await dependencies.stories.findById(edge.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const updated = await dependencies.graph.updateEdge({
    id: edge.id,
    expectedVersion: input.version,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
  });

  if (!updated) {
    throw new ApplicationError("CONFLICT", 409, "Edge version conflict");
  }

  return updated;
}
