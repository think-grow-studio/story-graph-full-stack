import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type {
  GraphEdge,
  GraphNode,
  RestorableGraphEdge,
  RestorableGraphNode,
} from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function restoreNode(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    nodeId: string;
    node: RestorableGraphNode;
    edges: RestorableGraphEdge[];
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<{ node: GraphNode; edges: GraphEdge[] }> {
  if (input.nodeId !== input.node.id || input.node.boardId !== input.boardId) {
    throw new ApplicationError("BAD_REQUEST", 400, "Node restore identity mismatch");
  }

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

  const restored = await dependencies.graph.restoreNode({
    boardId: board.id,
    node: input.node,
    edges: input.edges,
  });
  if (!restored) {
    throw new ApplicationError("CONFLICT", 409, "Node restore conflict");
  }

  return restored;
}
