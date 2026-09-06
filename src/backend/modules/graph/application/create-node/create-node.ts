import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type { GraphNode, JsonObject } from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function createNode(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    id: string;
    name: string;
    description: string;
    iconKey: string | null;
    properties: JsonObject;
    x: number;
    y: number;
    width: number | null;
    height: number | null;
    zIndex: number;
    style: JsonObject;
  },
  dependencies: {
    stories: StoryRepository;
    graph: GraphRepository;
    access: WorkspaceAccessService;
  },
): Promise<GraphNode> {
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

  return dependencies.graph.createNode({
    id: input.id,
    boardId: board.id,
    name: input.name,
    description: input.description,
    iconKey: input.iconKey,
    properties: input.properties,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    zIndex: input.zIndex,
    style: input.style,
  });
}
