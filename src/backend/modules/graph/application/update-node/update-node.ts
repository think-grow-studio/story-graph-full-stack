import { ApplicationError } from "@/backend/common/errors/application-error";
import type { StoryRepository } from "@/backend/modules/story/domain/story.repository";
import type { WorkspaceAccessService } from "@/backend/modules/workspace/domain/workspace-access.service";
import type {
  GraphNode,
  GraphProperties,
  NodePresentation,
} from "../../domain/graph";
import type { GraphRepository } from "../../domain/graph.repository";

export async function updateNode(
  input: {
    actorId: string;
    workspaceId: string;
    boardId: string;
    nodeId: string;
    expectedVersion: number;
    name?: string;
    description?: string;
    kind?: string;
    iconKey?: string | null;
    properties?: GraphProperties;
    x?: number;
    y?: number;
    width?: number | null;
    height?: number | null;
    zIndex?: number;
    presentation?: NodePresentation;
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

  const existing = await dependencies.graph.findNode(board.id, input.nodeId);
  if (!existing) {
    throw new ApplicationError("NOT_FOUND", 404, "Node not found");
  }

  const updated = await dependencies.graph.updateNode({
    boardId: board.id,
    id: existing.id,
    expectedVersion: input.expectedVersion,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    ...(input.properties !== undefined ? { properties: input.properties } : {}),
    ...(input.x !== undefined ? { x: input.x } : {}),
    ...(input.y !== undefined ? { y: input.y } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
    ...(input.zIndex !== undefined ? { zIndex: input.zIndex } : {}),
    ...(input.presentation !== undefined
      ? { presentation: input.presentation }
      : {}),
  });

  if (!updated) {
    throw new ApplicationError("CONFLICT", 409, "Node version conflict");
  }

  return updated;
}
