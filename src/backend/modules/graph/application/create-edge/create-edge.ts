import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type {
  EdgeDirection,
  EdgePresentation,
  EdgeRouting,
  GraphEdge,
  GraphProperties,
} from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function createEdge(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    direction: EdgeDirection;
    name: string;
    description: string;
    kind: string;
    iconKey: string | null;
    properties: GraphProperties;
    presentation: EdgePresentation;
    routing: EdgeRouting;
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
    direction: input.direction,
    name: input.name,
    description: input.description,
    kind: input.kind,
    iconKey: input.iconKey,
    properties: input.properties,
    presentation: input.presentation,
    routing: input.routing,
  });
}
