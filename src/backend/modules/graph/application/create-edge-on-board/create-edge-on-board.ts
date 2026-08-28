import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { BoardEdge, GraphEdge, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function createEdgeOnBoard(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    name: string;
    description: string;
    iconKey: string | null;
    properties: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<{ edge: GraphEdge; boardEdge: BoardEdge }> {
  const board = await dependencies.graph.findBoard(input.boardId);
  if (!board) {
    throw new ApplicationError("NOT_FOUND", 404, "Board not found");
  }

  const source = await dependencies.graph.findNode(input.sourceNodeId);
  const target = await dependencies.graph.findNode(input.targetNodeId);
  if (!source || !target || source.storyId !== board.storyId || target.storyId !== board.storyId) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge endpoints not found");
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

  const now = new Date();
  const edge: GraphEdge = {
    id: input.id,
    storyId: board.storyId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    name: input.name,
    description: input.description,
    iconKey: input.iconKey,
    properties: input.properties,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  return dependencies.graph.createEdgeOnBoard({ boardId: board.id, edge });
}
