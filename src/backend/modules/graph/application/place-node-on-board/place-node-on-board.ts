import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { BoardNode, GraphNode } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function placeNodeOnBoard(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    nodeId: string;
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    zIndex: number;
    style: BoardNode["style"];
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<{ node: GraphNode; boardNode: BoardNode }> {
  const board = await dependencies.graph.findBoard(input.boardId);
  if (!board) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  const story = await dependencies.stories.findById(board.storyId);
  if (!story || story.workspaceId !== input.workspaceId) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  const node = await dependencies.graph.findNode(input.nodeId);
  if (!node || node.storyId !== story.id) {
    throw new ApplicationError("NOT_FOUND", 404, "Node not found");
  }

  await dependencies.access.requireCapability({
    userId: input.actorId,
    workspaceId: input.workspaceId,
    capability: "graph:update",
  });

  const result = await dependencies.graph.placeNodeOnBoard({
    boardId: board.id,
    nodeId: node.id,
    placement: {
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      zIndex: input.zIndex,
      style: input.style,
    },
  });
  if (!result) {
    throw new ApplicationError("NOT_FOUND", 404, "Node or Board not found");
  }
  return result;
}
