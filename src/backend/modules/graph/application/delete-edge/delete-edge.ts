import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphEdge } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function deleteEdge(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    edgeId: string;
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

  const deleted = await dependencies.graph.deleteEdge(board.id, input.edgeId);
  if (!deleted) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge not found");
  }

  return deleted;
}
