import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphEdge, RestorableGraphEdge } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function restoreEdge(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    edgeId: string;
    edge: RestorableGraphEdge;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphEdge> {
  if (input.edgeId !== input.edge.id || input.edge.boardId !== input.boardId) {
    throw new ApplicationError("BAD_REQUEST", 400, "Edge restore identity mismatch");
  }

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

  const restored = await dependencies.graph.restoreEdge({
    boardId: board.id,
    edge: input.edge,
  });
  if (!restored) {
    throw new ApplicationError("CONFLICT", 409, "Edge restore conflict");
  }

  return restored;
}
