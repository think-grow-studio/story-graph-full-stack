import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphRepository } from "../../domain/graph.repository";

export async function removeEdgeFromBoard(
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
): Promise<void> {
  const board = await dependencies.graph.findBoard(input.boardId);
  if (!board) {
    throw new ApplicationError("NOT_FOUND", 404, "Board edge not found");
  }

  const story = await dependencies.stories.findById(board.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Board edge not found");
  }

  const edge = await dependencies.graph.findEdge(input.edgeId);
  if (!edge || edge.storyId !== board.storyId) {
    throw new ApplicationError("NOT_FOUND", 404, "Board edge not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const removed = await dependencies.graph.removeEdgeFromBoard(board.id, edge.id);
  if (!removed) {
    throw new ApplicationError("NOT_FOUND", 404, "Board edge not found");
  }
}
