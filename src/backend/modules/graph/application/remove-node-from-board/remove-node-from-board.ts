import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphRepository } from "../../domain/graph.repository";

export async function removeNodeFromBoard(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    nodeId: string;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<void> {
  const board = await dependencies.graph.findBoard(input.boardId);
  if (!board) {
    throw new ApplicationError("NOT_FOUND", 404, "Board node not found");
  }

  const story = await dependencies.stories.findById(board.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Board node not found");
  }

  const node = await dependencies.graph.findNode(input.nodeId);
  if (!node || node.storyId !== board.storyId) {
    throw new ApplicationError("NOT_FOUND", 404, "Board node not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const removed = await dependencies.graph.removeNodeFromBoard(board.id, node.id);
  if (!removed) {
    throw new ApplicationError("NOT_FOUND", 404, "Board node not found");
  }
}
