import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { BoardNode, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function updateBoardNode(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    nodeId: string;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    style?: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<BoardNode> {
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

  const updated = await dependencies.graph.updateBoardNode({
    boardId: board.id,
    nodeId: node.id,
    ...(input.x !== undefined ? { x: input.x } : {}),
    ...(input.y !== undefined ? { y: input.y } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.zIndex !== undefined ? { zIndex: input.zIndex } : {}),
    ...(input.style !== undefined ? { style: input.style } : {}),
  });

  if (!updated) {
    throw new ApplicationError("NOT_FOUND", 404, "Board node not found");
  }

  return updated;
}
