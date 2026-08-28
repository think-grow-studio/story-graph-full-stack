import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { BoardSnapshot } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function getBoardSnapshot(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<{ story: { id: string; name: string }; snapshot: BoardSnapshot }> {
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
    capability: "graph:read",
  });

  const snapshot = await dependencies.graph.getBoardSnapshot(input.boardId);
  if (!snapshot) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  return {
    story: { id: story.id, name: story.name },
    snapshot,
  };
}
