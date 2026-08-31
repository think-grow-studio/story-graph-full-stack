import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { JsonObject, NodeState } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function putNodeState(
  input: {
    actorId: string;
    workspaceId: string;
    scopeId: string;
    nodeId: string;
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
): Promise<NodeState> {
  const scope = await dependencies.graph.findScope(input.scopeId);
  if (!scope) {
    throw new ApplicationError("NOT_FOUND", 404, "Scope not found");
  }

  const story = await dependencies.stories.findById(scope.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Scope not found");
  }

  const node = await dependencies.graph.findNode(input.nodeId);
  if (!node || node.storyId !== story.id) {
    throw new ApplicationError("NOT_FOUND", 404, "Node not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const result = await dependencies.graph.putNodeState({
    scopeId: scope.id,
    nodeId: node.id,
    expectedVersion: input.version,
    name: input.name,
    description: input.description,
    properties: input.properties,
  });

  if (result === "conflict") {
    throw new ApplicationError("CONFLICT", 409, "NodeState version conflict");
  }
  if (!result) {
    throw new ApplicationError("NOT_FOUND", 404, "Scope or Node not found");
  }
  return result;
}
