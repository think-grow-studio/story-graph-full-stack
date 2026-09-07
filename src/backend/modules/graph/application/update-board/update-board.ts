import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { Board, GraphSettings } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function updateBoard(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    name?: string;
    description?: string;
    tags?: string[];
    graphSettings?: GraphSettings;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<Board> {
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

  const updated = await dependencies.graph.updateBoard({
    id: board.id,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.graphSettings !== undefined
      ? { graphSettings: input.graphSettings }
      : {}),
  });
  if (!updated) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  return updated;
}
