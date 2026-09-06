import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { DeletedNodeSnapshot } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function deleteNode(
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
): Promise<DeletedNodeSnapshot> {
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

  const deleted = await dependencies.graph.deleteNode(board.id, input.nodeId);
  if (!deleted) {
    throw new ApplicationError("NOT_FOUND", 404, "Node not found");
  }

  return deleted;
}
