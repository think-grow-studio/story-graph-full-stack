import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type {
  EdgeDirection,
  EdgePresentation,
  EdgeRouting,
  GraphEdge,
  GraphProperties,
} from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function updateEdge(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    edgeId: string;
    expectedVersion: number;
    direction?: EdgeDirection;
    name?: string;
    description?: string;
    kind?: string;
    iconKey?: string | null;
    properties?: GraphProperties;
    presentation?: EdgePresentation;
    routing?: EdgeRouting;
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
    ...(input.direction !== undefined ? { direction: input.direction } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
    ...(input.presentation !== undefined
      ? { presentation: input.presentation }
      : {}),
    ...(input.routing !== undefined ? { routing: input.routing } : {}),
  });

  if (!updated) {
    throw new ApplicationError("CONFLICT", 409, "Edge version conflict");
  }

  return updated;
}
