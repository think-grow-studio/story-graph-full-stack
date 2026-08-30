import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { BoardEdge, BoardNode, GraphEdge, GraphNode } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function restoreNodeToBoard(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    nodeId: string;
    placement: Pick<
      BoardNode,
      "x" | "y" | "width" | "height" | "zIndex" | "style"
    >;
    boardEdges: Array<
      Pick<BoardEdge, "edgeId" | "style" | "labelPresentation">
    >;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<{
  node: GraphNode;
  boardNode: BoardNode;
  edges: GraphEdge[];
  boardEdges: BoardEdge[];
}> {
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

  const restored = await dependencies.graph.restoreNodeToBoard({
    boardId: board.id,
    nodeId: node.id,
    placement: input.placement,
    boardEdges: input.boardEdges,
  });
  if (!restored) {
    throw new ApplicationError("NOT_FOUND", 404, "Board node not found");
  }

  return restored;
}
