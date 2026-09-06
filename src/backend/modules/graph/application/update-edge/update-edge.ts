import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphEdge, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function updateEdge(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    edgeId: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    iconKey?: string | null;
    properties?: JsonObject;
    style?: JsonObject;
    labelPresentation?: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphEdge> {
  const board = await dependencies.graph.findBoard(input.boardId);
  if (!board) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  const story = await dependencies.stories.findById(board.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const existing = await dependencies.graph.findEdge(board.id, input.edgeId);
  if (!existing) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge not found");
  }

  const updated = await dependencies.graph.updateEdge({
    boardId: board.id,
    id: existing.id,
    expectedVersion: input.expectedVersion,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
    ...(input.style !== undefined ? { style: input.style } : {}),
    ...(input.labelPresentation !== undefined
      ? { labelPresentation: input.labelPresentation }
      : {}),
  });

  if (!updated) {
    throw new ApplicationError("CONFLICT", 409, "Edge version conflict");
  }

  return updated;
}
