import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphEdge, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function createEdge(
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
    style: JsonObject;
    labelPresentation: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphEdge> {
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

  const [source, target] = await Promise.all([
    dependencies.graph.findNode(board.id, input.sourceNodeId),
    dependencies.graph.findNode(board.id, input.targetNodeId),
  ]);
  if (!source || !target) {
    throw new ApplicationError("NOT_FOUND", 404, "Edge endpoints not found");
  }

  return dependencies.graph.createEdge({
    id: input.id,
    boardId: board.id,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    name: input.name,
    description: input.description,
    iconKey: input.iconKey,
    properties: input.properties,
    style: input.style,
    labelPresentation: input.labelPresentation,
  });
}
