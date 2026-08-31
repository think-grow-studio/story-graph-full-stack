import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { EdgeState, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function putEdgeState(
  input: {
    actorId: string;
    workspaceId: string;
    scopeId: string;
    edgeId: string;
    version: number | null;
    name: string | null;
    description: string | null;
    properties: JsonObject | null;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<EdgeState> {
  const scope = await dependencies.graph.findScope(input.scopeId);
  if (!scope) {
    throw new ApplicationError("NOT_FOUND", 404, "Scope not found");
  }

  const story = await dependencies.stories.findById(scope.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Scope not found");
  }

  const edge = await dependencies.graph.findEdge(input.edgeId);
  if (!edge || edge.storyId !== story.id) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const result = await dependencies.graph.putEdgeState({
    scopeId: scope.id,
    edgeId: edge.id,
    expectedVersion: input.version,
    name: input.name,
    description: input.description,
    properties: input.properties,
  });

  if (result === "conflict") {
    throw new ApplicationError("CONFLICT", 409, "EdgeState version conflict");
  }
  if (!result) {
    throw new ApplicationError("NOT_FOUND", 404, "Scope or Edge not found");
  }
  return result;
}
