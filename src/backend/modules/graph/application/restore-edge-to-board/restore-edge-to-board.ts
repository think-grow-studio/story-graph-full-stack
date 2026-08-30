import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { BoardEdge, GraphEdge, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function restoreEdgeToBoard(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    edgeId: string;
    style: JsonObject;
    labelPresentation: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<{ edge: GraphEdge; boardEdge: BoardEdge }> {
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

  const restored = await dependencies.graph.restoreEdgeToBoard({
    boardId: board.id,
    edgeId: edge.id,
    style: input.style,
    labelPresentation: input.labelPresentation,
  });
  if (!restored) {
    throw new ApplicationError("NOT_FOUND", 404, "Board edge not found");
  }

  return restored;
}
